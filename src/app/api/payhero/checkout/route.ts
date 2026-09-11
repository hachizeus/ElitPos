import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { accountAuth } from '@/lib/auth/account-auth'
import { db, withTenant } from '@/lib/db'
import { paymentGatewayConfigs, gatewayTransactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { initiatePayheroPayment, buildPayheroConfig, generatePayheroReference, type PayheroConfig } from '@/lib/payhero'
import { validateBody } from '@/lib/validation/helpers'
import { payheroCheckoutSchema } from '@/lib/validation/schemas/gateways'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'

// POST /api/payhero/checkout - Initiate a PayHero STK Push payment
export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, payheroCheckoutSchema)
    if (!parsed.success) return parsed.response
    const { phone, amount, context, saleId, subscriptionId, description } = parsed.data

    let payheroConfig: PayheroConfig | null = null
    let tenantId: string | null = null
    let accountId: string | null = null

    if (context === 'subscription') {
      const accountSession = await accountAuth()
      if (!accountSession?.user?.accountId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      accountId = accountSession.user.accountId
      const platformConfig = await getPlatformGatewayConfig()
      if (!platformConfig?.payheroEnabled) {
        return NextResponse.json({ error: 'PayHero is not enabled for subscription payments' }, { status: 422 })
      }
      payheroConfig = buildPayheroConfig({
        payheroApiUsername: platformConfig.payheroApiUsername,
        payheroApiPassword: platformConfig.payheroApiPassword,
        payheroChannelId: platformConfig.payheroChannelId,
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
      if (!config?.payheroEnabled) {
        return NextResponse.json({ error: 'PayHero is not enabled for this account' }, { status: 422 })
      }
      payheroConfig = buildPayheroConfig(config)
    }

    if (!payheroConfig) {
      return NextResponse.json({ error: 'PayHero is not fully configured' }, { status: 503 })
    }

    const internalRef = generatePayheroReference('ELITPOS')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const result = await initiatePayheroPayment(payheroConfig, {
      phone,
      amount,
      externalReference: internalRef,
      callbackUrl: `${baseUrl}/api/payhero/notify`,
    })

    await db.insert(gatewayTransactions).values({
      tenantId: tenantId || null,
      accountId: accountId || null,
      context,
      saleId: saleId || null,
      subscriptionId: subscriptionId || null,
      gateway: 'payhero',
      gatewayReference: result.merchant_reference || result.CheckoutRequestID || null,
      internalReference: internalRef,
      amount: amount.toFixed(2),
      currency: 'KES',
      status: 'pending',
      customerPhone: phone,
      metadata: {
        merchantReference: result.merchant_reference,
        checkoutRequestId: result.CheckoutRequestID,
        responseCode: result.response_code,
        description,
      },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    return NextResponse.json({
      success: true,
      internalReference: internalRef,
      merchantReference: result.merchant_reference,
      message: 'PayHero payment initiated. Awaiting customer confirmation.',
    })
  } catch (error) {
    logError('api/payhero/checkout', error)
    const message = error instanceof Error ? error.message : 'Failed to initiate PayHero payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
