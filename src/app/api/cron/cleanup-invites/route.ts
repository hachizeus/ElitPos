import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { staffInvites } from '@/lib/db/schema'
import { and, lt, isNotNull, isNull } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

/**
 * POST /api/cron/cleanup-invites
 *
 * Purges two categories of stale invite rows:
 *   1. Expired invites: acceptedAt IS NULL AND expiresAt < NOW()
 *      — These were never accepted and have passed their 7-day window.
 *
 *   2. Old accepted invites: acceptedAt IS NOT NULL AND acceptedAt < (NOW() - 30 days)
 *      — These have been consumed and are no longer needed for any business logic.
 *
 * Schedule: Run daily (e.g. via Vercel Cron, Railway cron, or external cron service).
 * Requires: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide valid CRON_SECRET.' },
        { status: 401 }
      )
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Delete expired (never-accepted) invites
    const deletedExpired = await db
      .delete(staffInvites)
      .where(
        and(
          isNull(staffInvites.acceptedAt),
          lt(staffInvites.expiresAt, now)
        )
      )
      .returning({ id: staffInvites.id })

    // Delete old accepted invites (30+ days old)
    const deletedAccepted = await db
      .delete(staffInvites)
      .where(
        and(
          isNotNull(staffInvites.acceptedAt),
          lt(staffInvites.acceptedAt, thirtyDaysAgo)
        )
      )
      .returning({ id: staffInvites.id })

    const summary = {
      expiredDeleted: deletedExpired.length,
      acceptedDeleted: deletedAccepted.length,
      total: deletedExpired.length + deletedAccepted.length,
      ranAt: now.toISOString(),
    }

    console.log('[cron/cleanup-invites]', summary)

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    logError('cron/cleanup-invites', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
