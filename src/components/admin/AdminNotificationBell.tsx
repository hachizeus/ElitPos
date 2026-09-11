'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, CreditCard, Building2, CheckCircle, XCircle, Info } from 'lucide-react'
import Link from 'next/link'

interface AdminNotification {
  id: string
  type: 'payment' | 'new_company' | 'approval' | 'rejection' | 'system'
  title: string
  message: string
  link: string
  createdAt: string
  read: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function NotifIcon({ type }: { type: AdminNotification['type'] }) {
  const base = 'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0'
  if (type === 'payment')     return <div className={`${base} bg-green-900/40`}><CreditCard  className="w-4 h-4 text-green-400" /></div>
  if (type === 'new_company') return <div className={`${base} bg-blue-900/40`}><Building2   className="w-4 h-4 text-blue-400"  /></div>
  if (type === 'approval')    return <div className={`${base} bg-emerald-900/40`}><CheckCircle className="w-4 h-4 text-emerald-400"/></div>
  if (type === 'rejection')   return <div className={`${base} bg-red-900/40`}><XCircle     className="w-4 h-4 text-red-400"   /></div>
  return                             <div className={`${base} bg-gray-800`}><Info       className="w-4 h-4 text-gray-400"  /></div>
}

export function AdminNotificationBell() {
  const [open, setOpen]           = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unread, setUnread]       = useState(0)
  const [loading, setLoading]     = useState(false)
  const prevUnread                = useRef(0)
  const dropdownRef               = useRef<HTMLDivElement>(null)
  const audioCtxRef               = useRef<AudioContext | null>(null)

  // ── Notification sound (Web Audio API — no file needed) ─────────────────
  const playSound = useCallback(() => {
    try {
      const ctx = audioCtxRef.current || new AudioContext()
      audioCtxRef.current = ctx

      // Two-tone chime: 880 Hz then 1100 Hz
      const playTone = (freq: number, startAt: number, duration: number) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, ctx.currentTime + startAt)
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration)
        osc.start(ctx.currentTime + startAt)
        osc.stop(ctx.currentTime + startAt + duration)
      }
      playTone(880,  0,    0.22)
      playTone(1100, 0.18, 0.28)
    } catch {
      // Audio blocked — silent fallback
    }
  }, [])

  // ── Fetch notifications ──────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/sys-control/notifications', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { notifications: AdminNotification[]; unreadCount: number }
        setNotifications(data.notifications)
        const newUnread = data.unreadCount
        // Play sound if unread count increased
        if (newUnread > prevUnread.current && prevUnread.current !== -1) {
          playSound()
        }
        prevUnread.current = newUnread
        setUnread(newUnread)
      }
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false) }
  }, [playSound])

  // Poll every 30 seconds
  useEffect(() => {
    prevUnread.current = -1 // suppress sound on first load
    fetchNotifications()
    prevUnread.current = 0  // enable sound after first load
    const id = setInterval(() => fetchNotifications(true), 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // After first fetch settles, enable sound for future polls
  useEffect(() => {
    const t = setTimeout(() => { prevUnread.current = unread }, 2000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Mark all read ────────────────────────────────────────────────────────
  const markAllRead = async () => {
    await fetch('/api/sys-control/notifications', { method: 'POST' })
    setNotifications(n => n.map(x => ({ ...x, read: true })))
    setUnread(0)
    prevUnread.current = 0
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); if (!open) fetchNotifications() }}
        className="relative p-2 rounded-lg text-gray-400 hover:text-[#00FF88] hover:bg-gray-800 transition-colors"
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5
            bg-red-500 text-white text-[10px] font-bold rounded-full
            flex items-center justify-center leading-none pointer-events-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-16px)]
          bg-gray-900 border border-gray-700/60 rounded-xl shadow-2xl z-50 overflow-hidden
          animate-in fade-in slide-in-from-top-2 duration-150">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
            <span className="font-semibold text-white text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#00FF88] transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-0.5 text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[420px]">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-500 text-sm gap-2">
                <div className="w-4 h-4 border-2 border-gray-700 border-t-[#00FF88] rounded-full animate-spin" />
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications
              </div>
            ) : (
              <ul>
                {notifications.map(n => (
                  <li key={n.id}>
                    <Link
                      href={n.link}
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800/60 last:border-0 ${
                        !n.read ? 'bg-gray-800/40' : ''
                      }`}
                    >
                      <NotifIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-tight ${!n.read ? 'text-white' : 'text-gray-300'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-gray-500 flex-shrink-0 mt-0.5">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-[#00FF88] flex-shrink-0 mt-1.5" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-700/60 px-4 py-2.5">
            <Link
              href="/sys-control/payments"
              onClick={() => setOpen(false)}
              className="text-xs text-[#00FF88]/70 hover:text-[#00FF88] transition-colors"
            >
              View all payments →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
