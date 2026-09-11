/**
 * Server-side response cache for API routes
 * Reduces database queries for frequently accessed data
 */

import { NextResponse } from 'next/server'

interface ServerCacheEntry {
  response: Response
  timestamp: number
  ttl: number
}

const serverCache = new Map<string, ServerCacheEntry>()

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of serverCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      serverCache.delete(key)
    }
  }
}, 60000)

export interface CacheOptions {
  /** Cache key (defaults to request URL) */
  key?: string
  /** Time to live in milliseconds (default: 60000 = 1 minute) */
  ttl?: number
  /** Cache tags for bulk invalidation */
  tags?: string[]
}

/**
 * Wrap API route handler with caching
 */
export function withCache<T>(
  handler: () => Promise<NextResponse<T>>,
  options: CacheOptions = {}
) {
  return async (): Promise<NextResponse<T>> => {
    const { key = 'default', ttl = 60000, tags = [] } = options
    
    // Check cache
    const cached = serverCache.get(key)
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < ttl) {
        // Clone the response to avoid reuse issues
        return cached.response.clone() as NextResponse<T>
      }
      serverCache.delete(key)
    }

    // Execute handler
    const response = await handler()
    
    // Cache successful responses only
    if (response.status >= 200 && response.status < 300) {
      serverCache.set(key, {
        response: response.clone(),
        timestamp: Date.now(),
        ttl,
      })
      
      // Store tags for invalidation
      for (const tag of tags) {
        const tagKey = `tag:${tag}`
        const existing = serverCache.get(tagKey)
        const keys = existing ? (existing.response as unknown as string[]) : []
        keys.push(key)
        serverCache.set(tagKey, {
          response: keys as unknown as Response,
          timestamp: Date.now(),
          ttl: Infinity,
        })
      }
    }

    return response
  }
}

/**
 * Invalidate cache by key or tag
 */
export function invalidateCache(keyOrTag: string) {
  if (keyOrTag.startsWith('tag:')) {
    // Invalidate by tag
    const tag = keyOrTag.slice(4)
    const tagKey = `tag:${tag}`
    const entry = serverCache.get(tagKey)
    if (entry) {
      const keys = entry.response as unknown as string[]
      for (const key of keys) {
        serverCache.delete(key)
      }
      serverCache.delete(tagKey)
    }
  } else {
    // Direct key invalidation
    serverCache.delete(keyOrTag)
  }
}

/**
 * Clear all server cache
 */
export function clearServerCache() {
  serverCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: serverCache.size,
    entries: Array.from(serverCache.keys()).filter(k => !k.startsWith('tag:')),
    tags: Array.from(serverCache.keys()).filter(k => k.startsWith('tag:')),
  }
}
