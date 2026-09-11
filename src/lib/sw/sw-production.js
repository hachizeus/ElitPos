/**
 * ElitPOS — Production Service Worker
 *
 * This file is copied to public/sw.js by scripts/build-sw.mjs during
 * `npm run build` (production builds only). It is NEVER served directly
 * in development to avoid intercepting the dev server.
 *
 * Strategies:
 *   GET /api/*        → NetworkFirst  (5 min cache, offline fallback)
 *   /_next/static/*   → CacheFirst    (immutable, 1 year)
 *   Images            → CacheFirst    (7 days)
 *   Pages             → NetworkFirst  (60s, offline page fallback)
 *   POST/PATCH/DELETE → Background Sync queue
 */

const CACHE_VERSION = 'elitpos-v1'
const API_CACHE = 'elitpos-api-v1'
const IMAGE_CACHE = 'elitpos-images-v1'
const PAGE_CACHE = 'elitpos-pages-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll([
        '/',           // app shell — SPA navigation fallback
        '/account',    // account portal shell
        '/offline',    // explicit offline page
        '/icons/mainlogo.png',
        '/manifest.webmanifest',
      ]).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => ![CACHE_VERSION, API_CACHE, IMAGE_CACHE, PAGE_CACHE].includes(k))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Routes that must NEVER be served from cache ──────────────────────────────
// These are security-sensitive, payment-related, or real-time endpoints where
// stale data is actively dangerous. The SW passes them straight to the network.
const ONLINE_ONLY_PATTERNS = [
  /^\/api\/auth\//,           // NextAuth sign-in, sign-out, CSRF, session
  /^\/api\/invites\//,        // Invite accept — must hit live DB
  /^\/api\/payments\//,       // Payment processing
  /^\/api\/mpesa\//,          // M-Pesa STK push / callback
  /^\/api\/paystack\//,       // PayStack
  /^\/api\/payhero\//,        // PayHero
  /^\/api\/payhere\//,        // PayHere webhook
  /^\/api\/webhooks\//,       // All webhooks
  /^\/api\/cron\//,           // Cron jobs
  /^\/api\/offline\//,        // Offline sync endpoints (must reach server)
  /^\/_events/,               // SSE endpoint
  /^\/ws/,                    // WebSocket upgrade
]

function isOnlineOnly(pathname) {
  return ONLINE_ONLY_PATTERNS.some(re => re.test(pathname))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept non-same-origin requests or non-HTTP protocols
  if (url.origin !== self.location.origin) return
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return

  // Never intercept dev tooling
  if (url.pathname.includes('_next/webpack-hmr')) return
  if (url.protocol === 'chrome-extension:') return

  // Online-only routes — pass straight through, no caching
  if (isOnlineOnly(url.pathname)) return

  // Non-GET mutations — try network, register Background Sync on failure
  if (request.method !== 'GET') {
    event.respondWith(handleMutation(request))
    return
  }

  // /_next/static/ — immutable content-hashed assets, cache forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, CACHE_VERSION, 365 * 24 * 60 * 60))
    return
  }

  // Images — cache for 7 days
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 7 * 24 * 60 * 60))
    return
  }

  // API data routes — NetworkFirst (5 min stale window)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 5 * 60))
    return
  }

  // Page / SPA navigation — NetworkFirst, fallback to cached app shell
  event.respondWith(networkFirst(request, PAGE_CACHE, 60))
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'elitpos-mutation-queue') {
    event.waitUntil(flushMutationQueue())
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    event.waitUntil(
      self.registration.showNotification(data.title || 'ElitPOS', {
        body: data.body || '',
        icon: '/icons/mainlogo.png',
        badge: '/icons/mainlogo.png',
        tag: data.tag || 'elitpos-notification',
        data: data.url ? { url: data.url } : undefined,
      })
    )
  } catch {}
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url))
  }
})

