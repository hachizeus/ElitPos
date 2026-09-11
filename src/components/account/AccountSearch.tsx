'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Building2, CreditCard, FileText, Users, BarChart3, Settings, Loader2 } from 'lucide-react'

interface SearchSuggestion {
  id: string
  type: 'company' | 'invoice' | 'plan' | 'team' | 'page'
  title: string
  subtitle?: string
  href: string
}

// Static account portal pages for instant results
const ACCOUNT_PAGES: SearchSuggestion[] = [
  { id: 'overview', type: 'page', title: 'Overview', subtitle: 'Dashboard & summary', href: '/account' },
  { id: 'sites', type: 'page', title: 'Sites', subtitle: 'Manage your companies', href: '/account/sites' },
  { id: 'billing', type: 'page', title: 'Billing', subtitle: 'Invoices & payment history', href: '/account/billing' },
  { id: 'plans', type: 'page', title: 'Plans', subtitle: 'Upgrade or change your plan', href: '/account/plans' },
  { id: 'payments', type: 'page', title: 'Payments', subtitle: 'Payment methods & history', href: '/account/payments' },
  { id: 'wallet', type: 'page', title: 'Wallet', subtitle: 'Top-up & balance', href: '/account/wallet' },
  { id: 'team', type: 'page', title: 'Team', subtitle: 'Invite & manage members', href: '/account/team' },
  { id: 'activity', type: 'page', title: 'Activity', subtitle: 'Account activity log', href: '/account/activity' },
  { id: 'settings', type: 'page', title: 'Settings', subtitle: 'Account preferences', href: '/account/settings' },
  { id: 'notifications', type: 'page', title: 'Notifications', subtitle: 'Notification preferences', href: '/account/notifications' },
  { id: 'support', type: 'page', title: 'Support', subtitle: 'Help & support', href: '/account/support' },
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  company: <Building2 size={14} className="text-green-500" />,
  invoice: <CreditCard size={14} className="text-blue-500" />,
  plan: <BarChart3 size={14} className="text-purple-500" />,
  team: <Users size={14} className="text-orange-500" />,
  page: <Settings size={14} className="text-gray-400" />,
}

interface AccountSearchProps {
  /** List of companies the user owns — passed from the header */
  companies?: Array<{ id: string; name: string; slug: string }>
}

export function AccountSearch({ companies = [] }: AccountSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [companySuggestions, setCompanySuggestions] = useState<SearchSuggestion[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard shortcut Ctrl/Cmd+K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Convert companies prop to suggestions (client-side, instant)
  const buildCompanySuggestions = useCallback((q: string): SearchSuggestion[] => {
    if (!q) return []
    const lower = q.toLowerCase()
    return companies
      .filter(c => c.name.toLowerCase().includes(lower) || c.slug.toLowerCase().includes(lower))
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        type: 'company' as const,
        title: c.name,
        subtitle: c.slug,
        href: `/c/${c.slug}/dashboard`,
      }))
  }, [companies])

  // Filter static pages
  const pageResults = query.length >= 1
    ? ACCOUNT_PAGES.filter(p =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        (p.subtitle?.toLowerCase().includes(query.toLowerCase()) ?? false)
      ).slice(0, 4)
    : ACCOUNT_PAGES.slice(0, 5) // show top pages when empty/focused

  const allResults: SearchSuggestion[] = [
    ...buildCompanySuggestions(query),
    ...pageResults,
  ]

  const handleSelect = (item: SearchSuggestion) => {
    setIsOpen(false)
    setQuery('')
    router.push(item.href)
  }

  const showDropdown = isOpen && (query.length >= 1 || allResults.length > 0)

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search sites, pages..."
          className="w-full pl-9 pr-10 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF88]/40 focus:border-[#00FF88] text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-colors"
        />
        {query ? (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-4 items-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 font-mono text-[10px] text-gray-400">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : allResults.length === 0 ? (
            <div className="py-6 text-center">
              <FileText size={20} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No results for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="py-1">
              {/* Group header */}
              {buildCompanySuggestions(query).length > 0 && (
                <div className="px-3 py-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Companies</p>
                </div>
              )}
              {buildCompanySuggestions(query).map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-md bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                    {TYPE_ICONS[item.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>}
                  </div>
                  <span className="text-xs text-[#00965c] dark:text-[#00FF88] font-medium flex-shrink-0">Open →</span>
                </button>
              ))}

              {pageResults.length > 0 && (
                <div className="px-3 py-1.5 border-t border-gray-50 dark:border-gray-800 mt-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pages</p>
                </div>
              )}
              {pageResults.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                    {TYPE_ICONS[item.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
