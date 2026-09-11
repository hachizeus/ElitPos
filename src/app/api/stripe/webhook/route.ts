import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions, sales, paymentGatewayConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyStripeWebhook, retrieveCheckoutSession, buildStripeConfig } from '@/lib/stripe'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'
import { creditWalletFromGateway } from '@/lib/billing/gateway-wallet-credit'

// POST /api/stripe/webhook - Stripe server-to-server event webhook
// Must be excluded from body parsing middleware (raw body required for signature verification)
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature') || ''

    // We need to look up the webhook secret using the session ID from the payload.
    // Parse the event first (unverified), find the tenant, then re-verify.
    let event: { type: string; data: { object: Record<string, unknown> } }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const sessionObj = event.data?.object as {
      id: string
      payment_status: string
      status: string
      metadata?: Record<string, string>
      customer_email?: string
      amount_total?: number
      currency?: string
    }

    if (!sessionObj?.metadata?.internalReference) {
      // Event we don't handle — acknowledge it
      return NextResponse.json({ received: true })
    }

    const { internalReference, tenantId, accountId } = sessionObj.metadata

    // Load the correct webhook secret — platform config for subscription, tenant config for POS
    let webhookSecret = ''
    if (accountId && !tenantId) {
      // Subscription payment — use platform credentials
      const platformConfig = await getPlatformGatewayConfig()
      webhookSecret = platformConfig?.stripeWebhookSecret || ''
    } else if (tenantId) {
      const gatewayConfig = await db.query.paymentGatewayConfigs.findFirst({
        where: eq(paymentGatewayConfigs.tenantId, tenantId),
      })
      const stripeConfig = gatewayConfig ? buildStripeConfig(gatewayConfig) : null
      webhookSecret = stripeConfig?.webhookSecret || ''
    }

    if (webhookSecret && signature) {
      const valid = await verifyStripeWebhook(rawBody, signature, webhookSecret)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
      }
    }

    // Handle relevant event types
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.expired'
    ) {
      const transaction = await db.query.gatewayTransactions.findFirst({
        where: eq(gatewayTransactions.internalReference, internalReference),
      })

      if (!transaction || transaction.status === 'success') {
        return NextResponse.json({ received: true })
      }

      const isPaid = sessionObj.payment_status === 'paid'
      const isExpired = event.type === 'checkout.session.expired'
      const internalStatus = isPaid ? 'success' : isExpired ? 'expired' : 'failed'

      await db
        .update(gatewayTransactions)
        .set({
          status: internalStatus as 'success' | 'failed' | 'expired',
          completedAt: isPaid ? new Date() : null,
          gatewayReference: sessionObj.id,
          customerEmail: sessionObj.customer_email || transaction.customerEmail,
          metadata: {
            ...(transaction.metadata as Record<string, unknown> || {}),
            stripePaymentStatus: sessionObj.payment_status,
            stripeStatus: sessionObj.status,
            eventType: event.type,
          },
          updatedAt: new Date(),
        })
        .where(eq(gatewayTransactions.id, transaction.id))

      // Mark POS sale as completed on success
      if (isPaid && transaction.saleId && transaction.context === 'pos_sale') {
        await db
          .update(sales)
          .set({ status: 'completed', paidAmount: transaction.amount })
          .where(eq(sales.id, transaction.saleId))
      }

      if (isPaid) {
        await creditWalletFromGateway(transaction)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logError('api/stripe/webhook', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
