import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions, paymentGatewayConfigs, sales } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPaystackWebhook, paystackStatusToInternal, buildPaystackConfig } from '@/lib/paystack'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'
import { creditWalletFromGateway } from '@/lib/billing/gateway-wallet-credit'
import { activateSubscriptionFromGateway } from '@/lib/billing/activate-subscription-from-gateway'

// POST /api/paystack/webhook - Paystack server-to-server event notification
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature') || ''

    let event: { event: string; data: Record<string, unknown> }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Extract reference from event data
    const reference = (event.data?.reference as string) || ''
    if (!reference) return NextResponse.json({ received: true })

    // Find transaction to get tenant, then verify with tenant's webhook secret
    const transaction = await db.query.gatewayTransactions.findFirst({
      where: eq(gatewayTransactions.internalReference, reference),
    })

    if (!transaction) return NextResponse.json({ received: true })

    // Verify webhook signature using the correct secret key
    // For subscription context, use platform credentials; for POS, use tenant credentials
    if (transaction.tenantId) {
      const config = await db.query.paymentGatewayConfigs.findFirst({
        where: eq(paymentGatewayConfigs.tenantId, transaction.tenantId),
      })
      const psConfig = config ? buildPaystackConfig(config) : null
      if (psConfig?.secretKey && signature) {
        const valid = await verifyPaystackWebhook(rawBody, signature, psConfig.secretKey)
        if (!valid) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
        }
      }
    } else if (transaction.accountId) {
      // Subscription payment — verify with platform credentials
      const platformConfig = await getPlatformGatewayConfig()
      if (platformConfig?.paystackSecretKey && signature) {
        const valid = await verifyPaystackWebhook(rawBody, signature, platformConfig.paystackSecretKey)
        if (!valid) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
        }
      }
    }

    // Idempotency guard
    if (transaction.status === 'success') return NextResponse.json({ received: true })

    if (event.event === 'charge.success' || event.event === 'charge.failed') {
      const paystackStatus = event.event === 'charge.success' ? 'success' : 'failed'
      const internalStatus = paystackStatusToInternal(paystackStatus)

      await db
        .update(gatewayTransactions)
        .set({
          status: internalStatus,
          completedAt: internalStatus === 'success' ? new Date() : null,
          metadata: {
            ...(transaction.metadata as Record<string, unknown> || {}),
            paystackEvent: event.event,
            channel: event.data?.channel,
            paidAt: event.data?.paid_at,
          },
          updatedAt: new Date(),
        })
        .where(eq(gatewayTransactions.id, transaction.id))

      if (internalStatus === 'success' && transaction.saleId && transaction.context === 'pos_sale') {
        await db
          .update(sales)
          .set({ status: 'completed', paidAmount: transaction.amount })
          .where(eq(sales.id, transaction.saleId))
      }

      if (internalStatus === 'success') {
        // Credit wallet for wallet top-ups
        await creditWalletFromGateway(transaction)
        // Activate subscription for subscription payments
        await activateSubscriptionFromGateway(transaction)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logError('api/paystack/webhook', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
