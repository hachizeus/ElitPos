'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Menu, HelpCircle, ChevronDown, LogOut, Settings, User,
  Keyboard, Info, Bug, Search, X, MoreVertical, Home, MessageCircle,
  Download, RefreshCw,
} from 'lucide-react'
import { useBreakpoint } from '@/hooks/useResponsive'
import { BugReportModal } from '@/components/modals/BugReportModal'
import { useSidebar } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
import { resolveFileUrl } from '@/lib/files/client'
import { ConnectionDot } from '@/components/ui/connection-status'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NetworkStatusBadge } from '@/components/ui/network-status'
import { CompanySwitcher } from './CompanySwitcher'
import { broadcastAuthEvent } from '@/lib/auth/events'
import { Logo } from '@/components/ui/logo'
import { AlertBell } from './AlertBell'
import { useChatStore } from '@/lib/stores/chat-store'
import { useCompanyOptional } from '@/components/providers/CompanyContextProvider'
import { MODULE_TABS, getModuleFromPathname, isModuleTabVisible } from '@/lib/navigation/module-sidebar'
import { useModuleAccess } from '@/hooks/useModuleAccess'
import { getTerms } from '@/lib/terminology'
import { ICON_MAP } from '@/components/workspace/icon-map'
import { cn } from '@/lib/utils'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { usePageRefresh } from '@/hooks/usePageRefresh'

interface NavbarProps {
  tenantName: string
  userEmail: string
  appVersion?: string
  companySlug: string
}

