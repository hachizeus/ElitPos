/**
 * ElitPOS — IndexedDB Offline Mutation Queue
 *
 * Stores pending API mutations (POST, PATCH, DELETE) when offline.
 * On reconnect the SyncManager replays them against the server.
 */

export interface QueuedOperation {
  id?: number
  tenantId: string
  userId: string
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  endpoint: string
  body?: unknown
  headers?: Record<string, string>
  optimisticId?: string
  entityType?: string
  entityId?: string
  createdAt: number
  attempts: number
  lastError?: string
}

const DB_NAME = 'elitpos-offline'
const DB_VERSION = 1
const QUEUE_STORE = 'mutation_queue'
const SYNC_STATE_STORE = 'sync_state'
const CACHE_STORE = 'entity_cache'

let _db: IDBDatabase | null = null

// ── DB init ───────────────────────────────────────────────────────────────────

export function openOfflineDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('tenantId', 'tenantId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }

      if (!db.objectStoreNames.contains(SYNC_STATE_STORE)) {
        db.createObjectStore(SYNC_STATE_STORE, { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const cache = db.createObjectStore(CACHE_STORE, { keyPath: 'cacheKey' })
        cache.createIndex('entityType', 'entityType', { unique: false })
        cache.createIndex('tenantId', 'tenantId', { unique: false })
        cache.createIndex('expiresAt', 'expiresAt', { unique: false })
      }
    }

    request.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db) }
    request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error)
  })
}

// ── Queue helpers ─────────────────────────────────────────────────────────────

export async function enqueue(op: Omit<QueuedOperation, 'id' | 'attempts' | 'createdAt'>): Promise<number> {
  const db = await openOfflineDb()
  const entry = { ...op, attempts: 0, createdAt: Date.now() }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    const req = tx.objectStore(QUEUE_STORE).add(entry)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingOps(tenantId: string): Promise<QueuedOperation[]> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const req = tx.objectStore(QUEUE_STORE).index('tenantId').getAll(tenantId)
    req.onsuccess = () =>
      resolve((req.result as QueuedOperation[]).sort((a, b) => a.createdAt - b.createdAt))
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingCount(tenantId: string): Promise<number> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const req = tx.objectStore(QUEUE_STORE).index('tenantId').count(tenantId)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function markSynced(id: number): Promise<void> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, 'readwrite').objectStore(QUEUE_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function recordAttempt(id: number, error: string): Promise<void> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    const store = tx.objectStore(QUEUE_STORE)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const op = getReq.result as QueuedOperation
      if (!op) { resolve(); return }
      op.attempts += 1; op.lastError = error
      const putReq = store.put(op)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function discardOp(id: number): Promise<void> { return markSynced(id) }

export async function clearQueue(tenantId: string): Promise<void> {
  const ops = await getPendingOps(tenantId)
  await Promise.all(ops.map(op => op.id !== undefined ? markSynced(op.id) : Promise.resolve()))
}

// ── Entity cache ──────────────────────────────────────────────────────────────

interface CacheEntry {
  cacheKey: string
  entityType: string
  tenantId: string
  data: unknown
  fetchedAt: number
  expiresAt: number
}

export async function cacheEntity(
  tenantId: string, entityType: string, id: string,
  data: unknown, ttlMs = 5 * 60 * 1000
): Promise<void> {
  const db = await openOfflineDb()
  const entry: CacheEntry = {
    cacheKey: `${tenantId}:${entityType}:${id}`,
    entityType, tenantId, data,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  }
  return new Promise((resolve, reject) => {
    const req = db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getCachedEntity<T = unknown>(
  tenantId: string, entityType: string, id: string
): Promise<T | null> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(CACHE_STORE, 'readonly')
      .objectStore(CACHE_STORE).get(`${tenantId}:${entityType}:${id}`)
    req.onsuccess = () => {
      const e = req.result as CacheEntry | undefined
      resolve(!e || e.expiresAt < Date.now() ? null : (e.data as T))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getCachedList<T = unknown>(
  tenantId: string, entityType: string
): Promise<T[]> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(CACHE_STORE, 'readonly')
      .objectStore(CACHE_STORE).index('entityType').getAll(entityType)
    req.onsuccess = () =>
      resolve((req.result as CacheEntry[])
        .filter(e => e.tenantId === tenantId && e.expiresAt >= Date.now())
        .map(e => e.data as T))
    req.onerror = () => reject(req.error)
  })
}

// ── Sync state ────────────────────────────────────────────────────────────────

export async function getLastSynced(tenantId: string, entityType: string): Promise<Date | null> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(SYNC_STATE_STORE, 'readonly')
      .objectStore(SYNC_STATE_STORE).get(`${tenantId}:${entityType}`)
    req.onsuccess = () => {
      const e = req.result as { key: string; lastSynced: number } | undefined
      resolve(e ? new Date(e.lastSynced) : null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function setLastSynced(tenantId: string, entityType: string): Promise<void> {
  const db = await openOfflineDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(SYNC_STATE_STORE, 'readwrite')
      .objectStore(SYNC_STATE_STORE).put({ key: `${tenantId}:${entityType}`, lastSynced: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
