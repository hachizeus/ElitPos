'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * usePageRefresh
 *
 * Background-refreshes the current page without a full browser reload.
 * Does three things simultaneously:
 *   1. router.refresh() — re-runs server components (Next.js App Router)
 *   2. Dispatches 'page:refresh' DOM event — picked up by useRealtimeData
 *      hooks across the page, triggering their fetch callbacks
 *   3. Returns { refreshing, refresh } so callers can show a spinner
 *
 * This is the same pattern as WorkspaceRenderer's handleRefresh but
 * generalised for use in any header/toolbar.
 */
export function usePageRefresh() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)

    try {
      // 1. Re-run server components / invalidate Next.js cache for current route
      router.refresh()

      // 2. Notify all useRealtimeData hooks on the page to re-fetch
      window.dispatchEvent(new CustomEvent('page:refresh', { detail: { source: 'header' } }))

      // Minimum spinner duration so user sees feedback
      await new Promise(resolve => setTimeout(resolve, 600))
    } finally {
      setRefreshing(false)
    }
  }, [router, refreshing])

  return { refreshing, refresh }
}
