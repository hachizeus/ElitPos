import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { db, withTenant } from '@/lib/db'
import { gatewayTransactions, paymentGatewayConfigs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { retrieveCheckoutSession, buildStripeConfig } from '@/lib/stripe'
import { logError } from '@/lib/ai/error-logger'

// GET /api/stripe/success?ref=INTERNAL_REF&stripe_session=SESSION_ID
// Called when the customer returns from Stripe Checkout
export async function GET(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session?.user?.tenantId) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { searchParams } = new URL(request.url)
    const internalRef = searchParams.get('ref')
    const stripeSessionId = searchParams.get('stripe_session')

    if (!internalRef) {
      return NextResponse.redirect(new URL('/pos', request.url))
    }

    const transaction = await db.query.gatewayTransactions.findFirst({
      where: and(
        eq(gatewayTransactions.internalReference, internalRef),
        eq(gatewayTransactions.tenantId, session.user.tenantId)
      ),
    })

    if (!transaction) {
      return NextResponse.redirect(new URL('/pos?stripe_error=not_found', request.url))
    }

    // If webhook already resolved it, just redirect
    if (transaction.status === 'success') {
      return NextResponse.redirect(
        new URL(`/pos?stripe_success=1&ref=${internalRef}`, request.url)
      )
    }

    // Poll Stripe directly in case webhook hasn't arrived yet
    const config = await withTenant(session.user.tenantId, async (tdb) => {
      return tdb.query.paymentGatewayConfigs.findFirst({
        where: eq(paymentGatewayConfigs.tenantId, session.user.tenantId),
      })
    })

    const stripeConfig = config ? buildStripeConfig(config) : null
    if (stripeConfig && stripeSessionId) {
      try {
        const stripeSession = await retrieveCheckoutSession(stripeConfig.secretKey, stripeSessionId)
        if (stripeSession.payment_status === 'paid') {
          await db
            .update(gatewayTransactions)
            .set({ status: 'success', completedAt: new Date(), updatedAt: new Date() })
            .where(eq(gatewayTransactions.id, transaction.id))

          return NextResponse.redirect(
            new URL(`/pos?stripe_success=1&ref=${internalRef}`, request.url)
          )
        }
      } catch {
        // Fall through to pending redirect
      }
    }

    return NextResponse.redirect(
      new URL(`/pos?stripe_pending=1&ref=${internalRef}`, request.url)
    )
  } catch (error) {
    logError('api/stripe/success', error)
    return NextResponse.redirect(new URL('/pos?stripe_error=1', request.url))
  }
}
