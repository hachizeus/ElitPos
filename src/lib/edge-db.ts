// Lightweight HTTP-based database client for Edge Runtime
// Uses Next.js fetch caching so tenant lookups are served from the
// Data Cache instead of hitting the DB on every request.
import { TenantCache } from './cache/tenant-cache'

export class EdgeDB {
  private cache: TenantCache

  constructor() {
    this.cache = new TenantCache()
  }

  async getTenantBySlug(slug: string): Promise<{id: string, slug: string} | null> {
    // 1. Check in-memory cache — fresh window (online: skip network fetch entirely)
    if (this.cache.isFresh(slug)) {
      const cached = this.cache.get(slug)
      if (cached) {
        if (cached.id === '__not_found__') return null
        return cached
      }
    }

    // 2. Fetch via internal API route — Next.js Data Cache (revalidate: 300s)
    //    deduplicates this across all concurrent requests to the same slug,
    //    so only ONE outbound DB query fires per 5-minute window per worker.
    try {
      const baseUrl = process.env.NEXTAUTH_URL_INTERNAL || 'http://localhost:3000'
      const response = await fetch(
        `${baseUrl}/api/lookup-tenant?slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            'x-internal-secret': process.env.NEXTAUTH_SECRET || '',
          },
          // Next.js Data Cache: responses are cached for 5 minutes across all
          // requests in this worker. Shared across concurrent requests with
          // the same URL (automatic deduplication).
          next: { revalidate: 300 },
          signal: AbortSignal.timeout(3000), // reduced from 5s → 3s for faster fail
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.tenant) {
          // Also populate in-memory cache to skip even the Data Cache lookup
          this.cache.set(slug, data.tenant)
          return data.tenant
        } else {
          // Tenant not found — cache null result briefly to avoid hammering
          // the lookup for invalid subdomains (e.g. bot probes)
          this.cache.set(slug, { id: '__not_found__', slug } as {id: string, slug: string})
          return null
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('timeout') || msg.includes('aborted')) {
        console.warn(`[EdgeDB] Tenant lookup timeout for slug="${slug}"`)
      } else {
        console.error(`[EdgeDB] Tenant lookup failed for slug="${slug}":`, msg)
      }

      // ── Offline / network failure fallback ───────────────────────────────
      // If the lookup failed due to a network error (offline mode, server
      // still starting up) and we previously cached this slug in-memory,
      // return the stale cached value so the middleware can still route the
      // request instead of sending the user to an error page.
      // The JWT validation inside the page layout will still enforce auth.
      const stale = this.cache.get(slug)
      if (stale && stale.id !== '__not_found__') {
        console.warn(`[EdgeDB] Using stale cache for slug="${slug}" (offline fallback)`)
        return stale
      }

      return null
    }

    return null
  }
}

export const edgeDb = new EdgeDB()