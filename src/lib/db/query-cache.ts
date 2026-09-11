/**
 * Database query result caching
 * Reduces redundant database queries for frequently accessed data
 */

interface QueryCacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const queryCache = new Map<string, QueryCacheEntry<unknown>>()

// Auto-cleanup every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of queryCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      queryCache.delete(key)
    }
  }
}, 60000)

export const dbCache = {
  /**
   * Get cached query result
   */
  get<T>(key: string): T | null {
    const entry = queryCache.get(key) as QueryCacheEntry<T> | undefined
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age > entry.ttl) {
      queryCache.delete(key)
      return null
    }

    return entry.data
  },

  /**
   * Store query result with TTL
   */
  set<T>(key: string, data: T, ttl: number = 60000) {
    queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  },

  /**
   * Invalidate by key pattern
   */
  invalidate(pattern: string) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      for (const key of queryCache.keys()) {
        if (regex.test(key)) {
          queryCache.delete(key)
        }
      }
    } else {
      queryCache.delete(pattern)
    }
  },

  /**
   * Execute query with caching
   */
  async query<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = 60000
  ): Promise<T> {
    // Check cache
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute query
    const result = await queryFn()
    
    // Cache result
    this.set(key, result, ttl)
    
    return result
  },

  /**
   * Clear all cache
   */
  clear() {
    queryCache.clear()
  },

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: queryCache.size,
      entries: queryCache.size,
    }
  },
}

/**
 * Common cache TTLs for different data types
 */
export const CacheTTL = {
  /** Static reference data (categories, tax templates) */
  REFERENCE: 300000, // 5 minutes
  
  /** User/account data */
  USER: 180000, // 3 minutes
  
  /** Tenant/company settings */
  SETTINGS: 300000, // 5 minutes
  
  /** Module access configuration */
  MODULE_ACCESS: 300000, // 5 minutes
  
  /** Frequently changing data (items, stock) */
  DYNAMIC: 30000, // 30 seconds
  
  /** Real-time data (notifications, messages) */
  REALTIME: 10000, // 10 seconds
}
