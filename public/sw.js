/**
 * ElitPOS — Service Worker
 *
 * In development: this is a no-op stub. It registers the SW so the PWA
 * install prompt works, but does NOT intercept any fetch requests.
 * This prevents the offline fallback page from appearing when the dev
 * server is running normally.
 *
 * In production: this file is replaced at build time by the full offline-
 * capable SW (see src/lib/sw/sw-production.js) which adds NetworkFirst
 * caching, Background Sync, and push notifications.
 *
 * The build script (scripts/build-sw.mjs) copies the correct version
 * into public/sw.js based on NODE_ENV before next build runs.
 */

const IS_DEV = self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.endsWith('.local')

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // In dev: clear ALL caches so stale SW caches never block the dev server
    IS_DEV
      ? caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      : Promise.resolve()
  )
  event.waitUntil(self.clients.claim())
})

// In development: NO fetch handler — let the browser handle everything natively.
// This is the critical line. Without a fetch handler the SW is completely
// transparent to all requests, which is exactly what we want in dev.
if (!IS_DEV) {
  // Production fetch handling is injected here by the build script.
  // In dev this block never executes.
}
