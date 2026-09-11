'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

/**
 * NetworkStatusBadge
 *
 * Always-visible network status indicator in the Navbar.
 *
 * Online:  Small green Wifi icon (no text — minimal footprint)
 * Offline: Amber pill with WifiOff icon + "Offline" text
 * Reconnected: Brief green "Back online" pill for 3.5s, then back to icon
 */
export function NetworkStatusBadge() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const handleOnline = () => {
      setIsOnline(true)
      setShowBackOnline(true)
      timer = setTimeout(() => setShowBackOnline(false), 3500)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setShowBackOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(timer)
    }
  }, [])

  // ── Reconnected flash ────────────────────────────────────────────────────
  if (showBackOnline) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all"
        style={{
          background: 'rgba(21,128,61,0.18)',
          color: '#4ade80',
          border: '1px solid rgba(74,222,128,0.35)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        title="Connection restored"
      >
        <Wifi size={11} />
        <span>Back online</span>
      </div>
    )
  }

  // ── Offline pill ─────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          background: 'rgba(180,83,9,0.22)',
          color: '#fbbf24',
          border: '1px solid rgba(251,191,36,0.4)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        title="No internet connection"
      >
        <WifiOff size={11} />
        <span>Offline</span>
      </div>
    )
  }

  // ── Online — always show a subtle green wifi icon ────────────────────────
  return (
    <div
      title="Connected"
      className="flex items-center justify-center w-6 h-6 rounded-md transition-colors"
      style={{ color: 'rgba(74,222,128,0.7)' }}
    >
      <Wifi size={14} />
    </div>
  )
}
