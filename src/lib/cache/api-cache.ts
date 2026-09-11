/**
 * In-memory API response cache with TTL
 * Dramatically reduces duplicate API calls during navigation
 */

interface CacheEntry {
  data: unknown
  timestamp: number
  ttl: number
}

const cache = new Map<string, CacheEntry>()

export const apiCache = {
  /**
   * Get cached data if still valid
   */
  get<T = unknown>(key: string): T | null {
    const entry = cache.get(key)
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age > entry.ttl) {
      cache.delete(key)
      return null
    }

    return entry.data as T
  },

  /**
   * Store data with TTL (time to live in ms)
   */
  set(key: string, data: unknown, ttl: number = 60000) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  },

  /**
   * Invalidate cache by key or pattern
   */
  invalidate(keyOrPattern: string) {
    if (keyOrPattern.includes('*')) {
      // Pattern matching
      const pattern = new RegExp(keyOrPattern.replace('*', '.*'))
      for (const key of cache.keys()) {
        if (pattern.test(key)) {
          cache.delete(key)
        }
      }
    } else {
      cache.delete(keyOrPattern)
    }
  },

  /**
   * Clear all cache
   */
  clear() {
    cache.clear()
  },

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: cache.size,
      keys: Array.from(cache.keys()),
    }
  },
}

/**
 * Fetch with automatic caching
 */
export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  ttl: number = 60000
): Promise<T> {
  const cacheKey = `${url}:${JSON.stringify(options)}`
  
  // Check cache first
  const cached = apiCache.get<T>(cacheKey)
  if (cached !== null) {
    return cached
  }

  // Fetch and cache
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  apiCache.set(cacheKey, data, ttl)
  
  return data as T
}
