import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { accountAuth } from '@/lib/auth/account-auth'
import { db, withTenant } from '@/lib/db'
import { paymentGatewayConfigs, gatewayTransactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createCheckoutSession, buildStripeConfig, type StripeConfig } from '@/lib/stripe'
import { validateBody } from '@/lib/validation/helpers'
import { stripeCheckoutSchema } from '@/lib/validation/schemas/gateways'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'

// POST /api/stripe/checkout - Create a Stripe Checkout Session
export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, stripeCheckoutSchema)
    if (!parsed.success) return parsed.response
    const { amount, currency, description, context, saleId, subscriptionId, customerEmail, successPath, cancelPath } = parsed.data

    let stripeConfig: StripeConfig | null = null
    let tenantId: string | null = null
    let accountId: string | null = null

    if (context === 'subscription') {
      const accountSession = await accountAuth()
      if (!accountSession?.user?.accountId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      accountId = accountSession.user.accountId
      const platformConfig = await getPlatformGatewayConfig()
      if (!platformConfig?.stripeEnabled) {
        return NextResponse.json({ error: 'Stripe is not enabled for subscription payments' }, { status: 422 })
      }
      stripeConfig = buildStripeConfig({
        stripeSecretKey: platformConfig.stripeSecretKey,
        stripePublishableKey: platformConfig.stripePublishableKey,
        stripeWebhookSecret: platformConfig.stripeWebhookSecret,
        stripeCurrency: platformConfig.stripeCurrency,
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
      if (!config?.stripeEnabled) {
        return NextResponse.json({ error: 'Stripe is not enabled for this account' }, { status: 422 })
      }
      stripeConfig = buildStripeConfig(config)
    }

    if (!stripeConfig) {
      return NextResponse.json({ error: 'Stripe is not fully configured' }, { status: 503 })
    }

    const internalRef = `STRIPE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const effectiveCurrency = (currency || stripeConfig.currency || 'kes').toLowerCase()
    const zeroDecimalCurrencies = ['bif','clp','gnf','jpy','kes','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf']
    const amountCents = zeroDecimalCurrencies.includes(effectiveCurrency) ? Math.round(amount) : Math.round(amount * 100)

    const stripeSession = await createCheckoutSession({
      secretKey: stripeConfig.secretKey,
      currency: effectiveCurrency,
      amountCents,
      description,
      customerEmail,
      successUrl: `${baseUrl}${successPath || (context === 'subscription' ? '/account/billing' : '/pos')}?stripe_session={CHECKOUT_SESSION_ID}&ref=${internalRef}`,
      cancelUrl:  `${baseUrl}${cancelPath  || (context === 'subscription' ? '/account/billing' : '/pos')}?stripe_cancelled=1&ref=${internalRef}`,
      metadata: {
        internalReference: internalRef,
        context,
        ...(tenantId ? { tenantId } : {}),
        ...(accountId ? { accountId } : {}),
        ...(saleId ? { saleId } : {}),
        ...(subscriptionId ? { subscriptionId } : {}),
      },
    })

    await db.insert(gatewayTransactions).values({
      tenantId: tenantId || null,
      accountId: accountId || null,
      context,
      saleId: saleId || null,
      subscriptionId: subscriptionId || null,
      gateway: 'stripe',
      gatewayReference: stripeSession.id,
      internalReference: internalRef,
      amount: amount.toFixed(2),
      currency: effectiveCurrency.toUpperCase(),
      status: 'pending',
      customerEmail: customerEmail || null,
      metadata: { stripeSessionId: stripeSession.id },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })

    return NextResponse.json({
      checkoutUrl: stripeSession.url,
      sessionId: stripeSession.id,
      internalReference: internalRef,
      publishableKey: stripeConfig.publishableKey,
    })
  } catch (error) {
    logError('api/stripe/checkout', error)
    const message = error instanceof Error ? error.message : 'Failed to create Stripe checkout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
