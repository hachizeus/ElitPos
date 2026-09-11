/**
 * ElitPOS — Offline Conflict Resolver
 *
 * When the sync manager replays queued operations against the server,
 * conflicts can arise (e.g. the same record was updated both offline
 * and online). This module defines resolution strategies.
 *
 * Strategy matrix:
 *  - sales / pos transactions  → LOCAL_WINS   (never discard a sale)
 *  - stock adjustments         → SERVER_WINS  (inventory is source of truth)
 *  - customers                 → LAST_WRITE_WINS (compare updatedAt)
 *  - items                     → SERVER_WINS  (product catalogue managed server-side)
 *  - work orders               → LAST_WRITE_WINS
 *  - default                   → LAST_WRITE_WINS
 */

import type { QueuedOperation } from './indexed-db-queue'

export type ConflictStrategy = 'LOCAL_WINS' | 'SERVER_WINS' | 'LAST_WRITE_WINS' | 'MERGE'

export interface ConflictContext {
  operation: QueuedOperation
  serverResponse: {
    status: number
    body: unknown
  }
  localTimestamp: number    // createdAt of the queued op
  serverTimestamp?: number  // updatedAt from server response (ms)
}

export interface ConflictResolution {
  action: 'APPLY_LOCAL' | 'DISCARD_LOCAL' | 'MERGE' | 'RETRY'
  mergedBody?: unknown
  reason: string
}

// ── Strategy map by entity type ───────────────────────────────────────────────

const ENTITY_STRATEGIES: Record<string, ConflictStrategy> = {
  sales:               'LOCAL_WINS',
  'pos-transactions':  'LOCAL_WINS',
  'held-sales':        'LOCAL_WINS',
  customers:           'LAST_WRITE_WINS',
  'work-orders':       'LAST_WRITE_WINS',
  estimates:           'LAST_WRITE_WINS',
  'sales-orders':      'LAST_WRITE_WINS',
  items:               'SERVER_WINS',
  'stock-adjustments': 'SERVER_WINS',
  'stock-movements':   'SERVER_WINS',
  warehouses:          'SERVER_WINS',
}

function getStrategy(entityType?: string): ConflictStrategy {
  if (!entityType) return 'LAST_WRITE_WINS'
  return ENTITY_STRATEGIES[entityType] ?? 'LAST_WRITE_WINS'
}

// ── Resolver ──────────────────────────────────────────────────────────────────

export function resolveConflict(ctx: ConflictContext): ConflictResolution {
  const { operation, serverResponse, localTimestamp, serverTimestamp } = ctx
  const strategy = getStrategy(operation.entityType)

  // HTTP 409 = explicit conflict from server
  // HTTP 404 = entity deleted server-side
  // HTTP 422 = validation error (not a conflict — discard)
  const isConflict = serverResponse.status === 409
  const isDeleted = serverResponse.status === 404
  const isValidationError = serverResponse.status === 422

  if (isValidationError) {
    return {
      action: 'DISCARD_LOCAL',
      reason: `Server rejected operation with validation error: ${JSON.stringify(serverResponse.body)}`,
    }
  }

  if (isDeleted && operation.method !== 'DELETE') {
    // Entity was deleted server-side — apply local if LOCAL_WINS, else discard
    if (strategy === 'LOCAL_WINS') {
      return {
        action: 'APPLY_LOCAL',
        reason: 'Entity deleted on server but LOCAL_WINS strategy forces local update',
      }
    }
    return {
      action: 'DISCARD_LOCAL',
      reason: 'Entity no longer exists on server — discarding local update',
    }
  }

  if (!isConflict) {
    // Not a conflict — just retry if it was a transient error
    if (serverResponse.status >= 500) {
      return { action: 'RETRY', reason: 'Server error — will retry' }
    }
    return { action: 'APPLY_LOCAL', reason: 'No conflict detected' }
  }

  // Actual 409 conflict resolution
  switch (strategy) {
    case 'LOCAL_WINS':
      return {
        action: 'APPLY_LOCAL',
        reason: 'LOCAL_WINS: local changes override server state',
      }

    case 'SERVER_WINS':
      return {
        action: 'DISCARD_LOCAL',
        reason: 'SERVER_WINS: server state is authoritative, discarding local change',
      }

    case 'LAST_WRITE_WINS': {
      if (!serverTimestamp) {
        // No server timestamp — default to LOCAL_WINS (optimistic)
        return { action: 'APPLY_LOCAL', reason: 'LAST_WRITE_WINS: no server timestamp, applying local' }
      }
      if (localTimestamp >= serverTimestamp) {
        return { action: 'APPLY_LOCAL', reason: `LAST_WRITE_WINS: local (${new Date(localTimestamp).toISOString()}) is newer than server (${new Date(serverTimestamp).toISOString()})` }
      }
      return { action: 'DISCARD_LOCAL', reason: `LAST_WRITE_WINS: server (${new Date(serverTimestamp).toISOString()}) is newer than local (${new Date(localTimestamp).toISOString()})` }
    }

    case 'MERGE': {
      const merged = mergeObjects(
        operation.body as Record<string, unknown> ?? {},
        serverResponse.body as Record<string, unknown> ?? {},
        localTimestamp,
        serverTimestamp
      )
      return { action: 'MERGE', mergedBody: merged, reason: 'MERGE: combined local and server fields' }
    }

    default:
      return { action: 'DISCARD_LOCAL', reason: 'Unknown strategy — defaulting to discard' }
  }
}

/**
 * Simple field-level merge: for each key, take the value from whichever
 * side was written more recently. Falls back to local if no timestamps.
 */
function mergeObjects(
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  localTs: number,
  serverTs?: number
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...server }
  const localIsNewer = !serverTs || localTs >= serverTs

  for (const key of Object.keys(local)) {
    // Skip internal/system fields — always keep server value
    if (['id', 'tenantId', 'createdAt', 'updatedAt', 'version'].includes(key)) continue
    if (localIsNewer) {
      merged[key] = local[key]
    }
  }

  return merged
}