export function Navbar({ tenantName, userEmail, appVersion, companySlug }: NavbarProps) {
  const pathname = usePathname()
  const company = useCompanyOptional()
  const { data: session } = useSession()
  const { canInstall, isIOS, install } = useInstallPrompt()
  const { refreshing, refresh } = usePageRefresh()
  const { mobileOpen, setMobileOpen, collapsed, setCollapsed } = useSidebar()
  const { isModuleEnabled } = useModuleAccess()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [bugReportOpen, setBugReportOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const chatStore = useChatStore()
  const userMenuRef = useRef<HTMLDivElement>(null)
  const helpMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const isDesktop = useBreakpoint('lg', 'up')
  const isCompact = !isDesktop

  const businessType = company?.businessType
  const t = getTerms(businessType)
  const basePath = `/c/${companySlug}`
  const currentModule = getModuleFromPathname(pathname, businessType)

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target as Node)) {
        setHelpMenuOpen(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut: Ctrl+Shift+B to open bug report
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        setBugReportOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Persist theme change to API
  const handleThemeChange = useCallback((theme: 'light' | 'dark' | 'system') => {
    fetch('/api/account/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme }),
    }).catch(() => {})
  }, [])

  function handleMobileToggle() {
    if (isDesktop) {
      setCollapsed(!collapsed)
    } else {
      setMobileOpen(!mobileOpen)
    }
  }

  function handleMobileMenuToggle() {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  function handleSearchToggle() {
    if (isCompact) {
      setSearchExpanded(!searchExpanded)
    }
  }

  // User initials for avatar
  const userName = company?.userName || ''
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  // Module tab label overrides based on business type
  const moduleTabLabelOverrides: Record<string, string> = {
    stock: t.stockModule,
    selling: t.sellingModule,
  }

  const userRole = company?.role

  // Filter tabs based on business type, permissions, and module access
  const visibleTabs = MODULE_TABS.filter((tab) => {
    return isModuleTabVisible(tab, businessType, userRole, isModuleEnabled)
  }).map((tab) => ({
    ...tab,
    label: moduleTabLabelOverrides[tab.key] || tab.label,
  }))

  // Current module label for the navbar
  const currentModuleLabel = visibleTabs.find(t => t.key === currentModule)?.label || 'Dashboard'

  // Mobile menu items
  interface MobileMenuItemBase {
    label: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any
    danger?: boolean
  }

  interface MobileMenuItemWithHref extends MobileMenuItemBase {
    href: string
    onClick?: () => void
  }

  interface MobileMenuItemWithOnClick extends MobileMenuItemBase {
    onClick: () => void
  }

  type MobileMenuItem = MobileMenuItemWithHref | MobileMenuItemWithOnClick

  const mobileMenuItems: MobileMenuItem[] = [
    { label: 'Dashboard', href: `${basePath}/dashboard`, icon: Home },
    { label: 'Staff Chat', onClick: () => chatStore.toggleWidget(), icon: MessageCircle },
    { label: 'Settings', href: `${basePath}/settings`, icon: Settings },
    { label: 'Activity Log', href: `${basePath}/activity-log`, icon: User },
    { label: 'Report Bug', onClick: () => setBugReportOpen(true), icon: Bug },
    { label: 'Help', onClick: () => setHelpMenuOpen(true), icon: HelpCircle },
    { label: 'Logout', onClick: async () => {
      broadcastAuthEvent('logout', 'company')
      await signOut({ redirect: false })
      window.location.href = `${basePath}/login?logout=true`
    }, icon: LogOut, danger: true },
  ]

  return (
    <header
      className="sticky top-0 z-50 h-12 flex items-center shrink-0"
      style={{
        backgroundColor: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--navbar-border, rgba(0,0,0,0.08))',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {/* Left section: Hamburger + Logo + Company */}
      <div className="flex items-center gap-1 shrink-0 px-3">
        {/* Sidebar toggle — mobile opens drawer, desktop collapses/expands */}
        <button
          type="button"
          onClick={handleMobileToggle}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--navbar-text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>

        {/* Logo */}
        <Link href={`${basePath}/dashboard`} className="shrink-0">
          <Logo variant="icon" size={28} onDark />
        </Link>

        {/* Company switcher (desktop only) */}
        <div className="hidden lg:flex items-center">
          <CompanySwitcher currentSlug={companySlug} />
        </div>

        {/* Divider */}
        <div className="h-5 w-px shrink-0 hidden lg:block" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />

        {/* Current module name (desktop) */}
        <span className="hidden lg:inline text-[13px] font-medium ml-1" style={{ color: 'var(--navbar-text)' }}>
          {currentModuleLabel}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-0.5 shrink-0 ml-auto px-3">
        {/* Search - Expanded overlay on compact mode */}
        {isCompact && searchExpanded ? (
          <div className="absolute top-0 left-0 right-0 h-12 flex items-center px-3 z-[60]" style={{ backgroundColor: 'var(--navbar-bg)' }}>
            <div className="relative flex-1">
              <GlobalSearch />
            </div>
            <button
              onClick={() => setSearchExpanded(false)}
              className="ml-2 p-1.5 rounded transition-colors flex-shrink-0"
              style={{ color: 'var(--navbar-text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.15)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <>
            {/* Desktop search */}
            <div className="hidden lg:block w-52 lg:w-64">
              <GlobalSearch />
            </div>

            {/* Compact search toggle */}
            {isCompact && (
              <button
                type="button"
                onClick={handleSearchToggle}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--navbar-text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label="Search"
              >
                <Search size={18} />
              </button>
            )}
          </>
        )}

        {/* Connection status (desktop only) */}
        <div className="mx-1 hidden lg:block">
          <ConnectionDot />
        </div>

        {/* Network online/offline badge (desktop only — visible when offline or just reconnected) */}
        <div className="hidden lg:flex items-center">
          <NetworkStatusBadge />
        </div>

        {/* Background refresh (desktop only) */}
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          title="Refresh page data"
          className="p-1.5 rounded transition-colors hidden lg:flex items-center justify-center disabled:opacity-50"
          style={{ color: 'var(--navbar-text-muted)' }}
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>

        {/* Staff Chat (desktop only) */}
        <button
          type="button"
          onClick={() => chatStore.toggleWidget()}
          className="relative p-1.5 rounded transition-colors hidden lg:flex"
          style={{ color: 'var(--navbar-text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Staff Chat"
        >
          <MessageCircle size={18} />
          {chatStore.totalUnreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {chatStore.totalUnreadCount > 9 ? '9+' : chatStore.totalUnreadCount}
            </span>
          )}
        </button>

        {/* AI Alerts (desktop only) */}
        <div className="hidden lg:block">
          <AlertBell />
        </div>

        {/* Divider */}
        <div className="h-5 w-px mx-1 hidden lg:block" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />

        {/* Report Bug button (desktop only) */}
        <button
          type="button"
          onClick={() => setBugReportOpen(true)}
          className="items-center gap-1 px-2 py-1.5 rounded text-[13px] font-medium transition-colors hidden lg:flex"
          style={{ color: 'var(--navbar-text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Report a bug (Ctrl+Shift+B)"
        >
          <Bug size={16} />
        </button>

        {/* Help dropdown (desktop only) */}
        <div ref={helpMenuRef} className="relative hidden lg:block">
          <button
            type="button"
            onClick={() => setHelpMenuOpen(!helpMenuOpen)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-[13px] font-medium transition-colors"
            style={{ color: 'var(--navbar-text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <HelpCircle size={16} />
            <ChevronDown size={12} />
          </button>
          {helpMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 py-1 animate-dropdown">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">ElitPOS</p>
                {appVersion && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Version {appVersion}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setHelpMenuOpen(false)
                  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Keyboard size={14} className="text-gray-400" />
                Search
                <span className="ml-auto text-xs text-gray-400 font-mono">Ctrl+K</span>
              </button>
              <a
                href="https://elitjohnsdigital.co.ke"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setHelpMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Info size={14} className="text-gray-400" />
                About
              </a>
            </div>
          )}
        </div>

        {/* Theme toggle (desktop only) */}
        <div className="hidden lg:block">
          <ThemeToggle onThemeChange={handleThemeChange} />
        </div>

        {/* PWA Install button (desktop only — shown when app is installable) */}
        {canInstall && (
          <button
            type="button"
            onClick={() => {
              if (isIOS) {
                // iOS Safari doesn't support the install prompt API.
                // Show a brief alert directing the user to the share sheet.
                alert('To install ElitPOS:\n1. Tap the Share button (□↑) in Safari\n2. Tap "Add to Home Screen"\n3. Tap "Add"')
              } else {
                install()
              }
            }}
            title={isIOS ? 'Tap Share → Add to Home Screen to install' : 'Install ElitPOS app'}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
            style={{
              background: 'rgba(0,255,136,0.15)',
              color: '#00FF88',
              border: '1px solid rgba(0,255,136,0.3)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,255,136,0.25)'
              e.currentTarget.style.borderColor = 'rgba(0,255,136,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0,255,136,0.15)'
              e.currentTarget.style.borderColor = 'rgba(0,255,136,0.3)'
            }}
          >
            <Download size={13} />
            {isIOS ? 'Add to home screen' : 'Install app'}
          </button>
        )}

        {/* Divider */}
        <div className="h-5 w-px mx-1 hidden lg:block" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />

        {/* User avatar dropdown (desktop only) */}
        <div ref={userMenuRef} className="relative hidden lg:block">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 rounded transition-colors"
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {session?.user?.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={resolveFileUrl(session.user.avatarUrl) ?? ''}
                alt={userName}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                style={{
                  backgroundColor: 'var(--sidebar-avatar-bg)',
                  color: 'var(--sidebar-avatar-text)',
                }}
              >
                {userInitials}
              </div>
            )}
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 py-1 animate-dropdown">
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{userName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>
                {session?.user?.role && (
                  <span className="inline-block mt-1 text-xs capitalize bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                    {session.user.role}
                  </span>
                )}
              </div>
              {/* Menu items */}
              <div className="py-1">
                <Link
                  href={`${basePath}/settings`}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings size={14} className="text-gray-400" />
                  Settings
                </Link>
                <Link
                  href={`${basePath}/activity-log`}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <User size={14} className="text-gray-400" />
                  Activity Log
                </Link>
              </div>
              {/* Logout */}
              <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                <button
                  type="button"
                  onClick={async () => {
                    setUserMenuOpen(false)
                    broadcastAuthEvent('logout', 'company')
                    await signOut({ redirect: false })
                    window.location.href = `${basePath}/login?logout=true`
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Compact menu toggle (mobile + tablet, below lg) */}
        {isCompact && !searchExpanded && (
          <div ref={mobileMenuRef} className="relative">
            <button
              type="button"
              onClick={handleMobileMenuToggle}
              className="flex items-center gap-2 p-1 rounded transition-colors"
              style={{ color: 'var(--navbar-text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <MoreVertical size={20} />
            </button>

            {/* Mobile menu dropdown */}
            {mobileMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 py-1 animate-dropdown">
                {/* User info */}
                <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    {session?.user?.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={resolveFileUrl(session.user.avatarUrl) ?? ''}
                        alt={userName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{
                          backgroundColor: 'var(--sidebar-avatar-bg)',
                          color: 'var(--sidebar-avatar-text)',
                        }}
                      >
                        {userInitials}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                    </div>
                  </div>
                  {session?.user?.role && (
                    <span className="inline-block mt-2 text-xs capitalize bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                      {session.user.role}
                    </span>
                  )}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{tenantName}</p>
                </div>

                {/* App Switcher grid for mobile */}
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Modules</p>
                  <div className="grid grid-cols-4 gap-1">
                    {visibleTabs.slice(0, 8).map((tab) => {
                      const isActive = currentModule === tab.key
                      const TabIcon = ICON_MAP[tab.icon]
                      return (
                        <Link
                          key={tab.key}
                          href={`${basePath}${tab.href}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded text-center",
                            isActive
                              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                              : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          {TabIcon && <TabIcon size={18} />}
                          <span className="text-[10px] font-medium leading-tight truncate w-full">{tab.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>

                {/* Connection status and theme toggle for mobile */}
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ConnectionDot />
                    <span className="text-xs text-gray-600 dark:text-gray-300">Connection</span>
                    <NetworkStatusBadge />
                  </div>
                  <div className="flex items-center gap-2">
                    {canInstall && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false)
                          if (isIOS) {
                            alert('To install ElitPOS:\n1. Tap the Share button (□↑) in Safari\n2. Tap "Add to Home Screen"\n3. Tap "Add"')
                          } else {
                            install()
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                        style={{
                          background: 'rgba(0,255,136,0.12)',
                          color: '#00cc6a',
                          border: '1px solid rgba(0,255,136,0.25)',
                        }}
                      >
                        <Download size={11} />
                        {isIOS ? 'Add to home' : 'Install'}
                      </button>
                    )}
                    {/* Refresh for mobile */}
                    <button
                      type="button"
                      onClick={() => { setMobileMenuOpen(false); refresh() }}
                      disabled={refreshing}
                      className="p-1.5 rounded disabled:opacity-50"
                      style={{ color: 'var(--navbar-text-muted)' }}
                      title="Refresh page"
                    >
                      <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <ThemeToggle onThemeChange={handleThemeChange} />
                  </div>
                </div>

                {/* Mobile menu items */}
                <div className="py-1">
                  {mobileMenuItems.map((item, index) => {
                    const Icon = item.icon
                    if ('href' in item) {
                      return (
                        <Link
                          key={index}
                          href={item.href}
                          onClick={() => {
                            setMobileMenuOpen(false)
                            if (item.onClick) item.onClick()
                          }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-3 text-sm transition-colors",
                            item.danger
                              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          <Icon size={16} className="text-gray-400" />
                          {item.label}
                        </Link>
                      )
                    } else {
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false)
                            if (item.onClick) item.onClick()
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-3 text-sm transition-colors",
                            item.danger
                              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          <Icon size={16} className="text-gray-400" />
                          {item.label}
                        </button>
                      )
                    }
                  })}
                </div>

                {/* App version */}
                {appVersion && (
                  <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Version {appVersion}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bug Report Modal */}
      <BugReportModal isOpen={bugReportOpen} onClose={() => setBugReportOpen(false)} />
    </header>
  )
}
