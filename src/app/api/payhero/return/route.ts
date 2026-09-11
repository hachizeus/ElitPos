import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

// GET /api/payhero/return?ref=...
// Redirect landing page after PayHero web payment flow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref') || ''

    if (!ref) return NextResponse.redirect(new URL('/pos', request.url))

    const transaction = await db.query.gatewayTransactions.findFirst({
      where: eq(gatewayTransactions.internalReference, ref),
    })

    if (!transaction) {
      return NextResponse.redirect(new URL('/pos?payhero_error=not_found', request.url))
    }

    if (transaction.status === 'success') {
      return NextResponse.redirect(new URL(`/pos?payhero_success=1&ref=${ref}`, request.url))
    }

    return NextResponse.redirect(new URL(`/pos?payhero_pending=1&ref=${ref}`, request.url))
  } catch (error) {
    logError('api/payhero/return', error)
    return NextResponse.redirect(new URL('/pos', request.url))
  }
}
