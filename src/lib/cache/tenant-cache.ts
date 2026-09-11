// In-memory cache with TTL for Edge Runtime
// In production, this would be backed by Redis or similar

export class TenantCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache = new Map<string, { data: any; expires: number; storedAt: number }>()
  private ttl = 5 * 60 * 1000         // 5 minutes — fresh window (online use)
  private staleTtl = 24 * 60 * 60 * 1000 // 24 hours — stale-but-usable window (offline fallback)

  /**
   * Get a cached tenant.
   * Returns null if the entry doesn't exist or is past the stale TTL.
   */
  get(slug: string): { id: string; slug: string } | null {
    const entry = this.cache.get(slug)
    if (!entry) return null

    // Past the absolute stale TTL — remove and reject
    if (Date.now() > entry.storedAt + this.staleTtl) {
      this.cache.delete(slug)
      return null
    }

    return entry.data
  }

  /**
   * True if the entry exists AND is within the fresh TTL window.
   * Used by EdgeDB to decide whether to skip a network fetch.
   */
  isFresh(slug: string): boolean {
    const entry = this.cache.get(slug)
    if (!entry) return false
    return Date.now() <= entry.expires
  }

  set(slug: string, data: { id: string; slug: string }): void {
    const now = Date.now()
    this.cache.set(slug, {
      data,
      expires: now + this.ttl,
      storedAt: now,
    })
  }

  invalidate(slug: string): void {
    this.cache.delete(slug)
  }

  clear(): void {
    this.cache.clear()
  }
}
