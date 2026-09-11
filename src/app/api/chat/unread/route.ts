import { NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { withTenant } from '@/lib/db'
import { staffChatParticipants } from '@/lib/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { dbCache, CacheTTL } from '@/lib/db/query-cache'

// GET - Get total unread count across all conversations
export async function GET() {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cache unread count (changes frequently but acceptable delay)
    const cacheKey = `chat-unread:${session.user.tenantId}:${session.user.id}`
    
    const unreadCount = await dbCache.query(
      cacheKey,
      async () => {
        return await withTenant(session.user.tenantId, async (db) => {
          const [result] = await db
            .select({
              totalUnread: sql<number>`COALESCE(SUM(${staffChatParticipants.unreadCount}), 0)::int`,
            })
            .from(staffChatParticipants)
            .where(
              and(
                eq(staffChatParticipants.userId, session.user.id),
                isNull(staffChatParticipants.leftAt)
              )
            )

          return result?.totalUnread || 0
        })
      },
      CacheTTL.REALTIME // 10 seconds - fast updates for messaging
    )

    // Add browser cache headers
    return NextResponse.json({ unreadCount }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=20',
      },
    })
  } catch (error) {
    console.error('Failed to get chat unread count:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
