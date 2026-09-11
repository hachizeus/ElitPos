'use client'

import { useState, useEffect } from 'react'

export interface ModuleAccessEntry {
  moduleKey: string
  role: string
  isEnabled: boolean
}

// Client-side cache with 5-minute TTL
let cachedEntries: ModuleAccessEntry[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 300000 // 5 minutes

/**
 * Fetches module access configuration for the current tenant.
 * Returns a lookup function: isModuleEnabled(moduleKey, role) => boolean
 * Defaults to true (enabled) if no row exists.
 * On network error, defaults to false (fail-closed) to prevent unauthorized access.
 * 
 * **Optimized:** Uses 5-minute client-side cache to avoid repeated API calls
 */
export function useModuleAccess() {
  const [entries, setEntries] = useState<ModuleAccessEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Check cache first
      const now = Date.now()
      if (cachedEntries && (now - cacheTimestamp) < CACHE_TTL) {
        if (!cancelled) {
          setEntries(cachedEntries)
          setLoaded(true)
          setLoadError(false)
        }
        return
      }

      try {
        const res = await fetch('/api/module-access')
        if (res.ok) {
          const data = await res.json()
          const moduleEntries = Array.isArray(data) ? data : data.data || []
          
          // Update cache
          cachedEntries = moduleEntries
          cacheTimestamp = now
          
          if (!cancelled) {
            setEntries(moduleEntries)
            setLoadError(false)
          }
        } else {
          if (!cancelled) setLoadError(true)
        }
      } catch {
        // Network error — mark as failed so isModuleEnabled can fail-closed
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function isModuleEnabled(moduleKey: string, role?: string): boolean {
    // Still loading — allow access temporarily to avoid UI flicker
    if (!loaded) return true
    // Load error — fail-closed: deny access to prevent unauthorized module access
    if (loadError) return false
    if (!role || entries.length === 0) return true
    const entry = entries.find((e) => e.moduleKey === moduleKey && e.role === role)
    // No row means default enabled
    if (!entry) return true
    return entry.isEnabled
  }

  return { isModuleEnabled, loaded, loadError }
}

// Export function to manually clear cache (useful after settings changes)
export function clearModuleAccessCache() {
  cachedEntries = null
  cacheTimestamp = 0
}
