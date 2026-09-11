import { NextResponse } from 'next/server'
import { accountAuth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { pendingCompanies, pricingTiers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'
import { validateParams } from '@/lib/validation/helpers'
import { idParamSchema } from '@/lib/validation/schemas/common'

/**
 * GET /api/account/pending-companies/[id]
 * Returns a single pending company with its tier details.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await accountAuth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsParsed = validateParams(await params, idParamSchema)
    if (!paramsParsed.success) return paramsParsed.response
    const { id } = paramsParsed.data

    const [row] = await db
      .select({
        pendingCompany: pendingCompanies,
        tier: pricingTiers,
      })
      .from(pendingCompanies)
      .innerJoin(pricingTiers, eq(pendingCompanies.tierId, pricingTiers.id))
      .where(
        and(
          eq(pendingCompanies.id, id),
          eq(pendingCompanies.accountId, session.user.accountId)
        )
      )
      .limit(1)

    if (!row) {
      return NextResponse.json({ error: 'Pending company not found' }, { status: 404 })
    }

    const { pendingCompany: pc, tier } = row
    return NextResponse.json({
      id:           pc.id,
      name:         pc.name,
      slug:         pc.slug,
      businessType: pc.businessType,
      status:       pc.status,
      expiresAt:    pc.expiresAt,
      billingCycle: pc.billingCycle,
      tier: {
        id:           tier.id,
        name:         tier.name,
        displayName:  tier.displayName,
        priceMonthly: Number(tier.priceMonthly),
        priceYearly:  Number(tier.priceYearly || 0),
        currency:     tier.currency,
      },
    })
  } catch (error) {
    logError('api/account/pending-companies/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
