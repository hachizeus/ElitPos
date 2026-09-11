'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  CreditCard,
  Users,
  Settings,
  BarChart3,
  Bell,
  MessageSquare,
  HelpCircle,
  FileText,
  Wallet,
  Banknote,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { formatCurrencyWithSymbol } from '@/lib/utils/currency'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION || ''

const navigation = [
  { name: 'Overview',  href: '/account',           icon: BarChart3,      exact: true },
  { name: 'Sites',     href: '/account/sites',      icon: Building2 },
  { name: 'Billing',   href: '/account/billing',    icon: CreditCard },
  { name: 'Plans',     href: '/account/plans',      icon: Sparkles },
  { name: 'Payments',  href: '/account/payments',   icon: Banknote },
  { name: 'Wallet',    href: '/account/wallet',      icon: Wallet },
  { name: 'Team',      href: '/account/team',        icon: Users },
  { name: 'Activity',  href: '/account/activity',   icon: FileText },
  { name: 'Settings',  href: '/account/settings',   icon: Settings },
]

const supportNavigation = [
  { name: 'Messages',      href: '/account/messages',      icon: MessageSquare },
  { name: 'Notifications', href: '/account/notifications', icon: Bell },
  { name: 'Support',       href: '/account/support',       icon: HelpCircle },
]

interface AccountSidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function AccountSidebar({ mobileOpen = false, onMobileClose }: AccountSidebarProps) {
  const pathname = usePathname()
  const [walletBalance, setWalletBalance] = useState(0)
  const [currency, setCurrency] = useState('KES')

  useEffect(() => { onMobileClose?.() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/account/wallet')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setWalletBalance(data.balance || 0)
          setCurrency(data.currency || 'KES')
        }
      })
      .catch(() => {})
  }, [])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname?.startsWith(href + '/')

  // ── Shared nav content ──────────────────────────────────────────────────────
  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* ── Main nav ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">

        {navigation.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onMobileClose}
              className={[
                'group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100',
                active
                  ? 'bg-[#00FF88]/10 text-[#00965c] dark:text-[#00FF88]'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={[
                  'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
                  active
                    ? 'bg-[#00FF88]/15 text-[#00965c] dark:text-[#00FF88]'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400',
                ].join(' ')}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="truncate">{item.name}</span>
              </div>
              {active && (
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
              )}
            </Link>
          )
        })}

        {/* ── Support section ─────────────────────────────────────────── */}
        <div className="pt-4 mt-2">
          <p className="px-3 mb-1 text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">
            Support
          </p>
          {supportNavigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onMobileClose}
                className={[
                  'group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100',
                  active
                    ? 'bg-[#00FF88]/10 text-[#00965c] dark:text-[#00FF88]'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
                ].join(' ')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={[
                    'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                    active
                      ? 'bg-[#00FF88]/15 text-[#00965c] dark:text-[#00FF88]'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400',
                  ].join(' ')}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="truncate">{item.name}</span>
                </div>
                {active && (
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Wallet card ──────────────────────────────────────────────────── */}
      <div className="px-3 pb-3">
        <Link
          href="/account/wallet"
          onClick={onMobileClose}
          className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-[#071209] to-[#0d2318] dark:from-gray-800 dark:to-gray-900 border border-[#00FF88]/20 hover:border-[#00FF88]/40 transition-colors group"
        >
          <div>
            <p className="text-[10px] font-semibold text-[#00FF88]/70 uppercase tracking-wider mb-0.5">
              Wallet Balance
            </p>
            <p className="text-base font-bold text-white">
              {formatCurrencyWithSymbol(walletBalance, currency)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold text-[#00FF88] bg-[#00FF88]/10 border border-[#00FF88]/20 px-2 py-0.5 rounded-full group-hover:bg-[#00FF88]/20 transition-colors">
              Add +
            </span>
          </div>
        </Link>
      </div>

      {/* ── Version badge ────────────────────────────────────────────────── */}
      {APP_VERSION && (
        <div className="px-4 pb-4 flex items-center justify-between">
          <span className="text-[10px] text-gray-300 dark:text-gray-600">
            ElitPOS
          </span>
          <span className="text-[10px] font-mono text-gray-300 dark:text-gray-600">
            v{APP_VERSION}
          </span>
        </div>
      )}
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          style={{ top: '56px' }}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile slide-out */}
      <aside
        className={[
          'fixed left-0 bottom-0 z-50 w-64 flex flex-col',
          'bg-white dark:bg-gray-900',
          'border-r border-gray-200 dark:border-gray-800',
          'transform transition-transform duration-200 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ top: '56px' }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:pt-14">
        <div className="flex flex-1 flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile bottom nav bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="flex justify-around py-1.5">
          {navigation.slice(0, 5).map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={[
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors',
                  active
                    ? 'text-[#00965c] dark:text-[#00FF88]'
                    : 'text-gray-500 dark:text-gray-500',
                ].join(' ')}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
