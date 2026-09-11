/**
 * renewFromWallet
 *
 * Renews a subscription by debiting the billing account's wallet balance.
 * Only runs if the wallet has sufficient funds to cover the renewal price.
 *
 * Used in two contexts:
 *  1. Cron job (auto-renewal) — called before locking expired subscriptions
 *  2. Manual trigger — user clicks "Pay from Wallet" on the billing page
 *
 * Returns:
 *  { success: true }  — renewed and wallet debited
 *  { success: false, reason: string } — not renewed (insufficient funds, not found, etc.)
 */

import { db } from '@/lib/db'
import {
  subscriptions, tenants, accounts, creditTransactions, accountNotifications, pricingTiers,
} from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getNextPeriodDates } from '@/lib/billing/proration'
import { broadcastAccountChange } from '@/lib/websocket/broadcast'
import { logError } from '@/lib/ai/error-logger'

export interface RenewFromWalletResult {
  success: boolean
  reason?: string
  newPeriodEnd?: Date
  amountCharged?: number
}

export async function renewFromWallet(subscriptionId: string): Promise<RenewFromWalletResult> {
  try {
    // 1. Load the subscription with its tier pricing
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
    })
    if (!sub) return { success: false, reason: 'Subscription not found' }
    if (!sub.billingAccountId) return { success: false, reason: 'No billing account linked' }

    // 2. Determine renewal amount from locked price or current tier price
    const tier = await db.query.pricingTiers.findFirst({
      where: eq(pricingTiers.id, sub.tierId),
    })
    if (!tier) return { success: false, reason: 'Pricing tier not found' }

    const billingCycle = (sub.billingCycle || 'monthly') as 'monthly' | 'yearly'

    // Use the price that was locked in at subscription time (protects user from price increases)
    const renewalAmount = billingCycle === 'yearly'
      ? Number(sub.subscribedPriceYearly || tier.priceYearly || Number(tier.priceMonthly) * 12 * 0.833)
      : Number(sub.subscribedPriceMonthly || tier.priceMonthly)

    if (!renewalAmount || renewalAmount <= 0) {
      return { success: false, reason: 'Invalid renewal amount' }
    }

    // 3. Check wallet balance
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, sub.billingAccountId),
      columns: { id: true, walletBalance: true, currency: true, email: true },
    })
    if (!account) return { success: false, reason: 'Billing account not found' }

    const walletBalance = Number(account.walletBalance || 0)
    if (walletBalance < renewalAmount) {
      return {
        success: false,
        reason: `Insufficient wallet balance. Need ${renewalAmount.toFixed(2)}, have ${walletBalance.toFixed(2)}`,
      }
    }

    // 4. Compute new period dates
    const now = new Date()
    // Start new period from current period end (not now) to avoid gap/overlap
    const renewFrom = sub.currentPeriodEnd && sub.currentPeriodEnd > now
      ? sub.currentPeriodEnd
      : now
    const { periodStart, periodEnd } = getNextPeriodDates(renewFrom, billingCycle)

    // 5. Debit wallet + update subscription atomically
    await db.transaction(async (tx) => {
      // Deduct from wallet
      const [updatedAccount] = await tx
        .update(accounts)
        .set({
          walletBalance: sql`${accounts.walletBalance} - ${renewalAmount.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, sub.billingAccountId!))
        .returning({ walletBalance: accounts.walletBalance, currency: accounts.currency })

      const newBalance = Number(updatedAccount.walletBalance)
      const currency = updatedAccount.currency || 'KES'

      // Record the debit transaction
      await tx.insert(creditTransactions).values({
        accountId: sub.billingAccountId!,
        type: 'debit',
        amount: renewalAmount.toFixed(2),
        currency,
        description: `Subscription renewal — ${tier.displayName || tier.name} (${billingCycle}) for period ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`,
        balanceAfter: newBalance.toFixed(2),
      })

      // Renew subscription
      await tx.update(subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          lastPaymentAt: now,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscriptionId))

      // Unlock tenant if it was locked/past_due
      await tx.update(tenants)
        .set({
          status: 'active',
          lockedAt: null,
          lockedReason: null,
          deletionScheduledAt: null,
          updatedAt: now,
        })
        .where(eq(tenants.id, sub.tenantId))

      // Send notification to account
      await tx.insert(accountNotifications).values({
        accountId: sub.billingAccountId!,
        type: 'subscription',
        title: 'Subscription Renewed',
        message: `Your ${tier.displayName || tier.name} plan has been renewed until ${periodEnd.toLocaleDateString('en-KE')}. ${currency} ${renewalAmount.toFixed(2)} deducted from your wallet.`,
        link: '/account',
        metadata: {
          subscriptionId,
          tenantId: sub.tenantId,
          amount: renewalAmount,
          currency,
          periodEnd: periodEnd.toISOString(),
        },
      })
    })

    // Broadcast balance update + subscription change
    broadcastAccountChange(sub.billingAccountId, 'account-wallet', 'updated', sub.billingAccountId)
    broadcastAccountChange(sub.billingAccountId, 'account-subscription', 'updated', subscriptionId)

    return { success: true, newPeriodEnd: periodEnd, amountCharged: renewalAmount }
  } catch (err) {
    logError('renew-from-wallet', err)
    return { success: false, reason: 'Internal error during renewal' }
  }
}
