/**
 * Credit a user's wallet after a successful gateway payment.
 * Called from M-Pesa callback, Paystack webhook, PayHero notify, and Stripe webhook
 * when context = 'subscription' and there is no subscriptionId (= wallet top-up).
 *
 * Idempotent — checks for existing credit by internalReference before inserting.
 */
import { db } from '@/lib/db'
import { accounts, creditTransactions, gatewayTransactions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { broadcastAccountChange } from '@/lib/websocket/broadcast'
import { logError } from '@/lib/ai/error-logger'

export async function creditWalletFromGateway(
  transaction: {
    id: string
    accountId: string | null
    internalReference: string
    amount: string
    currency: string
    gateway: string
    context: string
    subscriptionId: string | null
    saleId: string | null
  }
): Promise<void> {
  // Only credit when: context=subscription, no subscriptionId (= wallet top-up), accountId set
  if (
    transaction.context !== 'subscription' ||
    transaction.subscriptionId ||
    transaction.saleId ||
    !transaction.accountId
  ) return

  const amount = Number(transaction.amount)
  if (isNaN(amount) || amount <= 0) return

  try {
    // Idempotency check — scan descriptions for this reference
    const existingCredits = await db.query.creditTransactions.findMany({
      where: eq(creditTransactions.accountId, transaction.accountId),
      columns: { description: true },
      limit: 200,
    })
    const alreadyCredited = existingCredits.some(tx =>
      tx.description?.includes(transaction.internalReference)
    )
    if (alreadyCredited) return

    // Credit inside a DB transaction
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(accounts)
        .set({
          walletBalance: sql`${accounts.walletBalance} + ${amount.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, transaction.accountId!))
        .returning({ walletBalance: accounts.walletBalance, currency: accounts.currency })

      const newBalance = Number(updated.walletBalance)

      await tx.insert(creditTransactions).values({
        accountId: transaction.accountId!,
        type: 'credit',
        amount: amount.toFixed(2),
        currency: transaction.currency || updated.currency || 'KES',
        description: `Wallet top-up via ${transaction.gateway.toUpperCase()} [ref: ${transaction.internalReference}]`,
        balanceAfter: newBalance.toFixed(2),
      })
    })

    // Real-time broadcast
    broadcastAccountChange(transaction.accountId, 'account-wallet', 'updated', transaction.accountId)
  } catch (err) {
    logError('gateway-wallet-credit', err)
  }
}
