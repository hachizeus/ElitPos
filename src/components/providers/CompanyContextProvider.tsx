'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface CompanyContext {
  tenantId: string
  tenantSlug: string
  tenantName: string
  businessType: string
  role: string
  isOwner: boolean
  currency: string
  dateFormat: string
  timeFormat: string
  // User identity (avoids needing useSession in company portal components)
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string
}

/**
 * Safe default used when the provider is not yet in the tree (HMR transition,
 * login-page layout branch, or brief pre-hydration renders). Every field is an
 * empty string / safe falsy value so components render without crashing; they
 * will re-render with real data once the provider mounts.
 *
 * NOTE: this is intentionally NOT exported — callers should use useCompany()
 * or useCompanyOptional(). The stub exists purely to prevent throws.
 */
const COMPANY_STUB: CompanyContext = {
  tenantId: '',
  tenantSlug: '',
  tenantName: '',
  businessType: 'retail',
  role: '',
  isOwner: false,
  currency: 'KES',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  userId: '',
  userName: '',
  userEmail: '',
  avatarUrl: undefined,
}

const CompanyCtx = createContext<CompanyContext | null>(null)

interface CompanyContextProviderProps {
  children: ReactNode
  value: CompanyContext
}

export function CompanyContextProvider({ children, value }: CompanyContextProviderProps) {
  return (
    <CompanyCtx.Provider value={value}>
      {children}
    </CompanyCtx.Provider>
  )
}

/**
 * Returns the company context. When called outside a CompanyContextProvider
 * (e.g. during HMR transitions, login-page renders, or layout races) it returns
 * a safe stub with empty/default values instead of throwing. Components will
 * re-render once the real provider mounts and supply actual data.
 */
export function useCompany(): CompanyContext {
  return useContext(CompanyCtx) ?? COMPANY_STUB
}

export function useCompanyOptional(): CompanyContext | null {
  return useContext(CompanyCtx)
}
