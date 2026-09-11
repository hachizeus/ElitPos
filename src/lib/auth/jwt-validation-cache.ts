/**
 * Server-side JWT validation cache.
 *
 * The NextAuth JWT callback fires on EVERY request that calls auth() / getServerSession().
 * Without this cache, every API request hits the DB twice:
 *   1. db.query.tenants.findFirst  (is tenant still active?)
 *   2. withTenant → db.query.users.findFirst  (is user still active?)
 *
 * This cache stores the result of those two checks keyed by (tenantId + userId)
 * with a 60-second TTL. Within the TTL window the DB is not queried at all.
 *
 * Security properties preserved:
 * - Cache is invalidated immediately when a user is deactivated or a password changes
 *   via invalidateJwtCache(tenantId, userId).
 * - If the DB returns invalid/inactive, that result is cached too (fast-reject).
 * - Cache is process-local — a restart or new deployment clears it, triggering one
 *   fresh DB round-trip per user on the first request.
 */

const CACHE_TTL_MS = 60 * 1000 // 60 seconds

interface ValidationEntry {
  valid: boolean
  logoUrl?: string
  aiEnabled: boolean
  /** Unix seconds of password change (for invalidation comparison) */
  passwordChangedAtSec?: number
  cachedAt: number
}

const cache = new Map<string, ValidationEntry>()

function cacheKey(tenantId: string, userId: string) {
  return `${tenantId}:${userId}`
}

/** Get a cached validation result. Returns undefined on cache miss or expiry. */
export function getCachedValidation(
  tenantId: string,
  userId: string
): ValidationEntry | undefined {
  const key = cacheKey(tenantId, userId)
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return entry
}

/** Store a validation result in the cache. */
export function setCachedValidation(
  tenantId: string,
  userId: string,
  entry: Omit<ValidationEntry, 'cachedAt'>
): void {
  cache.set(cacheKey(tenantId, userId), { ...entry, cachedAt: Date.now() })
}

/**
 * Invalidate the cache for a specific user. Call this after:
 * - User is deactivated
 * - Password is changed
 * - Tenant status changes
 */
export function invalidateJwtCache(tenantId: string, userId?: string): void {
  if (userId) {
    cache.delete(cacheKey(tenantId, userId))
  } else {
    // Invalidate all users for this tenant
    for (const key of cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        cache.delete(key)
      }
    }
  }
}

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      cache.delete(key)
    }
  }
}, 5 * 60 * 1000) // clean every 5 minutes
