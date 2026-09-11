import { NextRequest, NextResponse } from 'next/server'
import { accountAuth as auth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { accounts, paymentDeposits, subscriptions, pendingCompanies } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'
import { broadcastAccountChange } from '@/lib/websocket/broadcast'
import { validateBody } from '@/lib/validation/helpers'
import { createPaymentDepositSchema } from '@/lib/validation/schemas/account'

// GET - List user's payment deposits
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch payment deposits for this account
    const rawPayments = await db.query.paymentDeposits.findMany({
      where: eq(paymentDeposits.accountId, session.user.accountId),
      with: {
        subscription: true,
      },
      orderBy: [desc(paymentDeposits.createdAt)],
    })

    // Collect all IDs we need to resolve
    const tenantIds   = [...new Set(rawPayments.flatMap(p => p.subscription?.tenantId  ? [p.subscription.tenantId]  : []))]
    const tierIds     = [...new Set(rawPayments.flatMap(p => p.subscription?.tierId    ? [p.subscription.tierId]    : []))]
    const pendingIds  = [...new Set(rawPayments.flatMap(p => p.pendingCompanyId        ? [p.pendingCompanyId]        : []))]

    const { tenants, pricingTiers, pendingCompanies } = await import('@/lib/db/schema')
    const { inArray } = await import('drizzle-orm')

    const [tenantRows, tierRows, pendingRows] = await Promise.all([
      tenantIds.length  > 0 ? db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(inArray(tenants.id, tenantIds)) : [],
      tierIds.length    > 0 ? db.select({ id: pricingTiers.id, name: pricingTiers.name, displayName: pricingTiers.displayName }).from(pricingTiers).where(inArray(pricingTiers.id, tierIds)) : [],
      pendingIds.length > 0 ? db.select({ id: pendingCompanies.id, name: pendingCompanies.name }).from(pendingCompanies).where(inArray(pendingCompanies.id, pendingIds)) : [],
    ])

    const tenantMap  = new Map(tenantRows.map(t  => [t.id, t]))
    const tierMap    = new Map(tierRows.map(t    => [t.id, t]))
    const pendingMap = new Map(pendingRows.map(p => [p.id, p]))

    // Enrich payments with tenant, tier and pending company names
    const payments = rawPayments.map(p => ({
      ...p,
      subscription: p.subscription ? {
        ...p.subscription,
        tenant: p.subscription.tenantId ? tenantMap.get(p.subscription.tenantId) ?? null : null,
        tier:   p.subscription.tierId   ? tierMap.get(p.subscription.tierId)     ?? null : null,
      } : null,
      // Attach pending company name directly on the payment for UI rendering
      pendingCompany: p.pendingCompanyId ? pendingMap.get(p.pendingCompanyId) ?? null : null,
    }))

    return NextResponse.json(payments)
  } catch (error) {
    logError('api/account/payments', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

// POST - Submit a new payment deposit
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = await validateBody(request, createPaymentDepositSchema)
    if (!parsed.success) return parsed.response
    const {
      subscriptionId,
      pendingCompanyId,
      amount,
      bankReference,
      depositDate,
      notes,
      periodMonths,
      isWalletDeposit,
    } = parsed.data

    // For subscription payments (not wallet, not pending company), validate subscriptionId
    if (!isWalletDeposit && !subscriptionId && !pendingCompanyId) {
      return NextResponse.json(
        { error: 'Subscription or pending company is required' },
        { status: 400 }
      )
    }

    // Get user's currency
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, session.user.accountId),
    })
    const userCurrency = account?.currency || 'KES'

    // For subscription payments, verify subscription belongs to user
    if (!isWalletDeposit && subscriptionId) {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.billingAccountId, session.user.accountId)
        ),
      })

      if (!subscription) {
        return NextResponse.json(
          { error: 'Subscription not found or access denied' },
          { status: 404 }
        )
      }
    }

    // For pending company payments, verify pending company belongs to user
    if (pendingCompanyId) {
      const pending = await db.query.pendingCompanies.findFirst({
        where: and(
          eq(pendingCompanies.id, pendingCompanyId),
          eq(pendingCompanies.accountId, session.user.accountId)
        ),
      })

      if (!pending) {
        return NextResponse.json(
          { error: 'Pending company not found or access denied' },
          { status: 404 }
        )
      }

      if (pending.status !== 'pending_payment') {
        return NextResponse.json(
          { error: 'Pending company is not awaiting payment' },
          { status: 400 }
        )
      }
    }

    // Create payment deposit
    // Format depositDate as YYYY-MM-DD string for Drizzle date type
    const formattedDepositDate = new Date(depositDate).toISOString().split('T')[0]

    const [payment] = await db.insert(paymentDeposits)
      .values({
        accountId: session.user.accountId,
        subscriptionId: isWalletDeposit ? null : subscriptionId || null,
        pendingCompanyId: pendingCompanyId || null,
        amount: String(amount),
        currency: userCurrency,
        bankReference: bankReference || null,
        depositDate: formattedDepositDate,
        notes: notes || null,
        periodMonths: isWalletDeposit ? 0 : periodMonths,
        isWalletDeposit,
        status: 'pending',
      })
      .returning()

    // Update pending company status to pending_approval
    if (pendingCompanyId) {
      await db.update(pendingCompanies)
        .set({
          status: 'pending_approval',
          paymentDepositId: payment.id,
          updatedAt: new Date(),
        })
        .where(eq(pendingCompanies.id, pendingCompanyId))
    }

    broadcastAccountChange(session.user.accountId, 'account-wallet', 'updated', payment.id)

    // ── Email notifications (fire-and-forget) ──
    const { notifyAdminNewPayment, notifyAdminPendingCompanyPayment } = await import('@/lib/email/admin-notifications')

    if (pendingCompanyId) {
      // Get pending company details for richer email
      const pending = await db.query.pendingCompanies.findFirst({
        where: eq(pendingCompanies.id, pendingCompanyId),
        with: { tier: true },
      })
      if (pending) {
        const tier = pending.tier as { displayName?: string; name?: string } | null
        notifyAdminPendingCompanyPayment({
          companyName:  pending.name,
          businessType: pending.businessType,
          planName:     tier?.displayName || tier?.name || 'Paid',
          billingCycle: pending.billingCycle || 'monthly',
          accountEmail: account?.email || session.user.accountId,
          amount:       String(amount),
          currency:     userCurrency,
        }).catch(() => {})
      }
    } else {
      notifyAdminNewPayment({
        accountEmail:       account?.email || session.user.accountId,
        accountName:        account?.fullName || account?.email || 'User',
        amount:             String(amount),
        currency:           userCurrency,
        isWalletDeposit:    isWalletDeposit ?? false,
        pendingCompanyName: null,
        bankReference:      bankReference || null,
      }).catch(() => {})
    }

    return NextResponse.json(payment)
  } catch (error) {
    logError('api/account/payments', error)
    return NextResponse.json({ error: 'Failed to submit payment' }, { status: 500 })
  }
}
