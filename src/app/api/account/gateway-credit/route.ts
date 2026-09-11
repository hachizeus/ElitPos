import { NextRequest, NextResponse } from 'next/server'
import { accountAuth as auth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { accounts, creditTransactions, gatewayTransactions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'
import { broadcastAccountChange } from '@/lib/websocket/broadcast'

/**
 * POST /api/account/gateway-credit
 *
 * Called by the wallet page after a gateway confirms payment,
 * to credit the wallet balance and record the transaction.
 *
 * Body: { internalReference: string }
 *
 * Idempotent — won't double-credit if called twice for the same reference.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TypeScript narrowing - accountId is guaranteed to be non-null after the check above
    const accountId = session.user.accountId

    const body = await request.json() as { internalReference?: string }
    const { internalReference } = body

    if (!internalReference) {
      return NextResponse.json({ error: 'internalReference is required' }, { status: 400 })
    }

    // Find the gateway transaction — must belong to this account
    const gatewayTx = await db.query.gatewayTransactions.findFirst({
      where: eq(gatewayTransactions.internalReference, internalReference),
    })

    if (!gatewayTx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Security: verify the transaction belongs to this account or has no account (tenant payment)
    if (gatewayTx.accountId && gatewayTx.accountId !== accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only credit for confirmed payments
    if (gatewayTx.status !== 'success') {
      return NextResponse.json({ error: 'Payment has not been confirmed yet', status: gatewayTx.status }, { status: 422 })
    }

    // Only credit wallet-context payments (context = subscription means it was a wallet top-up or plan payment)
    // For wallet top-ups, context is 'subscription' (no saleId, no subscriptionId)
    const isWalletTopup = gatewayTx.context === 'subscription' && !gatewayTx.subscriptionId && !gatewayTx.saleId

    if (!isWalletTopup) {
      return NextResponse.json({ error: 'This payment is not a wallet top-up' }, { status: 422 })
    }

    const amount = Number(gatewayTx.amount)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Idempotency: check if we already credited this reference
    const existingCredit = await db.query.creditTransactions.findFirst({
      where: eq(creditTransactions.accountId, accountId),
    })
    // Check description for this reference
    const allCredits = await db.query.creditTransactions.findMany({
      where: eq(creditTransactions.accountId, accountId),
      columns: { description: true },
    })
    const alreadyCredited = allCredits.some(tx => tx.description?.includes(internalReference))
    if (alreadyCredited) {
      // Return current balance — already done
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
        columns: { walletBalance: true, currency: true },
      })
      return NextResponse.json({
        success: true,
        balance: Number(account?.walletBalance || 0),
        alreadyCredited: true,
      })
    }

    // Credit the wallet inside a transaction
    const result = await db.transaction(async (tx) => {
      // Lock the account row and update balance
      const [updatedAccount] = await tx
        .update(accounts)
        .set({
          walletBalance: sql`${accounts.walletBalance} + ${amount.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId))
        .returning({ walletBalance: accounts.walletBalance, currency: accounts.currency })

      const newBalance = Number(updatedAccount.walletBalance)

      // Record the credit transaction
      await tx.insert(creditTransactions).values({
        accountId,
        type: 'credit',
        amount: amount.toFixed(2),
        currency: gatewayTx.currency || updatedAccount.currency || 'KES',
        description: `Wallet top-up via ${gatewayTx.gateway.toUpperCase()} [ref: ${internalReference}]`,
        balanceAfter: newBalance.toFixed(2),
      })

      return { balance: newBalance, currency: updatedAccount.currency || 'KES' }
    })

    // Broadcast wallet update for real-time refresh
    broadcastAccountChange(accountId, 'account-wallet', 'updated', accountId)

    return NextResponse.json({
      success: true,
      balance: result.balance,
      currency: result.currency,
      amount,
    })
  } catch (error) {
    logError('api/account/gateway-credit', error)
    return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 })
  }
}
