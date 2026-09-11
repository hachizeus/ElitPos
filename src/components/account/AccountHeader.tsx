'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import {
  Menu,
  X,
  LogOut,
  User,
  Settings,
  Moon,
  Sun,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import { broadcastAuthEvent } from '@/lib/auth/events'
import { useTheme } from '@/components/providers/ThemeProvider'
import { NotificationDropdown } from '@/components/account/NotificationDropdown'
import { MessageDropdown } from '@/components/account/MessageDropdown'
import { NetworkStatusBadge } from '@/components/ui/network-status'
import { usePageRefresh } from '@/hooks/usePageRefresh'
import { AccountSearch } from '@/components/account/AccountSearch'

interface AccountHeaderProps {
  onMobileMenuToggle?: () => void
  mobileMenuOpen?: boolean
}

export function AccountHeader({ onMobileMenuToggle, mobileMenuOpen }: AccountHeaderProps) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { refreshing, refresh } = usePageRefresh()
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; slug: string }>>([])

  useEffect(() => {
    fetch('/api/account/companies')
      .then(r => r.ok ? r.json() : [])
      .then(data => setCompanies((data || []).map((c: { id: string; name: string; slug: string }) => ({ id: c.id, name: c.name, slug: c.slug }))))
      .catch(() => {})
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Logo + mobile toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/account" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/iconlogo.svg"
              alt="ElitPOS"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
            />
            <span className="hidden sm:block font-bold text-gray-900 dark:text-white tracking-tight">
              ElitPOS
            </span>
          </Link>
        </div>

        {/* Search — live autocomplete */}
        <div className="hidden md:flex flex-1 max-w-sm mx-8">
          <AccountSearch companies={companies} />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Network badge — shows when offline or just reconnected */}
          <NetworkStatusBadge />

          {/* Background refresh */}
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Refresh page data"
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Messages */}
          <MessageDropdown />

          {/* Notifications */}
          <NotificationDropdown />

          {/* User menu */}
          <div className="relative ml-1">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 bg-gradient-to-br from-[#00FF88]/30 to-[#00cc6a]/20 border border-[#00FF88]/30 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#00965c] dark:text-[#00FF88]">
                  {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[100px]">
                {session?.user?.name?.split(' ')[0] || 'Account'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-20 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {session?.user?.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {session?.user?.email}
                    </p>
                  </div>

                  <Link
                    href="/account/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    Profile
                  </Link>
                  <Link
                    href="/account/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    Settings
                  </Link>

                  <div className="border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
                    <button
                      onClick={() => {
                        broadcastAuthEvent('logout', 'account')
                        signOut({ callbackUrl: '/login' })
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}


