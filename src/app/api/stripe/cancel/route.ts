import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

// GET /api/stripe/cancel?ref=INTERNAL_REF
// Called when customer cancels out of Stripe Checkout
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const internalRef = searchParams.get('ref')

    if (internalRef) {
      const transaction = await db.query.gatewayTransactions.findFirst({
        where: eq(gatewayTransactions.internalReference, internalRef),
      })
      if (transaction && transaction.status === 'pending') {
        await db
          .update(gatewayTransactions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(gatewayTransactions.id, transaction.id))
      }
    }

    return NextResponse.redirect(
      new URL(`/pos?stripe_cancelled=1${internalRef ? `&ref=${internalRef}` : ''}`, request.url)
    )
  } catch (error) {
    logError('api/stripe/cancel', error)
    return NextResponse.redirect(new URL('/pos', request.url))
  }
}
