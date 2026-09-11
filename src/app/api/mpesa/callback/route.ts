import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions, sales } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
import { mpesaResultToStatus } from '@/lib/mpesa'
import { logError } from '@/lib/ai/error-logger'
import { creditWalletFromGateway } from '@/lib/billing/gateway-wallet-credit'
import { activateSubscriptionFromGateway } from '@/lib/billing/activate-subscription-from-gateway'

// Safaricom STK Push callback payload shape
interface MpesaStkCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string
      CheckoutRequestID: string
      ResultCode: number
      ResultDesc: string
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>
      }
    }
  }
}

// POST /api/mpesa/callback - Safaricom server-to-server webhook
// This endpoint receives the result of an STK Push initiated by the customer.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MpesaStkCallback
    const callback = body?.Body?.stkCallback

    if (!callback) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback

    // Extract metadata items from callback
    const metaItems: Record<string, string | number> = {}
    if (CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        if (item.Value !== undefined) {
          metaItems[item.Name] = item.Value
        }
      }
    }

    // Find the matching transaction by CheckoutRequestID (stored in gatewayReference)
    const transaction = await db.query.gatewayTransactions.findFirst({
      where: eq(gatewayTransactions.gatewayReference, CheckoutRequestID),
    })

    if (!transaction) {
      // Acknowledge even if we can't find it — prevents Safaricom retries
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    // Idempotency: skip already completed transactions
    if (transaction.status === 'success' || transaction.status === 'failed') {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    const internalStatus = mpesaResultToStatus(String(ResultCode))

    await db
      .update(gatewayTransactions)
      .set({
        status: internalStatus,
        completedAt: new Date(),
        metadata: {
          ...(transaction.metadata as Record<string, unknown> || {}),
          resultCode: ResultCode,
          resultDesc: ResultDesc,
          mpesaReceiptNumber: metaItems['MpesaReceiptNumber'],
          transactionDate: metaItems['TransactionDate'],
          phoneNumber: metaItems['PhoneNumber'],
          amount: metaItems['Amount'],
        },
        updatedAt: new Date(),
      })
      .where(eq(gatewayTransactions.id, transaction.id))

    // If it was a POS sale payment and it succeeded, mark sale as paid
    if (internalStatus === 'success' && transaction.saleId && transaction.context === 'pos_sale') {
      await db
        .update(sales)
        .set({ status: 'completed', paidAmount: transaction.amount })
        .where(eq(sales.id, transaction.saleId))
    }

    // If it was a wallet top-up, credit the account balance
    if (internalStatus === 'success') {
      await creditWalletFromGateway(transaction)
      await activateSubscriptionFromGateway(transaction)
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) {
    logError('api/mpesa/callback', error)
    // Always acknowledge to prevent Safaricom retry flood
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
}
