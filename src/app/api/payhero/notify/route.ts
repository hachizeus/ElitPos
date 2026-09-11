import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions, sales } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
import { payheroStatusToInternal } from '@/lib/payhero'
import { logError } from '@/lib/ai/error-logger'
import { creditWalletFromGateway } from '@/lib/billing/gateway-wallet-credit'
import { activateSubscriptionFromGateway } from '@/lib/billing/activate-subscription-from-gateway'

// POST /api/payhero/notify - PayHero server-to-server callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      status?: string
      external_reference?: string
      merchant_reference?: string
      amount?: number
      phone_number?: string
      receipt_number?: string
      [key: string]: unknown
    }

    const externalRef = body.external_reference || body.merchant_reference || ''

    if (!externalRef) {
      return NextResponse.json({ success: true })
    }

    // Find by internalReference (external_reference we sent) or gatewayReference
    const transaction = await db.query.gatewayTransactions.findFirst({
      where: or(
        eq(gatewayTransactions.internalReference, externalRef),
        eq(gatewayTransactions.gatewayReference, externalRef)
      ),
    })

    if (!transaction) {
      return NextResponse.json({ success: true })
    }

    // Idempotency
    if (transaction.status === 'success' || transaction.status === 'failed') {
      return NextResponse.json({ success: true })
    }

    const internalStatus = payheroStatusToInternal(body.status || 'PENDING')

    await db
      .update(gatewayTransactions)
      .set({
        status: internalStatus,
        completedAt: internalStatus === 'success' ? new Date() : null,
        customerPhone: body.phone_number || transaction.customerPhone,
        metadata: {
          ...(transaction.metadata as Record<string, unknown> || {}),
          payheroStatus: body.status,
          receiptNumber: body.receipt_number,
          phoneNumber: body.phone_number,
          payheroAmount: body.amount,
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
      await creditWalletFromGateway(transaction)
      await activateSubscriptionFromGateway(transaction)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('api/payhero/notify', error)
    return NextResponse.json({ success: true }) // Always acknowledge
  }
}
