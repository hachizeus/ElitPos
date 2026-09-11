import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminSessionTimer } from '@/components/admin/AdminSessionTimer'
import { AdminRefreshButton } from '@/components/admin/AdminRefreshButton'
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell'
import { validateAdminSession, getAdminFromSession } from '@/lib/admin'

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await validateAdminSession()
  if (!session) redirect('/sys-control/login')

  const admin = await getAdminFromSession()
  const initial = admin?.email?.[0]?.toUpperCase() ?? 'A'

  return (
    /*
      CSS Grid shell — two columns: [sidebar] [content]
      - The sidebar column is sized by the sidebar component itself (w-56 or w-[68px]).
      - The content column takes all remaining space (minmax(0,1fr)).
      - The whole grid is exactly the viewport height (h-screen) and doesn't scroll.
      - Only the content area scrolls (overflow-y-auto).
      - The sidebar is sticky top-0 h-screen inside its column → never scrolls.
    */
    <div className="flex h-screen overflow-hidden bg-gray-950">

      {/* ── Sidebar — sticky, never scrolls ── */}
      <AdminSidebar adminEmail={admin?.email ?? undefined} />

      {/* ── Right column: topbar + scrollable content ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar — sticks to top of the right column */}
        <header className="flex-shrink-0 flex items-center justify-between
          h-14 px-4 lg:px-6
          bg-gray-900/95 backdrop-blur-md
          border-b border-[#00FF88]/10 z-20">

          {/* Left: spacer for mobile hamburger + breadcrumb */}
          <div className="flex items-center gap-2">
            {/* Gap so mobile hamburger (fixed, top-left) doesn't overlap text */}
            <div className="w-10 lg:hidden" />
            <span className="text-xs font-semibold tracking-widest text-[#00FF88] uppercase select-none">
              ElitPOS
            </span>
            <span className="text-gray-700 select-none">/</span>
            <span className="text-xs text-gray-400">Admin</span>
          </div>

          {/* Right: session controls */}
          <div className="flex items-center gap-3">
            <AdminRefreshButton />
            <AdminNotificationBell />
            <AdminSessionTimer />
            {admin?.email && (
              <span className="hidden sm:block text-xs text-gray-500 max-w-[160px] truncate">
                {admin.email}
              </span>
            )}
            <div className="w-7 h-7 rounded-full bg-[#00FF88]/15 border border-[#00FF88]/30
              flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-[#00FF88]">{initial}</span>
            </div>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 lg:p-8">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
