import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { validateAdminSessionWithRefresh } from '@/lib/admin'
import { logError } from '@/lib/ai/error-logger'

/**
 * POST /api/sys-control/notifications/mark-read
 * Mark all admin notifications as read by setting read_until = now()
 */
export async function POST() {
  try {
    const session = await validateAdminSessionWithRefresh()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db
      .insert(systemSettings)
      .values({
        key: 'admin_notifications_read_until',
        value: { timestamp: new Date().toISOString() },
        description: 'Timestamp up to which admin notifications are considered read',
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: { timestamp: new Date().toISOString() },
          updatedAt: sql`NOW()`,
        },
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('api/sys-control/notifications/mark-read', error)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }
}
