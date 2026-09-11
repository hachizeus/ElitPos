/**
 * GET /api/offline/queue-length
 *
 * Returns the number of pending offline mutations waiting to be synced.
 * Used by the Electron main process (IPC handler) and the OfflineStatusBar.
 *
 * In web/Electron mode this reads from the SQLite queue.
 * In browser mode, the count comes from IndexedDB client-side — this route
 * returns 0 as a fallback (the real count is in useOfflineStatus hook).
 */

import { NextResponse } from 'next/server'
import { withAuthTenant } from '@/lib/db/with-auth-tenant'

export async function GET() {
  // If running in Electron with SQLite, query the SQLite queue
  if (process.env.ELITPOS_RUNTIME_MODE === 'electron') {
    try {
      const { getOfflineDb } = await import('@/lib/db/offline-db')
      const { offlineQueue } = await import('@/lib/db/offline-schema')
      const { count } = await import('drizzle-orm')

      const db = getOfflineDb()
      const result = await db.select({ count: count() }).from(offlineQueue)
      const pendingCount = result[0]?.count ?? 0

      return NextResponse.json({ count: pendingCount })
    } catch (err) {
      console.error('[offline/queue-length] SQLite query failed:', err)
      return NextResponse.json({ count: 0 })
    }
  }

  // Web mode: count lives in IndexedDB on the client
  // The Electron IPC handler calls this endpoint from the main process
  return NextResponse.json({ count: 0 })
}
