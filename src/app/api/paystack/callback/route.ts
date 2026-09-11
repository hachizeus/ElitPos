import { NextRequest, NextResponse } from 'next/server'
import { db, withTenant } from '@/lib/db'
import { gatewayTransactions, paymentGatewayConfigs, sales } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyTransaction, buildPaystackConfig, paystackStatusToInternal } from '@/lib/paystack'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'
import { creditWalletFromGateway } from '@/lib/billing/gateway-wallet-credit'
import { activateSubscriptionFromGateway } from '@/lib/billing/activate-subscription-from-gateway'
import { logError } from '@/lib/ai/error-logger'

// GET /api/paystack/callback?reference=...&trxref=...
// Paystack redirects the customer here after payment.
// Handles both POS (tenant) and account-level (subscription / wallet top-up) payments.
export async function GET(request: NextRequest) {
  // Always use the configured app URL as the base for redirects — never inherit
  // the server binding address (0.0.0.0) from request.url, which is unreachable in browsers.
  const appBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirect = (path: string) => NextResponse.redirect(`${appBase}${path}`)

  try {
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference') || searchParams.get('trxref') || ''

    if (!reference) {
      return redirect('/pos?paystack_error=missing_ref')
    }

    const transaction = await db.query.gatewayTransactions.findFirst({
      where: eq(gatewayTransactions.internalReference, reference),
    })

    if (!transaction) {
      return redirect('/pos?paystack_error=not_found')
    }

    // ── Account-context payment (subscription upgrade / wallet top-up) ──────
    const isAccountPayment = !!transaction.accountId && !transaction.tenantId

    if (isAccountPayment) {
      // Determine where to send the user on success/failure
      // Subscription upgrades go back to the subscription page; wallet top-ups go to wallet
      const successPath = transaction.subscriptionId
        ? `/account/subscription/${transaction.subscriptionId}?paystack_ref=${reference}&paystack_status=success`
        : `/account/wallet?paystack_ref=${reference}&paystack_status=success`
      const failedPath = transaction.subscriptionId
        ? `/account/subscription/${transaction.subscriptionId}?paystack_ref=${reference}&paystack_status=failed`
        : `/account/wallet?paystack_ref=${reference}&paystack_status=failed`

      // Already resolved — just redirect
      if (transaction.status === 'success') return redirect(successPath)
      if (transaction.status === 'failed' || transaction.status === 'cancelled') return redirect(failedPath)

      // Verify with platform Paystack credentials
      const platformConfig = await getPlatformGatewayConfig()
      if (!platformConfig?.paystackSecretKey) {
        return redirect('/account/wallet?paystack_status=error')
      }

      const psResult = await verifyTransaction(platformConfig.paystackSecretKey, reference)
      const internalStatus = paystackStatusToInternal(psResult.status)

      await db
        .update(gatewayTransactions)
        .set({
          status: internalStatus,
          completedAt: internalStatus === 'success' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(gatewayTransactions.id, transaction.id))

      if (internalStatus === 'success') {
        await creditWalletFromGateway(transaction)
        await activateSubscriptionFromGateway(transaction)
      }

      return redirect(internalStatus === 'success' ? successPath : failedPath)
    }

    // ── POS / tenant payment ─────────────────────────────────────────────────
    if (!transaction.tenantId) {
      return redirect('/pos?paystack_error=not_found')
    }

    if (transaction.status === 'success') {
      return redirect(`/pos?paystack_success=1&ref=${reference}`)
    }
    if (transaction.status === 'failed' || transaction.status === 'cancelled') {
      return redirect(`/pos?paystack_failed=1&ref=${reference}`)
    }

    const config = await withTenant(transaction.tenantId, async (tdb) => {
      return tdb.query.paymentGatewayConfigs.findFirst({
        where: eq(paymentGatewayConfigs.tenantId, transaction.tenantId!),
      })
    })

    const psConfig = config ? buildPaystackConfig(config) : null
    if (!psConfig) {
      return redirect('/pos?paystack_error=config')
    }

    const psResult = await verifyTransaction(psConfig.secretKey, reference)
    const internalStatus = paystackStatusToInternal(psResult.status)

    await db
      .update(gatewayTransactions)
      .set({
        status: internalStatus,
        completedAt: internalStatus === 'success' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(gatewayTransactions.id, transaction.id))

    if (internalStatus === 'success' && transaction.saleId && transaction.context === 'pos_sale') {
      await db
        .update(sales)
        .set({ status: 'completed', paidAmount: transaction.amount })
        .where(eq(sales.id, transaction.saleId))
    }

    const dest = internalStatus === 'success' ? 'paystack_success=1' : 'paystack_failed=1'
    return redirect(`/pos?${dest}&ref=${reference}`)
  } catch (error) {
    logError('api/paystack/callback', error)
    return redirect('/pos?paystack_error=1')
  }
}
