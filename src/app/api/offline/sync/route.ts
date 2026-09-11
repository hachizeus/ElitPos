/**
 * POST /api/offline/sync
 *
 * Triggers a forced sync of the offline mutation queue.
 * Called by:
 *   - Electron IPC handler when the user clicks "Sync now"
 *   - Background sync job every N minutes
 *   - The SyncManager when navigator.onLine becomes true
 *
 * In Electron mode: reads from SQLite queue, replays mutations, clears queue.
 * In web/browser mode: returns 200 immediately (sync is handled client-side
 * by SyncManager reading from IndexedDB).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env.ELITPOS_RUNTIME_MODE !== 'electron') {
    // Browser/web: client-side SyncManager handles this
    return NextResponse.json({ ok: true, message: 'Sync handled client-side', queued: 0, synced: 0 })
  }

  // Electron mode: process the SQLite queue
  try {
    const { getOfflineDb } = await import('@/lib/db/offline-db')
    const { offlineQueue } = await import('@/lib/db/offline-schema')
    const { eq, and } = await import('drizzle-orm')

    const db = getOfflineDb()
    const pending = await db.select().from(offlineQueue).limit(100)

    let synced = 0
    let failed = 0
    const errors: string[] = []

    for (const op of pending) {
      try {
        const body = op.body ? JSON.parse(op.body) : undefined
        const headers = op.headers ? JSON.parse(op.headers) : {}

        const response = await fetch(`http://localhost:${process.env.PORT ?? 3000}${op.endpoint}`, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
            // Forward the session cookie so API routes authenticate correctly
            'Cookie': request.headers.get('cookie') ?? '',
            'X-Offline-Sync': 'true',
          },
          body: body ? JSON.stringify(body) : undefined,
        })

        if (response.ok || response.status < 500) {
          await db.delete(offlineQueue).where(eq(offlineQueue.id, op.id))
          synced++
        } else {
          const errText = await response.text().catch(() => `HTTP ${response.status}`)
          errors.push(`${op.method} ${op.endpoint}: ${errText}`)
          failed++
          // Update attempt count
          await db.update(offlineQueue)
            .set({ attempts: op.attempts + 1, lastError: errText })
            .where(eq(offlineQueue.id, op.id))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${op.method} ${op.endpoint}: ${msg}`)
        failed++
        await db.update(offlineQueue)
          .set({ attempts: op.attempts + 1, lastError: msg })
          .where(eq(offlineQueue.id, op.id))
      }
    }

    return NextResponse.json({
      ok: true,
      queued: pending.length,
      synced,
      failed,
      errors: errors.slice(0, 10), // cap error list
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[offline/sync] Error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
