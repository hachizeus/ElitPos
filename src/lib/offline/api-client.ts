/**
 * ElitPOS — Offline-Aware API Client
 *
 * Wraps the native fetch() to provide:
 *   1. Automatic offline detection (navigator.onLine + Electron IPC)
 *   2. Cache reads for GET requests when offline
 *   3. Queue writes for POST/PATCH/PUT/DELETE when offline (with optimistic IDs)
 *   4. Transparent replay on reconnect via SyncManager
 *   5. Response caching for future offline reads
 *
 * Usage: replace `fetch('/api/items', ...)` with `apiFetch('/api/items', ...)`
 * in hooks and server actions. The API surface is identical to fetch().
 */

'use client'

import { enqueue, getCachedEntity, getCachedList, cacheEntity } from './indexed-db-queue'
import { syncManager } from './sync-manager'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OfflineFetchOptions extends RequestInit {
  /** Entity type for cache keying (e.g. 'items', 'customers') */
  entityType?: string
  /** Entity ID for single-item cache keying */
  entityId?: string
  /** How long to cache this response (ms). Defaults to 5 minutes. */
  cacheTtl?: number
  /** Tenant ID (injected by useOfflineFetch hook) */
  tenantId?: string
  /** User ID (injected by useOfflineFetch hook) */
  userId?: string
  /** Don't enqueue on offline — throw instead */
  requireOnline?: boolean
  /** Optimistic data to return immediately while queuing */
  optimisticData?: unknown
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

function isMutatingMethod(method?: string): boolean {
  const m = (method ?? 'GET').toUpperCase()
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)
}

function extractEntityType(endpoint: string): string {
  // e.g. /api/items → 'items', /api/sales/123 → 'sales'
  const parts = endpoint.replace(/^\/api\//, '').split('/')
  return parts[0] ?? 'unknown'
}

function generateOptimisticId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function apiFetch(
  endpoint: string,
  options: OfflineFetchOptions = {}
): Promise<Response> {
  const {
    entityType = extractEntityType(endpoint),
    entityId,
    cacheTtl = 5 * 60 * 1000,
    tenantId,
    userId,
    requireOnline = false,
    optimisticData,
    ...fetchOptions
  } = options

  const method = (fetchOptions.method ?? 'GET').toUpperCase()
  const online = isOnline()

  // ── ONLINE PATH ────────────────────────────────────────────────────────────
  if (online) {
    try {
      const response = await fetch(endpoint, fetchOptions)

      // Cache successful GET responses for offline reads
      if (method === 'GET' && response.ok && tenantId) {
        const cloned = response.clone()
        cloned.json().then(data => {
          const items = Array.isArray(data) ? data : (data.data ?? data.items ?? null)
          if (items && Array.isArray(items)) {
            items.forEach(item => {
              if (item?.id) {
                cacheEntity(tenantId, entityType, item.id, item, cacheTtl).catch(() => {})
              }
            })
          } else if (entityId && data) {
            cacheEntity(tenantId, entityType, entityId, data, cacheTtl).catch(() => {})
          }
        }).catch(() => {})
      }

      return response
    } catch (err) {
      // Network error despite navigator.onLine — treat as offline
      console.warn(`[apiFetch] Network error on ${endpoint}:`, err)
      if (requireOnline) throw err
      // Fall through to offline handling
    }
  }

  // ── OFFLINE PATH ───────────────────────────────────────────────────────────

  if (requireOnline) {
    return new Response(
      JSON.stringify({ error: 'This feature requires an internet connection.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // GET: serve from cache
  if (method === 'GET' && tenantId) {
    // Single entity
    if (entityId) {
      const cached = await getCachedEntity(tenantId, entityType, entityId).catch(() => null)
      if (cached) {
        return jsonResponse(cached, 200, { 'X-Offline-Cache': 'true' })
      }
    }
    // List
    const cachedList = await getCachedList(tenantId, entityType).catch(() => [])
    if (cachedList.length > 0) {
      return jsonResponse(cachedList, 200, { 'X-Offline-Cache': 'true' })
    }

    return jsonResponse(
      { error: 'No cached data available. Please connect to the internet to load this data.' },
      503,
      { 'X-Offline-Cache': 'miss' }
    )
  }

  // POST/PATCH/PUT/DELETE: enqueue mutation
  if (isMutatingMethod(method) && tenantId && userId) {
    const optimisticId = generateOptimisticId()
    let body: unknown
    if (fetchOptions.body) {
      if (typeof fetchOptions.body === 'string') {
        try {
          body = JSON.parse(fetchOptions.body)
        } catch {
          // Body wasn't valid JSON — store as-is
          body = fetchOptions.body
        }
      } else {
        body = fetchOptions.body
      }
    }

    await enqueue({
      tenantId,
      userId,
      method: method as 'POST' | 'PATCH' | 'PUT' | 'DELETE',
      endpoint,
      body,
      entityType,
      entityId: entityId ?? optimisticId,
      optimisticId,
    })

    console.log(`[apiFetch] Queued offline: ${method} ${endpoint}`)

    // Return optimistic response
    const optimistic = optimisticData ?? (method === 'DELETE'
      ? null
      : { ...(body as object ?? {}), id: entityId ?? optimisticId, _offline: true })

    return jsonResponse(optimistic, method === 'POST' ? 201 : 200, {
      'X-Offline-Queue': 'true',
      'X-Optimistic-Id': optimisticId,
    })
  }

  // Fallback — return a service-unavailable response
  return jsonResponse(
    { error: 'You are offline. Please check your connection.' },
    503
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * Hook that returns a pre-configured apiFetch with tenant/user context injected.
 * Use this in components instead of calling apiFetch directly.
 *
 * Usage:
 *   const offlineFetch = useOfflineFetch()
 *   const res = await offlineFetch('/api/items', { method: 'GET', entityType: 'items' })
 */
export function useOfflineFetch() {
  // Lazy import to avoid server-side issues with `use client` hooks
  // The actual hook body is in src/hooks/useOfflineFetch.ts
  // This re-export exists for convenience
  throw new Error('Import useOfflineFetch from @/hooks/useOfflineFetch instead')
}
