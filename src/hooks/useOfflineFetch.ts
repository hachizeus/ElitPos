/**
 * ElitPOS — useOfflineFetch hook
 *
 * Returns a fetch wrapper pre-loaded with the current session's tenantId
 * and userId so callers don't have to pass them manually.
 * Also wires the SyncManager context on first call.
 */

'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useCallback, useRef } from 'react'
import { apiFetch, type OfflineFetchOptions } from '@/lib/offline/api-client'
import { syncManager } from '@/lib/offline/sync-manager'

export function useOfflineFetch() {
  const { data: session } = useSession()
  const contextWired = useRef(false)

  // Wire SyncManager with auth context once session is available
  useEffect(() => {
    if (!session?.user || contextWired.current) return
    contextWired.current = true

    syncManager.setContext(
      session.user.tenantId,
      session.user.tenantSlug,
      {
        // Cookie-based auth — no Authorization header needed for same-origin
        // but we add tenant slug as a header so the server can route correctly
        'X-Tenant-Slug': session.user.tenantSlug,
      }
    )
  }, [session])

  return useCallback(
    (endpoint: string, options: Omit<OfflineFetchOptions, 'tenantId' | 'userId'> = {}) => {
      return apiFetch(endpoint, {
        ...options,
        tenantId: session?.user?.tenantId ?? undefined,
        userId: session?.user?.id ?? undefined,
      })
    },
    [session?.user?.tenantId, session?.user?.id]
  )
}
