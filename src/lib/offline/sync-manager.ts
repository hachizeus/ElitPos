/**
 * ElitPOS — Offline Sync Manager
 *
 * When the user comes back online this manager:
 *   1. Reads all pending operations from the IndexedDB queue
 *   2. Replays them against the server in chronological order
 *   3. Resolves conflicts using the ConflictResolver
 *   4. Updates the queue (marks synced or records error)
 *   5. Fires events so the UI can react (show a sync progress indicator)
 *
 * It also performs a pull-sync: fetching fresh data from the server
 * and refreshing the entity cache.
 */

'use client'

import {
  getPendingOps,
  markSynced,
  recordAttempt,
  discardOp,
  setLastSynced,
  type QueuedOperation,
} from './indexed-db-queue'
import { resolveConflict } from './conflict-resolver'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

export interface SyncEvent {
  status: SyncStatus
  pending: number
  synced: number
  failed: number
  errors: string[]
}

type SyncListener = (event: SyncEvent) => void

// Max retry attempts before an operation is permanently discarded
const MAX_ATTEMPTS = 5

// Delay between retrying a failed operation (ms)
const RETRY_DELAY_MS = 2_000

// Entities to pull from server after pushing (to refresh local cache)
const PULL_ENTITIES = [
  { type: 'items',    endpoint: '/api/items?limit=500&offset=0' },
  { type: 'customers', endpoint: '/api/customers?limit=500&offset=0' },
  { type: 'categories', endpoint: '/api/categories' },
  { type: 'pos-profiles', endpoint: '/api/pos-profiles' },
  { type: 'payment-methods', endpoint: '/api/payment-methods' },
  { type: 'warehouses', endpoint: '/api/warehouses' },
]

class SyncManager {
  private listeners: SyncListener[] = []
  private isSyncing = false
  private tenantSlug: string | null = null
  private tenantId: string | null = null
  private authHeaders: Record<string, string> = {}

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  setContext(tenantId: string, tenantSlug: string, authHeaders: Record<string, string>) {
    this.tenantId = tenantId
    this.tenantSlug = tenantSlug
    this.authHeaders = authHeaders
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  private emit(event: SyncEvent) {
    this.listeners.forEach(l => l(event))
  }

  // ── Main sync ───────────────────────────────────────────────────────────────

  async sync(): Promise<SyncEvent> {
    if (this.isSyncing || !this.tenantId) {
      return { status: 'idle', pending: 0, synced: 0, failed: 0, errors: [] }
    }

    this.isSyncing = true
    const ops = await getPendingOps(this.tenantId)

    if (ops.length === 0) {
      this.isSyncing = false
      const event: SyncEvent = { status: 'success', pending: 0, synced: 0, failed: 0, errors: [] }
      this.emit(event)
      return event
    }

    console.log(`[SyncManager] Starting sync: ${ops.length} pending operations`)
    this.emit({ status: 'syncing', pending: ops.length, synced: 0, failed: 0, errors: [] })

    let synced = 0
    let failed = 0
    const errors: string[] = []

    for (const op of ops) {
      try {
        await this.replayOperation(op)
        await markSynced(op.id!)
        synced++
        this.emit({ status: 'syncing', pending: ops.length - synced - failed, synced, failed, errors })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        failed++
        errors.push(`[${op.endpoint}] ${errorMsg}`)

        if ((op.attempts + 1) >= MAX_ATTEMPTS) {
          console.warn(`[SyncManager] Discarding op ${op.id} after ${op.attempts + 1} attempts: ${errorMsg}`)
          await discardOp(op.id!)
        } else {
          await recordAttempt(op.id!, errorMsg)
          await sleep(RETRY_DELAY_MS)
        }
      }
    }

    // After pushing, pull fresh data
    try {
      await this.pullEntities()
    } catch (err) {
      console.warn('[SyncManager] Pull failed after push sync:', err)
    }

    this.isSyncing = false
    const finalStatus: SyncStatus = failed === 0 ? 'success' : synced > 0 ? 'success' : 'error'
    const result: SyncEvent = { status: finalStatus, pending: 0, synced, failed, errors }
    this.emit(result)
    return result
  }

  // ── Operation replay ────────────────────────────────────────────────────────

  private async replayOperation(op: QueuedOperation): Promise<void> {
    const endpoint = this.resolveEndpoint(op.endpoint)

    const response = await fetch(endpoint, {
      method: op.method,
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders,
        ...op.headers,
        'X-Offline-Sync': 'true',
        'X-Offline-Op-Id': String(op.id),
        'X-Offline-Created-At': new Date(op.createdAt).toISOString(),
      },
      body: op.body ? JSON.stringify(op.body) : undefined,
    })

    if (response.ok) return

    // Non-2xx — check conflict resolution
    const responseBody = await response.json().catch(() => ({}))
    const serverUpdatedAt = (responseBody as Record<string, unknown>)?.updatedAt
    const serverTs = serverUpdatedAt ? new Date(serverUpdatedAt as string).getTime() : undefined

    const resolution = resolveConflict({
      operation: op,
      serverResponse: { status: response.status, body: responseBody },
      localTimestamp: op.createdAt,
      serverTimestamp: serverTs,
    })

    switch (resolution.action) {
      case 'APPLY_LOCAL':
        // Force-apply with conflict override header
        await fetch(endpoint, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
            ...this.authHeaders,
            'X-Offline-Sync': 'true',
            'X-Force-Apply': 'true',
          },
          body: op.body ? JSON.stringify(op.body) : undefined,
        })
        break

