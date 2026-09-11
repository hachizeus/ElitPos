'use client'

import { AppSidebar } from '@/components/layout/AppSidebar'
import { ModuleSidebar } from '@/components/layout/ModuleSidebar'

interface ConditionalSidebarProps {
  companySlug: string
}

/**
 * Renders the two-level sidebar:
 *   1. AppSidebar  — persistent module list (all modules, always visible on desktop)
 *   2. ModuleSidebar — per-module sub-nav (only when inside a module with sub-items)
 *
 * Both are rendered as siblings in the flex row defined by the layout,
 * so they sit left-to-right with main content on the right.
 */
export function ConditionalSidebar({ companySlug }: ConditionalSidebarProps) {
  return (
    <>
      <AppSidebar companySlug={companySlug} />
      <ModuleSidebar companySlug={companySlug} />
    </>
  )
}
