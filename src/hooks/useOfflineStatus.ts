/**
 * ElitPOS — useOfflineStatus hook
 *
 * Tracks online/offline state and pending sync queue size.
 * Works in browser, Capacitor, and Electron environments.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { syncManager, type SyncEvent, type SyncStatus } from '@/lib/offline/sync-manager'
import { getPendingCount } from '@/lib/offline/indexed-db-queue'
import { useSession } from 'next-auth/react'

export interface OfflineStatusState {
  isOnline: boolean
  isElectron: boolean
  isCapacitor: boolean
  syncStatus: SyncStatus
  pendingCount: number
  lastSyncedAt: Date | null
  lastSyncErrors: string[]
  triggerSync: () => Promise<void>
}

// Detect runtime environment
function detectRuntime(): { isElectron: boolean; isCapacitor: boolean } {
  if (typeof window === 'undefined') return { isElectron: false, isCapacitor: false }
  const w = window as Window & { electronAPI?: unknown; Capacitor?: { isNativePlatform?: () => boolean } }
  return {
    isElectron: !!w.electronAPI,
    isCapacitor: !!(w.Capacitor?.isNativePlatform?.()),
  }
}

export function useOfflineStatus(): OfflineStatusState {
  const { data: session } = useSession()
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [lastSyncErrors, setLastSyncErrors] = useState<string[]>([])
  const { isElectron, isCapacitor } = detectRuntime()

  // Refresh pending count
  const refreshPendingCount = useCallback(async () => {
    if (!session?.user?.tenantId) return
    try {
      const count = await getPendingCount(session.user.tenantId)
      setPendingCount(count)
    } catch { /* ignore */ }
  }, [session?.user?.tenantId])

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    await syncManager.sync()
  }, [])

  useEffect(() => {
    // Browser online/offline events
    const handleOnline = () => {
      setIsOnline(true)
      // Trigger queue flush immediately when browser comes back online
      syncManager.sync().catch(console.error)
    }
    const handleOffline = () => setIsOnline(false)

    // SW Background Sync path: fires even when tab was closed and reopened
    // (Chrome only, but gracefully ignored elsewhere)
    const handleSWSync = () => {
      setIsOnline(true)
      syncManager.sync().catch(console.error)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('sw:sync-queue', handleSWSync)

    // Electron network events
    const w = window as Window & { electronAPI?: { onNetworkChange?: (cb: (s: { isOnline: boolean }) => void) => (() => void) } }
    let cleanupElectron: (() => void) | undefined
    if (w.electronAPI?.onNetworkChange) {
      cleanupElectron = w.electronAPI.onNetworkChange(({ isOnline: online }) => {
        setIsOnline(online)
      })
    }

    // Capacitor Network plugin
    let cleanupCapacitor: (() => void) | undefined
    const capWindow = window as Window & { Capacitor?: { Plugins?: { Network?: { addListener?: (event: string, cb: (s: { connected: boolean }) => void) => Promise<{ remove: () => void }> } } } }
    const networkPlugin = capWindow.Capacitor?.Plugins?.Network
    if (networkPlugin?.addListener) {
      networkPlugin.addListener('networkStatusChange', (status: { connected: boolean }) => {
        setIsOnline(status.connected)
      }).then(handle => {
        cleanupCapacitor = () => handle.remove()
      }).catch(() => {})
    }

    // SyncManager events
    const unsubscribe = syncManager.subscribe((event: SyncEvent) => {
      setSyncStatus(event.status)
      setLastSyncErrors(event.errors)
      if (event.status === 'success' || event.status === 'error') {
        setLastSyncedAt(new Date())
        refreshPendingCount()
      }
    })

    // Initial pending count
    refreshPendingCount()

    // Poll pending count every 30s
    const pollInterval = setInterval(refreshPendingCount, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('sw:sync-queue', handleSWSync)
      cleanupElectron?.()
      cleanupCapacitor?.()
      unsubscribe()
      clearInterval(pollInterval)
    }
  }, [refreshPendingCount])

  return {
    isOnline,
    isElectron,
    isCapacitor,
    syncStatus,
    pendingCount,
    lastSyncedAt,
    lastSyncErrors,
    triggerSync,
  }
}
