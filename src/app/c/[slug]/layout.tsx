import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { db, withTenant } from '@/lib/db'
import { tenants, accounts, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { ConditionalSidebar } from '@/components/layout/ConditionalSidebar'
import { Navbar } from '@/components/layout/Navbar'
import { SessionProvider } from 'next-auth/react'
import { ToastProvider } from '@/components/layout/ToastProvider'
import { ClientProviders } from '@/components/layout/ClientProviders'
import { SessionValidator } from '@/components/auth/SessionValidator'
import { ActivityTracker } from '@/components/auth/ActivityTracker'
import { CompanyContextProvider } from '@/components/providers/CompanyContextProvider'
import { SystemAnnouncement } from '@/components/layout/SystemAnnouncement'
import { TrialBanner } from '@/components/layout/TrialBanner'
import { StorageBanner } from '@/components/layout/StorageBanner'
import { ChatHub } from '@/components/chat/ChatHub'
import { SubdomainUrlCleaner } from '@/components/layout/SubdomainUrlCleaner'
import { OfflineStatusBar } from '@/components/offline/OfflineStatusBar'

// Cache tenant data for 60 seconds — avoids a DB round-trip on every page render
// within the same deployment worker. Tags allow instant invalidation when tenant changes.
const getCachedTenant = unstable_cache(
  async (slug: string) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    })
    return tenant ?? null
  },
  ['tenant-by-slug'],
  { revalidate: 60, tags: ['tenant'] }
)

// Cache user access check for 60 seconds — avoids withTenant overhead on every navigation
const getCachedUserRecord = unstable_cache(
  async (tenantId: string, userId: string) => {
    const record = await withTenant(tenantId, async (tdb) => {
      return tdb.query.users.findFirst({
        where: and(eq(users.id, userId), eq(users.isActive, true)),
      })
    })
    return record ?? null
  },
  ['user-record-for-layout'],
  { revalidate: 60, tags: ['user'] }
)

interface CompanyLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function CompanyLayout({
  children,
  params,
}: CompanyLayoutProps) {
  const { slug } = await params

  // Get pathname early (set by middleware) to detect page type
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  // ── PUBLIC PAGES: No auth required (breaks redirect loop for unauthenticated users) ──
  const isLoginPage = pathname === `/c/${slug}/login`
  if (isLoginPage) {
    // SessionProvider is required here because the login page calls signIn() from
    // next-auth/react, and because WebSocketProvider (inside ClientProviders) calls
    // useSession() — both need the provider in the tree to avoid context errors.
    const loginSession = await auth().catch(() => null)
    return (
      <SessionProvider session={loginSession ?? undefined} refetchInterval={3600}>
        <SubdomainUrlCleaner />
        {children}
        <ToastProvider />
      </SessionProvider>
    )
  }

  // ── AUTH CHECK ──
  const session = await auth()

  if (!session || !session.user?.id) {
    redirect(`/c/${slug}/login`)
  }

  // ── TENANT CONTEXT CHECK ──
  // If the session is for a different company,
  // redirect to the company login page so the user can sign in to this specific company.
  if (session.user.tenantSlug !== slug) {
    redirect(`/c/${slug}/login`)
  }

  // Super admins cannot access company pages - redirect to admin panel
  if (session.user.accountId) {
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, session.user.accountId),
      columns: { isSuperAdmin: true },
    })
    if (account?.isSuperAdmin) {
      redirect('/sys-control')
    }
  }

  // ── TENANT LOOKUP (cached 60s) ──
  const tenant = await getCachedTenant(slug)

  if (!tenant) {
    // Company not found - redirect to account page
    redirect('/account')
  }

  // ── LOCKED PAGE: Auth required, skip status check (breaks redirect loop) ──
  const isLockedPage = pathname === `/c/${slug}/locked`
  if (isLockedPage) {
    return (
      <SessionProvider session={session} refetchInterval={3600}>
        <ClientProviders>
          <SubdomainUrlCleaner />
          {children}
          <ToastProvider />
        </ClientProviders>
      </SessionProvider>
    )
  }

  // ── TENANT STATUS CHECKS ──
  if (tenant.status === 'locked') {
    redirect(`/c/${slug}/locked`)
  }

  if (tenant.status !== 'active') {
    // Company suspended/cancelled - redirect to account page
    redirect('/account?error=suspended')
  }

  // Verify user has access to this company (cached 60s)
  const userRecord = await getCachedUserRecord(tenant.id, session.user.id)

  if (!userRecord) {
    // No access to this company
    redirect(`/c/${slug}/login`)
  }

  // Check if this is the setup page
  const isSetupPage = pathname === `/c/${slug}/setup` || pathname.startsWith(`/c/${slug}/setup/`)

  // Setup wizard guard: redirect to setup if not completed (unless already on setup page)
  if (!tenant.setupCompletedAt && !isSetupPage) {
    redirect(`/c/${slug}/setup`)
  }

  // Build company context for client components
  const companyContext = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    businessType: tenant.businessType,
    role: userRecord.role,
    isOwner: userRecord.role === 'owner',
    currency: tenant.currency || 'KES',
    dateFormat: tenant.dateFormat || 'DD/MM/YYYY',
    timeFormat: tenant.timeFormat || '12h',
    userId: session.user.id,
    userName: session.user.name || '',
    userEmail: session.user.email || '',
    avatarUrl: (session.user as { avatarUrl?: string }).avatarUrl,
  }

  // Setup page: render minimal layout (no sidebar, navbar, etc.)
  if (isSetupPage) {
    return (
      <SessionProvider session={session} refetchInterval={3600}>
        <CompanyContextProvider value={companyContext}>
          <SessionValidator scope="company" tenantSlug={slug}>
            <ActivityTracker scope="company" tenantSlug={slug} />
            <ClientProviders>
              <SubdomainUrlCleaner />
              {children}
              <ToastProvider />
            </ClientProviders>
          </SessionValidator>
        </CompanyContextProvider>
      </SessionProvider>
    )
  }

  return (
    <SessionProvider session={session} refetchInterval={3600}>
      <CompanyContextProvider value={companyContext}>
        <SessionValidator scope="company" tenantSlug={slug}>
          <ActivityTracker scope="company" tenantSlug={slug} />
          <ClientProviders>
            <SubdomainUrlCleaner />
            <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--page-bg)' }}>
              {/* Navbar: full width, sticky top */}
              <Navbar
                tenantName={tenant.name}
                userEmail={session.user.email || ''}
                appVersion={process.env.APP_VERSION}
                companySlug={slug}
              />
              {/* Content area: module sidebar + main side by side */}
              <div className="flex flex-1">
                <ConditionalSidebar companySlug={slug} />
                <main className="flex-1 min-w-0">
                  <SystemAnnouncement />
                  <TrialBanner companySlug={slug} />
                  <StorageBanner companySlug={slug} />
                  <OfflineStatusBar />
                  <div className="p-5">
                    {children}
                  </div>
                </main>
              </div>
              <ToastProvider />
              <ChatHub />
            </div>
          </ClientProviders>
        </SessionValidator>
      </CompanyContextProvider>
    </SessionProvider>
  )
}

