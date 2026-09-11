import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

// GET /api/payhero/cancel?ref=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref') || ''

    if (ref) {
      const transaction = await db.query.gatewayTransactions.findFirst({
        where: eq(gatewayTransactions.internalReference, ref),
      })
      if (transaction && transaction.status === 'pending') {
        await db
          .update(gatewayTransactions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(gatewayTransactions.id, transaction.id))
      }
    }

    return NextResponse.redirect(
      new URL(`/pos?payhero_cancelled=1${ref ? `&ref=${ref}` : ''}`, request.url)
    )
  } catch (error) {
    logError('api/payhero/cancel', error)
    return NextResponse.redirect(new URL('/pos', request.url))
  }
}
