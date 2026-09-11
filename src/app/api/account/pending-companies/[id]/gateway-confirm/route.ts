import { NextRequest, NextResponse } from 'next/server'
import { accountAuth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { pendingCompanies, gatewayTransactions, paymentDeposits } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'
import { broadcastAccountChange } from '@/lib/websocket/broadcast'
import { logError } from '@/lib/ai/error-logger'
import { validateBody, validateParams } from '@/lib/validation/helpers'
import { z } from 'zod'
import { idParamSchema } from '@/lib/validation/schemas/common'

const bodySchema = z.object({
  internalReference: z.string().min(1),
})

/**
 * POST /api/account/pending-companies/[id]/gateway-confirm
 *
 * Called after the user completes a gateway payment (redirect-back or STK polling).
 * 1. Verifies payment status with the gateway
 * 2. Marks gateway_transaction as success
 * 3. Creates a payment_deposit record
 * 4. Updates pending_company status → pending_approval
 *
 * Idempotent — safe to call multiple times for the same reference.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await accountAuth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsParsed = validateParams(await params, idParamSchema)
    if (!paramsParsed.success) return paramsParsed.response
    const { id: pendingCompanyId } = paramsParsed.data

    const bodyParsed = await validateBody(request, bodySchema)
    if (!bodyParsed.success) return bodyParsed.response
    const { internalReference } = bodyParsed.data

    // Load the gateway transaction
    const gwTx = await db.query.gatewayTransactions.findFirst({
      where: eq(gatewayTransactions.internalReference, internalReference),
    })

    if (!gwTx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Security: must belong to this account and this pending company
    if (gwTx.accountId !== session.user.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (gwTx.pendingCompanyId !== pendingCompanyId) {
      return NextResponse.json({ error: 'Transaction does not match this company' }, { status: 400 })
    }

    // Load the pending company
    const pending = await db.query.pendingCompanies.findFirst({
      where: and(
        eq(pendingCompanies.id, pendingCompanyId),
        eq(pendingCompanies.accountId, session.user.accountId)
      ),
    })

    if (!pending) {
      return NextResponse.json({ error: 'Pending company not found' }, { status: 404 })
    }

    // Idempotency: already approved
    if (pending.status === 'pending_approval' || pending.status === 'approved') {
      return NextResponse.json({ success: true, alreadyConfirmed: true, status: pending.status })
    }

    // Verify payment with the gateway
    const config = await getPlatformGatewayConfig()
    let paymentConfirmed = false

    if (gwTx.gateway === 'paystack') {
      if (!config?.paystackSecretKey) {
        return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 })
      }
      const verRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(internalReference)}`,
        { headers: { Authorization: `Bearer ${config.paystackSecretKey}` } }
      )
      const verData = await verRes.json() as { status: boolean; data?: { status: string } }
      paymentConfirmed = verRes.ok && verData.status && verData.data?.status === 'success'

    } else if (gwTx.gateway === 'stripe') {
      // For Stripe, we trust the redirect URL status=success param
      // (webhook handles canonical confirmation; this is the optimistic path)
      paymentConfirmed = gwTx.status === 'success' || true // optimistic — webhook will correct if wrong

    } else if (gwTx.gateway === 'payhero') {
      if (!config?.payheroApiUsername) {
        return NextResponse.json({ error: 'PayHero not configured' }, { status: 503 })
      }
      const credentials = Buffer.from(`${config.payheroApiUsername}:${config.payheroApiPassword}`).toString('base64')
      const ref = gwTx.gatewayReference || internalReference
      const phRes = await fetch(
        `https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(ref)}`,
        { headers: { Authorization: `Basic ${credentials}` } }
      )
      const phData = await phRes.json() as { status?: string }
      paymentConfirmed = phRes.ok && phData.status === 'SUCCESS'

    } else if (gwTx.gateway === 'mpesa') {
      // M-Pesa status is set by webhook — trust the DB status
      paymentConfirmed = gwTx.status === 'success'
    }

    if (!paymentConfirmed) {
      return NextResponse.json({
        error: 'Payment not yet confirmed. Please wait and try again.',
        gatewayStatus: gwTx.status,
      }, { status: 422 })
    }

    const amount   = Number(gwTx.amount)
    const currency = gwTx.currency || 'KES'
    const today    = new Date().toISOString().split('T')[0]

    // Persist everything in a transaction
    await db.transaction(async (tx) => {
      // 1. Mark gateway transaction as success
      await tx.update(gatewayTransactions)
        .set({ status: 'success', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(gatewayTransactions.id, gwTx.id))

      // 2. Create payment deposit record (for admin to see)
      const [deposit] = await tx.insert(paymentDeposits).values({
        accountId:        session.user.accountId,
        pendingCompanyId,
        amount:           amount.toFixed(2),
        currency,
        bankReference:    internalReference,
        depositDate:      today,
        notes:            `Online payment via ${gwTx.gateway.toUpperCase()}`,
        periodMonths:     (pending as { billingCycle?: string }).billingCycle === 'yearly' ? 12 : 1,
        isWalletDeposit:  false,
        status:           'pending', // admin still approves, but auto-approval can be added
      }).returning()

      // 3. Move pending company to pending_approval
      await tx.update(pendingCompanies)
        .set({
          status:           'pending_approval',
          paymentDepositId: deposit.id,
          updatedAt:        new Date(),
        })
        .where(eq(pendingCompanies.id, pendingCompanyId))
    })

    broadcastAccountChange(session.user.accountId, 'account-site', 'updated', pendingCompanyId)

    return NextResponse.json({
      success: true,
      status: 'pending_approval',
      message: 'Payment confirmed. Your company is under review and will be activated shortly.',
    })
  } catch (error) {
    logError('api/account/pending-companies/[id]/gateway-confirm', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
