/**
 * Activate or upgrade a subscription after a successful gateway payment.
 *
 * Called from:
 *  - Paystack webhook (charge.success)
 *  - Paystack verify (after user returns)
 *  - M-Pesa callback (ResultCode 0)
 *  - PayHero notify (SUCCESS)
 *  - Stripe webhook (checkout.session.completed)
 *  - Subscription page inline handler (after Paystack popup onSuccess)
 *
 * Idempotent — safe to call multiple times for the same transaction.
 */

import { db } from '@/lib/db'
import { subscriptions, tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getNextPeriodDates } from '@/lib/billing/proration'
import { broadcastAccountChange } from '@/lib/websocket/broadcast'
import { logError } from '@/lib/ai/error-logger'

export async function activateSubscriptionFromGateway(
  transaction: {
    id: string
    accountId: string | null
    subscriptionId: string | null
    billingCycle?: string | null
    metadata?: Record<string, unknown> | null
  }
): Promise<void> {
  if (!transaction.subscriptionId) return

  try {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, transaction.subscriptionId),
    })
    if (!subscription) return

    const now = new Date()
    const meta = (transaction.metadata as Record<string, unknown>) || {}

    // billingCycle: prefer explicit field, fall back to metadata
    const billingCycle = (
      (transaction as { billingCycle?: string | null }).billingCycle ||
      (meta.billingCycle as string) ||
      'monthly'
    ) as 'monthly' | 'yearly'

    // newTierId stored in metadata when this was an upgrade
    const newTierId = (
      (transaction as { newTierId?: string | null }).newTierId ||
      (meta.newTierId as string) ||
      null
    )
    const isUpgrade = !!newTierId

    const updateData: Record<string, unknown> = {
      status: 'active',
      billingCycle,
      lastPaymentAt: now,
      updatedAt: now,
    }

    if (isUpgrade) {
      updateData.tierId = newTierId
    } else {
      const { periodStart, periodEnd } = getNextPeriodDates(now, billingCycle)
      updateData.currentPeriodStart = periodStart
      updateData.currentPeriodEnd = periodEnd
    }

    await db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, subscription.id))

    // Unlock tenant if it was locked
    await db.update(tenants)
      .set({
        status: 'active',
        lockedAt: null,
        lockedReason: null,
        deletionScheduledAt: null,
        updatedAt: now,
      })
      .where(eq(tenants.id, subscription.tenantId))

    // Broadcast real-time updates
    if (transaction.accountId) {
      broadcastAccountChange(transaction.accountId, 'account-subscription', 'updated', subscription.id)
      broadcastAccountChange(transaction.accountId, 'account-wallet', 'updated', transaction.accountId)
    }
  } catch (err) {
    logError('activate-subscription-from-gateway', err)
  }
}
