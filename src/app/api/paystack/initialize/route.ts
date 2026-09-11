import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { accountAuth } from '@/lib/auth/account-auth'
import { db, withTenant } from '@/lib/db'
import { accounts, paymentGatewayConfigs, gatewayTransactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { initializeTransaction, buildPaystackConfig, generatePaystackReference, type PaystackConfig } from '@/lib/paystack'
import { validateBody } from '@/lib/validation/helpers'
import { paystackInitSchema } from '@/lib/validation/schemas/gateways'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'

// POST /api/paystack/initialize - Initialize a Paystack transaction
export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, paystackInitSchema)
    if (!parsed.success) return parsed.response
    const { amount, email: bodyEmail, context, saleId, subscriptionId, billingCycle, newTierId, currency, callbackPath } = parsed.data

    let paystackConfig: PaystackConfig | null = null
    let tenantId: string | null = null
    let accountId: string | null = null
    let resolvedEmail = bodyEmail || ''

    if (context === 'subscription') {
      const accountSession = await accountAuth()
      if (!accountSession?.user?.accountId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      accountId = accountSession.user.accountId

      // Always fetch the real account email — don't use a placeholder
      if (!resolvedEmail || resolvedEmail.includes('payment.local')) {
        const account = await db.query.accounts.findFirst({
          where: eq(accounts.id, accountId),
          columns: { email: true },
        })
        resolvedEmail = account?.email || ''
      }

      if (!resolvedEmail) {
        return NextResponse.json({ error: 'Account email not found. Please update your profile.' }, { status: 400 })
      }

      const platformConfig = await getPlatformGatewayConfig()
      if (!platformConfig?.paystackEnabled) {
        return NextResponse.json({ error: 'Paystack is not enabled for subscription payments' }, { status: 422 })
      }
      paystackConfig = buildPaystackConfig({
        paystackSecretKey: platformConfig.paystackSecretKey,
        paystackPublicKey: platformConfig.paystackPublicKey,
        paystackWebhookSecret: platformConfig.paystackWebhookSecret,
        paystackCurrency: platformConfig.paystackCurrency,
      })
    } else {
      const session = await authWithCompany()
      if (!session?.user?.tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      tenantId = session.user.tenantId
      const config = await withTenant(tenantId, async (tdb) => {
        return tdb.query.paymentGatewayConfigs.findFirst({
          where: eq(paymentGatewayConfigs.tenantId, tenantId!),
        })
      })
      if (!config?.paystackEnabled) {
        return NextResponse.json({ error: 'Paystack is not enabled for this account' }, { status: 422 })
      }
      paystackConfig = buildPaystackConfig(config)

      // For POS, email is optional — use a valid placeholder if not provided
      if (!resolvedEmail) {
        resolvedEmail = `pos-${tenantId?.slice(0, 8)}@elitpos.local`
      }
    }

    if (!paystackConfig) {
      return NextResponse.json({ error: 'Paystack is not fully configured' }, { status: 503 })
    }

    const internalRef = generatePaystackReference('ELITPOS')
    const effectiveCurrency = (currency || paystackConfig.currency || 'KES').toUpperCase()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const amountMinor = Math.round(amount * 100)

    // Store extra metadata needed for subscription activation after payment
    const extraMeta: Record<string, unknown> = {
      context,
      ...(tenantId ? { tenantId } : {}),
      ...(accountId ? { accountId } : {}),
      saleId: saleId || null,
      subscriptionId: subscriptionId || null,
      internalReference: internalRef,
      // Required for subscription activation
      ...(billingCycle ? { billingCycle } : {}),
      ...(newTierId ? { newTierId } : {}),
    }

    const result = await initializeTransaction({
      secretKey: paystackConfig.secretKey,
      email: resolvedEmail,
      amountKobo: amountMinor,
      currency: effectiveCurrency,
      reference: internalRef,
      callbackUrl: `${baseUrl}${callbackPath || '/api/paystack/callback'}?ref=${internalRef}`,
      metadata: extraMeta,
    })

    await db.insert(gatewayTransactions).values({
      tenantId: tenantId || null,
      accountId: accountId || null,
      context,
      saleId: saleId || null,
      subscriptionId: subscriptionId || null,
      gateway: 'paystack',
      gatewayReference: result.reference,
      internalReference: internalRef,
      amount: amount.toFixed(2),
      currency: effectiveCurrency,
      status: 'pending',
      customerEmail: resolvedEmail,
      metadata: { 
        accessCode: result.access_code,
        ...(billingCycle ? { billingCycle } : {}),
        ...(newTierId ? { newTierId } : {}),
      },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    return NextResponse.json({
      authorizationUrl: result.authorization_url,
      accessCode: result.access_code,
      reference: internalRef,
      publicKey: paystackConfig.publicKey,
    })
  } catch (error) {
    logError('api/paystack/initialize', error)
    const message = error instanceof Error ? error.message : 'Failed to initialize Paystack payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