      case 'MERGE':
        await fetch(endpoint, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...this.authHeaders,
            'X-Offline-Sync': 'true',
          },
          body: JSON.stringify(resolution.mergedBody),
        })
        break

      case 'DISCARD_LOCAL':
        console.log(`[SyncManager] Discarding op ${op.id}: ${resolution.reason}`)
        return // Don't throw — just skip

      case 'RETRY':
        throw new Error(`Will retry: ${resolution.reason}`)
    }
  }

  // ── Pull (data refresh) ─────────────────────────────────────────────────────

  private async pullEntities(): Promise<void> {
    if (!this.tenantId) return

    // Import cache helpers lazily to avoid circular deps
    const { cacheEntity, setLastSynced } = await import('./indexed-db-queue')

    for (const entity of PULL_ENTITIES) {
      try {
        const res = await fetch(entity.endpoint, {
          headers: { ...this.authHeaders },
        })
        if (!res.ok) continue

        const data = await res.json()
        const items = Array.isArray(data) ? data : (data.data ?? data.items ?? [])

        for (const item of items) {
          if (item?.id && this.tenantId) {
            await cacheEntity(this.tenantId, entity.type, item.id, item, 10 * 60 * 1000) // 10 min
          }
        }

        await setLastSynced(this.tenantId, entity.type)
        console.log(`[SyncManager] Pulled ${items.length} ${entity.type}`)
      } catch (err) {
        console.warn(`[SyncManager] Failed to pull ${entity.type}:`, err)
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private resolveEndpoint(endpoint: string): string {
    // In Electron, API calls go to localhost. In browser, they're relative.
    if (typeof window !== 'undefined' && (window as Window & { electronAPI?: unknown }).electronAPI) {
      return `http://localhost:${process.env.NEXT_PUBLIC_PORT ?? 3000}${endpoint}`
    }
    return endpoint
  }
}

// Singleton
export const syncManager = new SyncManager()

// ── Online event wiring ───────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncManager] Back online — triggering sync')
    syncManager.sync().catch(console.error)
  })

  // Electron network events
  const ea = (window as Window & { electronAPI?: { onNetworkChange?: (cb: (status: { isOnline: boolean }) => void) => void } }).electronAPI
  if (ea?.onNetworkChange) {
    ea.onNetworkChange(({ isOnline }) => {
      if (isOnline) syncManager.sync().catch(console.error)
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
