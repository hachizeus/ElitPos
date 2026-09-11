import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { accountAuth } from '@/lib/auth/account-auth'
import { db, withTenant } from '@/lib/db'
import { paymentGatewayConfigs, gatewayTransactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { initiateStkPush, buildMpesaConfig, type MpesaConfig } from '@/lib/mpesa'
import { validateBody } from '@/lib/validation/helpers'
import { mpesaStkPushSchema } from '@/lib/validation/schemas/gateways'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'

// POST /api/mpesa/stkpush
export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, mpesaStkPushSchema)
    if (!parsed.success) return parsed.response
    const { phone, amount, context, saleId, subscriptionId, accountReference, description } = parsed.data

    let mpesaConfig: MpesaConfig | null = null
    let tenantId: string | null = null
    let accountId: string | null = null

    if (context === 'subscription') {
      // Use platform credentials — authenticate via account session (not company session)
      const accountSession = await accountAuth()
      if (!accountSession?.user?.accountId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      accountId = accountSession.user.accountId
      const platformConfig = await getPlatformGatewayConfig()
      if (!platformConfig?.mpesaEnabled) {
        return NextResponse.json({ error: 'M-Pesa is not enabled for subscription payments' }, { status: 422 })
      }
      mpesaConfig = buildMpesaConfig({
        mpesaConsumerKey: platformConfig.mpesaConsumerKey,
        mpesaConsumerSecret: platformConfig.mpesaConsumerSecret,
        mpesaShortcode: platformConfig.mpesaShortcode,
        mpesaPasskey: platformConfig.mpesaPasskey,
        mpesaEnvironment: platformConfig.mpesaEnvironment,
        mpesaCallbackBaseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      })
    } else {
      // Use tenant's own credentials — company session required
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
      if (!config?.mpesaEnabled) {
        return NextResponse.json({ error: 'M-Pesa is not enabled for this account' }, { status: 422 })
      }
      mpesaConfig = buildMpesaConfig(config)
    }

    if (!mpesaConfig) {
      return NextResponse.json({ error: 'M-Pesa is not fully configured' }, { status: 503 })
    }

    const internalRef = `MPESA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const stkResponse = await initiateStkPush(mpesaConfig, {
      phone,
      amount,
      accountReference: accountReference || internalRef.slice(0, 12),
      description: description || 'ElitPOS Payment',
    })

    await db.insert(gatewayTransactions).values({
      tenantId: tenantId || null,
      accountId: accountId || null,
      context,
      saleId: saleId || null,
      subscriptionId: subscriptionId || null,
      gateway: 'mpesa',
      gatewayReference: stkResponse.CheckoutRequestID || null,
      internalReference: internalRef,
      amount: amount.toFixed(2),
      currency: 'KES',
      status: 'pending',
      customerPhone: phone,
      metadata: {
        merchantRequestId: stkResponse.MerchantRequestID,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        responseDescription: stkResponse.ResponseDescription,
      },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    return NextResponse.json({
      success: true,
      internalReference: internalRef,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      merchantRequestId: stkResponse.MerchantRequestID,
      message: 'STK Push sent. Awaiting customer confirmation.',
    })
  } catch (error) {
    logError('api/mpesa/stkpush', error)
    const message = error instanceof Error ? error.message : 'Failed to initiate M-Pesa payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
