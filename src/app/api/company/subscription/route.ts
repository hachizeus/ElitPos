import { NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { withTenant, db } from '@/lib/db'
import { pricingTiers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'
import { dbCache, CacheTTL } from '@/lib/db/query-cache'

// GET /api/company/subscription - Get current company's subscription status
export async function GET() {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cache subscription data (changes infrequently)
    const cacheKey = `subscription:${session.user.tenantId}`
    
    const result = await dbCache.query(
      cacheKey,
      async () => {
        // Execute with RLS tenant context
        return await withTenant(session.user.tenantId, async (tenantDb) => {
          // Get subscription (RLS scopes to tenant)
          const subscription = await tenantDb.query.subscriptions.findFirst()

          if (!subscription) {
            return null
          }

          // Get tier name - pricingTiers is a global table without RLS
          let tierName = 'Free'
          if (subscription.tierId) {
            const tier = await db.query.pricingTiers.findFirst({
              where: eq(pricingTiers.id, subscription.tierId),
            })
            if (tier) {
              tierName = tier.displayName
            }
          }

          return {
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
            tierName,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        })
      },
      CacheTTL.SETTINGS // 5 minutes
    )

    if (!result) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Add browser cache headers
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    logError('api/company/subscription', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
