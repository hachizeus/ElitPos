'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useCompanyOptional } from '@/components/providers/CompanyContextProvider'
import { useSidebar } from './Sidebar'
import {
  MODULE_TABS,
  getModuleFromPathname,
  isModuleTabVisible,
} from '@/lib/navigation/module-sidebar'
import { useModuleAccess } from '@/hooks/useModuleAccess'
import { ICON_MAP } from '@/components/workspace/icon-map'
import { getTerms } from '@/lib/terminology'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface AppSidebarProps {
  companySlug: string
}

// Collapsed width: icon rail only
const COLLAPSED_W = 56   // px
const EXPANDED_W  = 208  // px  (w-52)

export function AppSidebar({ companySlug }: AppSidebarProps) {
  const pathname  = usePathname()
  const { data: session } = useSession()
  const company   = useCompanyOptional()
  const { mobileOpen, setMobileOpen, collapsed } = useSidebar()
  const { isModuleEnabled } = useModuleAccess()

  const businessType = company?.businessType || session?.user?.businessType
  const userRole     = session?.user?.role
  const basePath     = `/c/${companySlug}`
  const t            = getTerms(businessType)

  const moduleTabLabelOverrides: Record<string, string> = {
    stock:   t.stockModule,
    selling: t.sellingModule,
  }

  const currentModule = getModuleFromPathname(pathname, businessType)

  const visibleTabs = MODULE_TABS.filter((tab) =>
    isModuleTabVisible(tab, businessType, userRole, isModuleEnabled)
  ).map((tab) => ({
    ...tab,
    label: moduleTabLabelOverrides[tab.key] || tab.label,
  }))

  const navItems = visibleTabs.map((tab) => {
    const Icon     = ICON_MAP[tab.icon]
    const isActive = currentModule === tab.key
    const href     = `${basePath}${tab.href}`

    return (
      <li key={tab.key}>
        <Link
          href={href}
          onClick={() => setMobileOpen(false)}
          title={collapsed ? tab.label : undefined}
          className={cn(
            'group flex items-center rounded-lg text-sm font-medium',
            'transition-colors duration-100 w-full overflow-hidden',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
            isActive
              ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active)]'
              : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]',
          )}
        >
          {Icon && (
            <Icon
              size={18}
              className={cn(
                'flex-shrink-0 transition-colors',
                isActive
                  ? 'text-[var(--sidebar-text-active)]'
                  : 'text-[var(--sidebar-text-muted)] group-hover:text-[var(--sidebar-text)]',
              )}
            />
          )}
          {/* Label — hidden when collapsed */}
          {!collapsed && (
            <span className="truncate leading-none flex-1">{tab.label}</span>
          )}
          {/* Active dot — only when expanded */}
          {!collapsed && isActive && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--sidebar-active-border)] flex-shrink-0" />
          )}
        </Link>
      </li>
    )
  })

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header — "Modules" label, hidden when collapsed */}
      {!collapsed && (
        <div
          className="flex items-center px-4 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          <span
            className="text-xs font-bold tracking-widest uppercase select-none"
            style={{ color: 'var(--sidebar-text-active)' }}
          >
            Modules
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3" style={{ paddingLeft: collapsed ? 6 : 8, paddingRight: collapsed ? 6 : 8 }}>
        <ul className="space-y-0.5">
          {navItems}
        </ul>
      </nav>
    </div>
  )

  return (
    <>
      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          style={{ top: '48px' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer (always expanded, slides in from left) ── */}
      <aside
        className={cn(
          'fixed left-0 bottom-0 z-50 flex flex-col text-sm',
          'transform transition-transform duration-200 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          top: '48px',
          width: EXPANDED_W,
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute top-2 right-2 p-1 rounded-md transition-colors"
          style={{ color: 'var(--sidebar-text-muted)' }}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
        {/* Mobile always shows full labels */}
        <div className="flex flex-col h-full">
          <div
            className="flex items-center px-4 py-4 border-b flex-shrink-0"
            style={{ borderColor: 'var(--sidebar-border)' }}
          >
            <span
              className="text-xs font-bold tracking-widest uppercase select-none"
              style={{ color: 'var(--sidebar-text-active)' }}
            >
              Modules
            </span>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            <ul className="space-y-0.5">
              {visibleTabs.map((tab) => {
                const Icon     = ICON_MAP[tab.icon]
                const isActive = currentModule === tab.key
                const href     = `${basePath}${tab.href}`
                return (
                  <li key={tab.key}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                        'transition-colors duration-100 w-full',
                        isActive
                          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active)]'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]',
                      )}
                    >
                      {Icon && <Icon size={18} className={cn('flex-shrink-0', isActive ? 'text-[var(--sidebar-text-active)]' : 'text-[var(--sidebar-text-muted)]')} />}
                      <span className="truncate leading-none flex-1">{tab.label}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--sidebar-active-border)] flex-shrink-0" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* ── Desktop sidebar — collapses to icon rail ── */}
      <aside
        className="hidden lg:flex flex-col text-sm flex-shrink-0 overflow-hidden"
        style={{
          position: 'sticky',
          top: '48px',
          height: 'calc(100vh - 48px)',
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          transition: 'width 200ms ease',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
