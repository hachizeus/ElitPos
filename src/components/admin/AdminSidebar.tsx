'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, Layers, ScrollText,
  AlertTriangle, Tag, MessageSquare, Bell, Settings, Mail,
  ChevronLeft, ChevronRight, Shield, LogOut, Menu, X,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',     href: '/sys-control',               icon: LayoutDashboard, exact: true },
  { label: 'Users',         href: '/sys-control/users',         icon: Users },
  { label: 'Payments',      href: '/sys-control/payments',      icon: CreditCard },
  { label: 'Subscriptions', href: '/sys-control/subscriptions', icon: Layers },
  { label: 'Audit Logs',    href: '/sys-control/audit-logs',    icon: ScrollText },
  { label: 'Error Logs',    href: '/sys-control/error-logs',    icon: AlertTriangle },
  { label: 'Pricing',       href: '/sys-control/pricing',       icon: Tag },
  { label: 'Messages',      href: '/sys-control/messages',      icon: MessageSquare },
  { label: 'Notifications', href: '/sys-control/notifications', icon: Bell },
  { label: 'Settings',      href: '/sys-control/settings',      icon: Settings },
  { label: 'Send Email',    href: '/sys-control/send-email',    icon: Mail },
]

const STORAGE_KEY  = 'admin-sidebar-collapsed'
const EXPANDED_W   = 224  // w-56
const COLLAPSED_W  = 68

interface AdminSidebarProps {
  adminEmail?: string
  /** Callback so the layout can re-flow when width changes */
  onWidthChange?: (w: number) => void
}

export function AdminSidebar({ adminEmail, onWidthChange }: AdminSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) === 'true'
    setCollapsed(stored)
    setMounted(true)
    onWidthChange?.(stored ? COLLAPSED_W : EXPANDED_W)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      onWidthChange?.(next ? COLLAPSED_W : EXPANDED_W)
      return next
    })
  }, [onWidthChange])

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const isActive = (item: (typeof NAV_ITEMS)[0]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')

  // Don't render collapsed state until after hydration to avoid flash
  const isCollapsed = mounted && collapsed

  /* ── Shared nav content ─────────────────────────────────── */
  const NavContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-[#00FF88]/10 flex-shrink-0 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-[#00FF88] rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#00FF88]/20">
          <Shield className="w-4 h-4 text-gray-900" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden min-w-0">
            <p className="text-white font-bold text-sm leading-none truncate">ElitPOS</p>
            <p className="text-[#00FF88] text-xs mt-0.5">Admin Panel</p>
          </div>
        )}
      </div>

      {/* Nav items — scrollable if too many */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${active
                  ? 'bg-[#00FF88]/15 text-[#00FF88]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#00FF88] rounded-r-full" />
              )}
              <item.icon className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? 'text-[#00FF88]' : 'text-gray-500 group-hover:text-gray-300'}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}

              {/* Tooltip when collapsed */}
              {isCollapsed && (
                <span className="
                  pointer-events-none absolute left-full ml-3 z-50
                  px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-md
                  shadow-lg border border-gray-700 whitespace-nowrap
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150
                ">
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#00FF88]/10 p-3 flex-shrink-0">
        {!isCollapsed && adminEmail && (
          <p className="px-3 py-1.5 text-xs text-gray-500 truncate mb-1">{adminEmail}</p>
        )}
        <form action="/api/sys-control/auth/logout" method="POST">
          <button
            type="submit"
            title={isCollapsed ? 'Logout' : undefined}
            className={`
              group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0 group-hover:text-red-400 transition-colors" />
            {!isCollapsed && <span>Logout</span>}
            {isCollapsed && (
              <span className="
                pointer-events-none absolute left-full ml-3 z-50
                px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-md
                shadow-lg border border-gray-700 whitespace-nowrap
                opacity-0 group-hover:opacity-100 transition-opacity duration-150
              ">Logout</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobile: hamburger button ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-4 z-50 w-9 h-9 bg-gray-900 border border-gray-700
          rounded-lg flex items-center justify-center text-gray-300 hover:text-white
          hover:border-[#00FF88]/40 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Mobile: backdrop ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: drawer ── */}
      <aside className={`
        lg:hidden fixed top-0 left-0 h-full w-64 z-50 bg-gray-950
        border-r border-[#00FF88]/10 shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center
            text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
        <NavContent />
      </aside>

      {/* ── Desktop: in-flow sidebar (sticky, not fixed) ── */}
      {/* Sits inside the CSS Grid column defined by the layout.
          sticky + h-screen means it stays put while the content column scrolls. */}
      <aside
        className={`
          hidden lg:flex flex-col
          sticky top-0 h-screen flex-shrink-0
          bg-gray-950 border-r border-[#00FF88]/10
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[68px]' : 'w-56'}
        `}
      >
        <NavContent />

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="
            absolute -right-3 top-[72px]
            w-6 h-6 bg-gray-800 border border-gray-700 rounded-full
            flex items-center justify-center z-10
            text-gray-400 hover:text-[#00FF88] hover:border-[#00FF88]/50
            transition-colors duration-150
          "
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>
    </>
  )
}
