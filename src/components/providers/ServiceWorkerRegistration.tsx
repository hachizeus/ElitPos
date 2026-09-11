'use client'

import { useEffect } from 'react'

/**
 * Registers /sw.js as a service worker.
 *
 * In DEVELOPMENT (localhost / 127.0.0.1):
 *   - Registers the stub SW which has NO fetch handler
 *   - This means requests go directly to the dev server — no interception
 *   - All caches are cleared on activation so stale production caches
 *     cannot block the dev server
 *
 * In PRODUCTION:
 *   - Registers the full offline SW (copied to public/sw.js by build-sw.mjs)
 *   - NetworkFirst for API, CacheFirst for static assets, Background Sync
 *
 * Skipped entirely in Electron (the embedded server handles everything).
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Skip in Electron
    const isElectron = !!(window as Window & { electronAPI?: unknown }).electronAPI
    if (isElectron) return

    // Skip if explicitly disabled via env
    if (process.env.NEXT_PUBLIC_DISABLE_SW === 'true') return

    if (!('serviceWorker' in navigator)) return

    const isDev = process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    if (isDev) {
      // In dev: ensure we're registered with the stub (no fetch interception).
      // Also force-clear any old production SW registration that might be blocking.
      navigator.serviceWorker.getRegistrations().then(registrations => {
        // If there's already a registration, check if it's the stub
        if (registrations.length === 0) {
          // No SW registered — register the stub
          navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(() => console.log('[SW] Dev stub registered'))
            .catch(err => console.warn('[SW] Dev stub registration failed:', err))
          return
        }

        // There's a registration — check its scriptURL
        for (const reg of registrations) {
          const scriptUrl = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? ''
          // If it's already our sw.js, just let the activate clear the caches
          if (scriptUrl.includes('/sw.js')) {
            reg.update().catch(() => {})
          } else {
            // Unregister old SW (from a previous install) and re-register stub
            reg.unregister().then(() => {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(() => console.log('[SW] Replaced old SW with dev stub'))
                .catch(() => {})
            })
          }
        }
      }).catch(() => {})

      return
    }

    // Production: register the full offline SW
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope)
        // Check for updates every 60 minutes
        setInterval(() => registration.update(), 60 * 60 * 1000)
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err)
      })

    // SW → App message bridge
    // When the Background Sync fires (even after tab close/reopen on Chrome),
    // the SW posts { type: 'SYNC_QUEUE' }. We convert it to a DOM event so
    // useOfflineStatus and syncManager can react without needing a direct
    // reference to the SW registration.
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_QUEUE') {
        window.dispatchEvent(new Event('sw:sync-queue'))
      }
    }
    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    // Cleanup is intentionally omitted — this listener should live for the
    // entire page lifetime (same as the SW registration itself)
  }, [])

  return null
}
