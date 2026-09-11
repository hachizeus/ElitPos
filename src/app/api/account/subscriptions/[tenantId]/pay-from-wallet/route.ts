import { NextResponse } from 'next/server'
import { accountAuth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { renewFromWallet } from '@/lib/billing/renew-from-wallet'
import { logError } from '@/lib/ai/error-logger'
import { validateParams } from '@/lib/validation/helpers'
import { idParamSchema } from '@/lib/validation/schemas/common'

/**
 * POST /api/account/subscriptions/[tenantId]/pay-from-wallet
 *
 * Manually trigger wallet-based renewal for a subscription.
 * The user must own the subscription (via billingAccountId).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await accountAuth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsParsed = validateParams(await params, idParamSchema)
    if (!paramsParsed.success) return paramsParsed.response
    const { id: tenantId } = paramsParsed.data

    // Find subscription by tenantId (since each tenant has one subscription)
    const sub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.billingAccountId, session.user.accountId)
      ),
    })

    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const result = await renewFromWallet(sub.id)

    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      newPeriodEnd: result.newPeriodEnd,
      amountCharged: result.amountCharged,
      message: `Subscription renewed until ${result.newPeriodEnd?.toLocaleDateString('en-KE')}`,
    })
  } catch (error) {
    logError('api/account/subscriptions/[tenantId]/pay-from-wallet', error)
    return NextResponse.json({ error: 'Failed to process wallet payment' }, { status: 500 })
  }
}
