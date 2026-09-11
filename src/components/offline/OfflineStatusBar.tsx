'use client'

import { useEffect, useState, useRef } from 'react'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'

/**
 * ElitPOS — Offline Status Bar + Reconnect Toast
 *
 * Two behaviours in one component:
 *
 * 1. INLINE BANNER — renders below StorageBanner in the main content area.
 *    Visible only when offline or syncing. Pushes content down (no overlay).
 *    Amber when offline, blue when syncing, red on error.
 *
 * 2. RECONNECT TOAST — a floating notification that slides in from the top-right
 *    when the connection is restored. Shows "Back online" or "N changes synced".
 *    Auto-dismisses after 4 seconds.
 *
 * The Navbar's ConnectionDot handles the always-visible dot indicator.
 */

export function OfflineStatusBar() {
  const {
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncedAt,
    lastSyncErrors,
    triggerSync,
  } = useOfflineStatus()

  // Track previous online state to detect transitions
  const prevOnlineRef = useRef<boolean | null>(null)
  const [toast, setToast] = useState<{
    visible: boolean
    message: string
    type: 'success' | 'error'
  }>({ visible: false, message: '', type: 'success' })

  // Fire toast on online/offline transitions
  useEffect(() => {
    if (prevOnlineRef.current === null) {
      // First render — don't show a toast, just record state
      prevOnlineRef.current = isOnline
      return
    }

    const wasOffline = prevOnlineRef.current === false
    prevOnlineRef.current = isOnline

    if (isOnline && wasOffline) {
      // Just came back online
      setToast({
        visible: true,
        message: pendingCount > 0
          ? `Back online — syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}…`
          : 'Back online',
        type: 'success',
      })
    }
  }, [isOnline, pendingCount])

  // Show "synced" toast when sync completes
  useEffect(() => {
    if (syncStatus === 'success' && lastSyncedAt) {
      setToast({
        visible: true,
        message: 'All changes synced ✓',
        type: 'success',
      })
    } else if (syncStatus === 'error' && lastSyncErrors.length > 0) {
      setToast({
        visible: true,
        message: `Sync failed — ${lastSyncErrors[0]}`,
        type: 'error',
      })
    }
  }, [syncStatus, lastSyncedAt, lastSyncErrors])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast.visible) return
    const t = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000)
    return () => clearTimeout(t)
  }, [toast.visible, toast.message])

  return (
    <>
      {/* ── Inline banner (only visible when offline / syncing / error) ─── */}
      {(!isOnline || syncStatus === 'syncing' || syncStatus === 'error') && (
        <div
          role="status"
          aria-live="assertive"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: 1.4,
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            background: syncStatus === 'syncing'
              ? '#1d4ed8'
              : syncStatus === 'error'
                ? '#b91c1c'
                : '#b45309',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isOnline && <WifiOff size={14} />}
            {syncStatus === 'syncing' && (
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            <span>
              {syncStatus === 'syncing'
                ? `Syncing ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}…`
                : syncStatus === 'error'
                  ? `Sync failed: ${lastSyncErrors[0] ?? 'unknown error'}`
                  : pendingCount > 0
                    ? `Offline · ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued`
                    : 'You are offline'}
            </span>
          </div>

          {(syncStatus === 'error' || (isOnline && pendingCount > 0)) && (
            <button
              onClick={triggerSync}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '4px',
                padding: '2px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Reconnect / sync toast (top-right, auto-dismiss) ──────────── */}
      {toast.visible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '68px',       // below the Navbar
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            background: toast.type === 'success' ? '#15803d' : '#b91c1c',
            color: '#ffffff',
            animation: 'slideInRight 0.25s ease-out',
            maxWidth: '320px',
            cursor: 'pointer',
          }}
          onClick={() => setToast(prev => ({ ...prev, visible: false }))}
        >
          {toast.type === 'success' && <CheckCircle size={15} />}
          {toast.type === 'error' && <WifiOff size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
