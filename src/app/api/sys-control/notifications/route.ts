import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  paymentDeposits, pendingCompanies, adminAuditLogs,
  accounts, pricingTiers, accountNotifications,
} from '@/lib/db/schema'
import { eq, desc, and, gt, inArray } from 'drizzle-orm'
import { validateAdminSessionWithRefresh } from '@/lib/admin'
import { logError } from '@/lib/ai/error-logger'
import { sendBulkNotification } from '@/lib/notifications/sender'

export interface AdminNotification {
  id: string
  type: 'payment' | 'new_company' | 'approval' | 'rejection' | 'system'
  title: string
  message: string
  link: string
  createdAt: string
  read: boolean
}

/**
 * GET /api/sys-control/notifications
 * Returns the 30 most recent admin-relevant events aggregated from:
 *  - Pending payment deposits (new bank payments awaiting review)
 *  - Pending companies (new company registrations)
 *  - Recent audit log approvals/rejections
 *
 * "Read" state is persisted in system_settings key 'admin_notifications_read_until'
 * (a timestamp — anything created before it is considered read).
 */
export async function GET() {
  try {
    const session = await validateAdminSessionWithRefresh()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get "read until" timestamp from system_settings
    const { systemSettings } = await import('@/lib/db/schema')
    const readSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'admin_notifications_read_until'),
    })
    const readUntil: Date = readSetting?.value
      ? new Date((readSetting.value as { timestamp: string }).timestamp)
      : new Date(0)

    const notifications: AdminNotification[] = []

    // 1. Pending payment deposits
    const pendingPayments = await db
      .select({
        id: paymentDeposits.id,
        amount: paymentDeposits.amount,
        currency: paymentDeposits.currency,
        createdAt: paymentDeposits.createdAt,
        accountId: paymentDeposits.accountId,
        isWalletDeposit: paymentDeposits.isWalletDeposit,
        pendingCompanyId: paymentDeposits.pendingCompanyId,
      })
      .from(paymentDeposits)
      .where(eq(paymentDeposits.status, 'pending'))
      .orderBy(desc(paymentDeposits.createdAt))
      .limit(20)

    // Resolve account emails for payments
    const accountIds = [...new Set(pendingPayments.map(p => p.accountId))]
    const accountRows = accountIds.length > 0
      ? await db.select({ id: accounts.id, email: accounts.email, fullName: accounts.fullName })
          .from(accounts)
          .where(inArray(accounts.id, accountIds))
      : []
    const accountMap = new Map(accountRows.map(a => [a.id, a]))

    for (const p of pendingPayments) {
      const acc = accountMap.get(p.accountId)
      const who = acc?.fullName || acc?.email || 'A user'
      const label = p.isWalletDeposit
        ? 'wallet top-up'
        : p.pendingCompanyId
          ? 'new company payment'
          : 'subscription payment'

      notifications.push({
        id: `pay-${p.id}`,
        type: 'payment',
        title: 'New Payment Awaiting Review',
        message: `${who} submitted a ${label} of ${p.currency} ${Number(p.amount).toLocaleString()}`,
        link: `/sys-control/payments`,
        createdAt: p.createdAt.toISOString(),
        read: p.createdAt <= readUntil,
      })
    }

    // 2. Pending company registrations (not yet activated)
    const pendingCos = await db
      .select({
        id: pendingCompanies.id,
        name: pendingCompanies.name,
        businessType: pendingCompanies.businessType,
        status: pendingCompanies.status,
        createdAt: pendingCompanies.createdAt,
        tierId: pendingCompanies.tierId,
      })
      .from(pendingCompanies)
      .where(
        and(
          inArray(pendingCompanies.status, ['pending_payment', 'pending_approval']),
          gt(pendingCompanies.expiresAt, new Date()),
        )
      )
      .orderBy(desc(pendingCompanies.createdAt))
      .limit(15)

    // Resolve tier names
    const tierIds = [...new Set(pendingCos.map(c => c.tierId))]
    const tierRows = tierIds.length > 0
      ? await db.select({ id: pricingTiers.id, displayName: pricingTiers.displayName })
          .from(pricingTiers)
          .where(inArray(pricingTiers.id, tierIds))
      : []
    const tierMap = new Map(tierRows.map(t => [t.id, t]))

    for (const c of pendingCos) {
      const tier = tierMap.get(c.tierId)
      const statusLabel = c.status === 'pending_approval' ? 'paid — awaiting approval' : 'pending payment'
      notifications.push({
        id: `co-${c.id}`,
        type: 'new_company',
        title: 'New Company Registration',
        message: `"${c.name}" (${c.businessType}, ${tier?.displayName || 'paid'}) — ${statusLabel}`,
        link: `/sys-control/payments`,
        createdAt: c.createdAt.toISOString(),
        read: c.createdAt <= readUntil,
      })
    }

    // 3. Recent audit log approvals/rejections (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentAudits = await db
      .select({
        id: adminAuditLogs.id,
        action: adminAuditLogs.action,
        resource: adminAuditLogs.resource,
        resourceId: adminAuditLogs.resourceId,
        details: adminAuditLogs.details,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .where(
        and(
          inArray(adminAuditLogs.action, ['approve', 'reject']),
          gt(adminAuditLogs.createdAt, sevenDaysAgo),
        )
      )
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(10)

    for (const a of recentAudits) {
      const details = a.details as Record<string, unknown> | null
      const action = a.action === 'approve' ? 'Approved' : 'Rejected'
      notifications.push({
        id: `audit-${a.id}`,
        type: a.action === 'approve' ? 'approval' : 'rejection',
        title: `${action}: ${a.resource}`,
        message: details?.['amount']
          ? `Payment of ${details['amount']} ${a.action === 'approve' ? 'approved' : 'rejected'}`
          : `${a.resource} was ${a.action === 'approve' ? 'approved' : 'rejected'}`,
        link: `/sys-control/payments`,
        createdAt: a.createdAt.toISOString(),
        read: a.createdAt <= readUntil,
      })
    }

    // Sort all by createdAt desc, take 30
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const trimmed = notifications.slice(0, 30)

    const unreadCount = trimmed.filter(n => !n.read).length

    return NextResponse.json({ notifications: trimmed, unreadCount })
  } catch (error) {
    logError('api/sys-control/notifications', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

/**
 * POST /api/sys-control/notifications
 * Send a notification to users (creates accountNotifications and sends via email/SMS)
 */
export async function POST(request: Request) {
  try {
    const session = await validateAdminSessionWithRefresh()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, title, message, link, sendToAll, accountIds } = body

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'Type, title, and message are required' }, { status: 400 })
    }

    let targetAccountIds: string[] = []

    if (sendToAll) {
      // Get all account IDs
      const allAccounts = await db.select({ id: accounts.id }).from(accounts)
      targetAccountIds = allAccounts.map(a => a.id)
    } else {
      if (!accountIds || accountIds.length === 0) {
        return NextResponse.json({ error: 'No recipients specified' }, { status: 400 })
      }
      targetAccountIds = accountIds
    }

    if (targetAccountIds.length === 0) {
      return NextResponse.json({ error: 'No users to send to' }, { status: 400 })
    }

    console.log('[sys-control/notifications] Sending to', targetAccountIds.length, 'users')

    // Send notifications via all channels (in-app, email, SMS)
    const result = await sendBulkNotification(targetAccountIds, {
      type,
      title,
      message,
      link,
      sendInApp: true,
      sendEmail: true,
      sendSMS: true,
    })

    console.log('[sys-control/notifications] Bulk send result:', result)

    // Log admin action (only if admin user ID is available)
    if (session.user?.id) {
      await db.insert(adminAuditLogs).values({
        adminId: session.user.id,
        action: 'send_notification',
        resource: 'notification',
        details: {
          type,
          title,
          sendToAll,
          recipientCount: targetAccountIds.length,
          sent: result.sent,
          failed: result.failed,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${result.sent} user${result.sent === 1 ? '' : 's'}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
      stats: {
        sent: result.sent,
        failed: result.failed,
        total: targetAccountIds.length,
      },
    })
  } catch (error) {
    console.error('[sys-control/notifications] POST error:', error)
    logError('api/sys-control/notifications/POST', error)
    
    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : 'Failed to send notification'
    return NextResponse.json({ 
      error: 'Failed to send notification',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}


/**
 * DELETE /api/sys-control/notifications
 * Delete account notifications (admin cleanup)
 */
export async function DELETE(request: Request) {
  try {
    const session = await validateAdminSessionWithRefresh()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Notification IDs required' }, { status: 400 })
    }

    await db.delete(accountNotifications).where(inArray(accountNotifications.id, ids))

    return NextResponse.json({ success: true, message: `${ids.length} notification(s) deleted` })
  } catch (error) {
    logError('api/sys-control/notifications/DELETE', error)
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 })
  }
}
