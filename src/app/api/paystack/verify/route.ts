import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { accountAuth } from '@/lib/auth/account-auth'
import { db, withTenant } from '@/lib/db'
import { gatewayTransactions, paymentGatewayConfigs, sales } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { verifyTransaction, buildPaystackConfig, paystackStatusToInternal } from '@/lib/paystack'
import { validateSearchParams } from '@/lib/validation/helpers'
import { paystackVerifySchema } from '@/lib/validation/schemas/gateways'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'
import { activateSubscriptionFromGateway } from '@/lib/billing/activate-subscription-from-gateway'
import { creditWalletFromGateway } from '@/lib/billing/gateway-wallet-credit'

// GET /api/paystack/verify?reference=... - Verify a Paystack transaction after redirect
// Works for both company sessions (POS) and account sessions (subscription/wallet)
export async function GET(request: NextRequest) {
  try {
    const parsed = validateSearchParams(request, paystackVerifySchema)
    if (!parsed.success) return parsed.response
    const { reference } = parsed.data

    // Try company session first (POS context), then fall back to account session (subscription/wallet)
    const companySession = await authWithCompany()
    const accountSession = await accountAuth()

    if (!companySession?.user?.tenantId && !accountSession?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the transaction — match by internalReference scoped to the caller
    let transaction = null
    if (companySession?.user?.tenantId) {
      transaction = await db.query.gatewayTransactions.findFirst({
        where: and(
          eq(gatewayTransactions.internalReference, reference),
          eq(gatewayTransactions.tenantId, companySession.user.tenantId)
        ),
      })
    }
    // If not found via tenant, try account (subscription/wallet payments)
    if (!transaction && accountSession?.user?.accountId) {
      transaction = await db.query.gatewayTransactions.findFirst({
        where: eq(gatewayTransactions.internalReference, reference),
      })
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Already resolved
    if (transaction.status === 'success' || transaction.status === 'failed') {
      return NextResponse.json({ status: transaction.status, reference })
    }

    // Get the right Paystack config based on context
    let secretKey: string | null = null
    if (transaction.context === 'subscription' || !transaction.tenantId) {
      // Platform credentials
      const platformConfig = await getPlatformGatewayConfig()
      secretKey = platformConfig?.paystackSecretKey || null
    } else if (transaction.tenantId) {
      // Tenant credentials
      const config = await withTenant(transaction.tenantId, async (tdb) => {
        return tdb.query.paymentGatewayConfigs.findFirst({
          where: eq(paymentGatewayConfigs.tenantId, transaction.tenantId!),
        })
      })
      const psConfig = config ? buildPaystackConfig(config) : null
      secretKey = psConfig?.secretKey || null
    }

    if (!secretKey) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 })
    }

    const psResult = await verifyTransaction(secretKey, reference)
    const internalStatus = paystackStatusToInternal(psResult.status)

    await db
      .update(gatewayTransactions)
      .set({
        status: internalStatus,
        completedAt: internalStatus === 'success' ? new Date() : null,
        metadata: {
          ...(transaction.metadata as Record<string, unknown> || {}),
          paystackStatus: psResult.status,
          channel: psResult.channel,
          paidAt: psResult.paid_at,
          authorization: psResult.authorization,
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

    // Activate subscription or credit wallet on success
    if (internalStatus === 'success') {
      await activateSubscriptionFromGateway(transaction)
      await creditWalletFromGateway(transaction)
    }

    return NextResponse.json({ status: internalStatus, reference })
  } catch (error) {
    logError('api/paystack/verify', error)
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
  }
}
