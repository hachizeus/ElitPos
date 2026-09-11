import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayTransactions } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { validateAdminSession } from '@/lib/admin'
import { logError } from '@/lib/ai/error-logger'

// GET /api/sys-control/gateway-transactions
// Returns all gateway transactions across M-Pesa, Stripe, Paystack, PayHero
export async function GET(request: NextRequest) {
  try {
    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const gateway = searchParams.get('gateway') || 'all'

    const conditions = []
    if (status !== 'all') {
      conditions.push(
        eq(
          gatewayTransactions.status,
          status as 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'expired' | 'refunded'
        )
      )
    }
    if (gateway !== 'all') {
      conditions.push(
        eq(
          gatewayTransactions.gateway,
          gateway as 'mpesa' | 'stripe' | 'paystack' | 'payhero'
        )
      )
    }

    const transactions = await db.query.gatewayTransactions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        tenant: { columns: { id: true, name: true, slug: true } },
        account: { columns: { id: true, email: true, fullName: true } },
        sale: { columns: { id: true, invoiceNo: true, total: true } },
        subscription: {
          columns: { id: true, status: true },
          with: { tier: { columns: { displayName: true } } },
        },
      },
      orderBy: [desc(gatewayTransactions.createdAt)],
      limit: 300,
    })

    return NextResponse.json(transactions)
  } catch (error) {
    logError('api/sys-control/gateway-transactions', error)
    return NextResponse.json({ error: 'Failed to fetch gateway transactions' }, { status: 500 })
  }
}
