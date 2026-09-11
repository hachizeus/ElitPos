import { NextResponse } from 'next/server'
import { accountAuth as auth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { pricingTiers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

// GET /api/account/pricing-tiers - Get all active pricing tiers
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tiers = await db.query.pricingTiers.findMany({
      where: eq(pricingTiers.isActive, true),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
    })

    return NextResponse.json(
      tiers.map((t) => ({
        id: t.id,
        name: t.name,
        displayName: t.displayName,
        priceMonthly: Number(t.priceMonthly),
        priceYearly: Number(t.priceYearly),
        currency: t.currency || 'KES',
        maxUsers: t.maxUsers,
        maxSalesMonthly: t.maxSalesMonthly,
        maxDatabaseBytes: t.maxDatabaseBytes,
        maxFileStorageBytes: t.maxFileStorageBytes,
        features: t.features,
      })),
      {
        headers: {
          // Pricing tiers change rarely — cache for 5 minutes in browser,
          // serve stale for 1 hour while revalidating in background
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600',
        },
      }
    )
  } catch (error) {
    logError('api/account/pricing-tiers', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