async function networkFirst(request, cacheName, maxAgeSec) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetchWithTimeout(request.clone(), 8000)
    if (response.ok) {
      const headers = new Headers(response.clone().headers)
      headers.set('x-sw-fetched-at', String(Date.now()))
      cache.put(request, new Response(response.clone().body, {
        status: response.status, statusText: response.statusText, headers,
      }))
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) {
      const age = Date.now() - parseInt(cached.headers.get('x-sw-fetched-at') || '0', 10)
      const headers = new Headers(Object.fromEntries(cached.headers.entries()))
      headers.set('x-sw-cache', age < maxAgeSec * 1000 ? 'hit' : 'stale')
      return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers })
    }

    // Nothing in cache for this request
    if (request.destination === 'document' || request.mode === 'navigate') {
      // Navigation: serve the cached app shell ( / ) so the SPA router handles
      // the route client-side rather than showing a browser error page.
      // This is the key pattern from the reference system.
      const shell = await caches.match('/')
        || await caches.match('/account')  // account portal shell
        || await caches.match('/offline')  // last resort fallback page
      if (shell) return shell
      return offlineFallback()
    }

    return apiOfflineFallback()
  }
}

async function cacheFirst(request, cacheName, maxAgeSec) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    const age = Date.now() - parseInt(cached.headers.get('x-sw-fetched-at') || '0', 10)
    if (age < maxAgeSec * 1000) return cached
  }
  try {
    const response = await fetchWithTimeout(request.clone(), 8000)
    if (response.ok) {
      const headers = new Headers(response.clone().headers)
      headers.set('x-sw-fetched-at', String(Date.now()))
      cache.put(request, new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers }))
    }
    return response
  } catch {
    return cached || offlineFallback()
  }
}

async function handleMutation(request) {
  try { return await fetchWithTimeout(request.clone(), 10000) }
  catch {
    try { await self.registration.sync.register('elitpos-mutation-queue') } catch {}
    return new Response(
      JSON.stringify({ _offline: true, error: 'Queued for sync when online' }),
      { status: 202, headers: { 'Content-Type': 'application/json', 'X-Offline-Queue': 'sw' } }
    )
  }
}

async function flushMutationQueue() {
  // Notify all open app clients — they own the auth token and will replay the queue
  try {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    allClients.forEach(client => client.postMessage({ type: 'SYNC_QUEUE' }))
  } catch {}

  // Also attempt a direct replay from the SW for any ops that don't need auth
  // (the app-layer SyncManager handles auth-required ops via the postMessage above)
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('elitpos-offline', 1)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const ops = await new Promise((res, rej) => {
      const r = db.transaction('mutation_queue', 'readonly').objectStore('mutation_queue').getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    for (const op of ops) {
      try {
        const res = await fetch(op.endpoint, {
          method: op.method,
          headers: { 'Content-Type': 'application/json', ...(op.headers || {}) },
          body: op.body ? JSON.stringify(op.body) : undefined,
        })
        if (res.ok || res.status < 500) {
          await new Promise((res, rej) => {
            const r = db.transaction('mutation_queue', 'readwrite').objectStore('mutation_queue').delete(op.id)
            r.onsuccess = res; r.onerror = () => rej(r.error)
          })
        }
      } catch {}
    }
  } catch {}
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(request).then(r => { clearTimeout(timer); resolve(r) }).catch(e => { clearTimeout(timer); reject(e) })
  })
}

function offlineFallback() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ElitPOS — Offline</title>
    <style>body{background:#071209;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;gap:16px;}
    h1{color:#00FF88;font-size:2rem;margin:0;}p{color:rgba(255,255,255,.6);text-align:center;max-width:400px;}
    button{background:#00FF88;color:#071209;border:none;padding:12px 24px;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;}
    </style></head><body><h1>ElitPOS</h1><p>You are offline. The app will reconnect automatically when your internet connection returns.</p>
    <button onclick="location.reload()">Retry</button></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

function apiOfflineFallback() {
  return new Response(
    JSON.stringify({ error: 'You are offline. Data will sync when connection is restored.', offline: true }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' } }
  )
}
