import { NextRequest, NextResponse } from 'next/server'
import { accountAuth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { accounts, pendingCompanies, gatewayTransactions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'
import { logError } from '@/lib/ai/error-logger'
import { validateBody, validateParams } from '@/lib/validation/helpers'
import { z } from 'zod'
import { idParamSchema } from '@/lib/validation/schemas/common'

const bodySchema = z.object({
  gateway: z.enum(['paystack', 'payhero', 'mpesa', 'stripe']),
  phone: z.string().optional(),        // required for mpesa / payhero
  email: z.string().email().optional(), // optional override for paystack/stripe
  callbackPath: z.string().optional(),
})

/**
 * POST /api/account/pending-companies/[id]/gateway-pay
 *
 * Initialises a gateway payment for a pending company registration.
 * Returns whatever the selected gateway needs: { authorizationUrl } for
 * redirect gateways (Paystack, Stripe) or { success, internalReference }
 * for STK-push gateways (M-Pesa, PayHero).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await accountAuth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsParsed = validateParams(await params, idParamSchema)
    if (!paramsParsed.success) return paramsParsed.response
    const { id: pendingCompanyId } = paramsParsed.data

    const bodyParsed = await validateBody(request, bodySchema)
    if (!bodyParsed.success) return bodyParsed.response
    const { gateway, phone, email: bodyEmail, callbackPath } = bodyParsed.data

    // Verify the pending company belongs to this account and is awaiting payment
    const pending = await db.query.pendingCompanies.findFirst({
      where: and(
        eq(pendingCompanies.id, pendingCompanyId),
        eq(pendingCompanies.accountId, session.user.accountId)
      ),
      with: { tier: true },
    })

    if (!pending) {
      return NextResponse.json({ error: 'Pending company not found' }, { status: 404 })
    }
    if (pending.status !== 'pending_payment') {
      return NextResponse.json({ error: 'This company is not awaiting payment' }, { status: 400 })
    }

    // Get platform gateway config
    const config = await getPlatformGatewayConfig()
    if (!config) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
    }

    // Calculate amount
    const billingCycle = pending.billingCycle || 'monthly'
    const tier = pending.tier as { priceMonthly: string | number; priceYearly?: string | number } | null
    const priceMonthly = Number(tier?.priceMonthly || 0)
    const priceYearly  = Number(tier?.priceYearly  || priceMonthly * 12 * 0.833)
    const amount = billingCycle === 'yearly' ? Math.round(priceYearly * 100) / 100 : priceMonthly

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid plan price' }, { status: 400 })
    }

    // Resolve customer email
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, session.user.accountId),
      columns: { email: true },
    })
    const customerEmail = bodyEmail || account?.email || ''

    // Generate a unique internal reference
    const internalReference = `PC-${pendingCompanyId.slice(0, 8)}-${Date.now()}`

    // ─── Paystack ────────────────────────────────────────────────────────────
    if (gateway === 'paystack') {
      if (!config.paystackEnabled || !config.paystackSecretKey) {
        return NextResponse.json({ error: 'Paystack is not enabled' }, { status: 422 })
      }
      const currency   = config.paystackCurrency || 'KES'
      const amountKobo = Math.round(amount * 100)

      // Use NEXTAUTH_URL as base — already set correctly for both local (http) and prod (https)
      const rawBase = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
      // Paystack requires HTTPS for callback URLs and will upgrade http:// to https://
      // On localhost this causes ERR_SSL_PROTOCOL_ERROR — so skip the callback_url on localhost
      // and rely on the frontend intercepting ?reference= param when the user returns manually.
      const isLocalhost = rawBase.includes('localhost') || rawBase.includes('127.0.0.1')
      const callbackForPaystack = isLocalhost
        ? undefined  // no redirect — user closes Paystack popup and comes back manually
        : (callbackPath
            ? `${rawBase}${callbackPath}`
            : `${rawBase}/account/payments?pendingCompany=${pendingCompanyId}`)

      const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: customerEmail,
          amount: amountKobo,
          currency,
          reference: internalReference,
          ...(callbackForPaystack ? { callback_url: callbackForPaystack } : {}),
          metadata: { pendingCompanyId, accountId: session.user.accountId },
        }),
      })

      const psData = await psRes.json() as { status: boolean; data?: { authorization_url: string; reference: string } }
      if (!psRes.ok || !psData.status || !psData.data?.authorization_url) {
        return NextResponse.json({ error: 'Failed to initialize Paystack payment' }, { status: 502 })
      }

      // Record gateway transaction
      await db.insert(gatewayTransactions).values({
        accountId:          session.user.accountId,
        context:            'subscription',
        gateway:            'paystack',
        internalReference,
        pendingCompanyId,
        amount:             amount.toFixed(2),
        currency,
        customerEmail,
        status:             'pending',
      })

      return NextResponse.json({
        gateway: 'paystack',
        authorizationUrl: psData.data.authorization_url,
        internalReference,
      })
    }

    // ─── Stripe ──────────────────────────────────────────────────────────────
    if (gateway === 'stripe') {
      if (!config.stripeEnabled || !config.stripeSecretKey) {
        return NextResponse.json({ error: 'Stripe is not enabled' }, { status: 422 })
      }
      const currency   = (config.stripeCurrency || 'KES').toLowerCase()
      const amountCents = Math.round(amount * 100)

      const base        = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
      const successUrl  = `${base}/account/payments?pendingCompany=${pendingCompanyId}&stripe_ref=${internalReference}&stripe_status=success`
      const cancelUrl   = `${base}/account/payments?pendingCompany=${pendingCompanyId}&stripe_status=cancelled`

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'payment_method_types[]': 'card',
          'line_items[0][price_data][currency]': currency,
          'line_items[0][price_data][product_data][name]': `${pending.name} — ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'} Plan`,
          'line_items[0][price_data][unit_amount]': String(amountCents),
          'line_items[0][quantity]': '1',
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          'metadata[internalReference]': internalReference,
          'metadata[pendingCompanyId]': pendingCompanyId,
          ...(customerEmail ? { customer_email: customerEmail } : {}),
        }),
      })

      const stripeData = await stripeRes.json() as { url?: string; error?: { message: string } }
      if (!stripeRes.ok || !stripeData.url) {
        return NextResponse.json({ error: stripeData.error?.message || 'Failed to create Stripe session' }, { status: 502 })
      }

      await db.insert(gatewayTransactions).values({
        accountId:          session.user.accountId,
        context:            'subscription',
        gateway:            'stripe',
        internalReference,
        pendingCompanyId,
        amount:             amount.toFixed(2),
        currency:           currency.toUpperCase(),
        customerEmail,
        status:             'pending',
      })

      return NextResponse.json({
        gateway: 'stripe',
        authorizationUrl: stripeData.url,
        internalReference,
      })
    }

    // ─── PayHero ─────────────────────────────────────────────────────────────
    if (gateway === 'payhero') {
      if (!config.payheroEnabled || !config.payheroApiUsername || !config.payheroChannelId) {
        return NextResponse.json({ error: 'PayHero is not enabled' }, { status: 422 })
      }
      if (!phone) {
        return NextResponse.json({ error: 'Phone number is required for PayHero' }, { status: 400 })
      }

      const credentials = Buffer.from(`${config.payheroApiUsername}:${config.payheroApiPassword}`).toString('base64')
      const phRes = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          phone_number: phone,
          channel_id: Number(config.payheroChannelId),
          provider: 'm-pesa',
          external_reference: internalReference,
          callback_url: `${(process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/payhero/webhook`,
        }),
      })

      const phData = await phRes.json() as { success?: boolean; reference?: string; CheckoutRequestID?: string }
      if (!phRes.ok || phData.success === false) {
        return NextResponse.json({ error: 'Failed to initiate PayHero payment' }, { status: 502 })
      }

      await db.insert(gatewayTransactions).values({
        accountId:          session.user.accountId,
        context:            'subscription',
        gateway:            'payhero',
        internalReference,
        gatewayReference:   phData.reference || phData.CheckoutRequestID || null,
        pendingCompanyId,
        amount:             amount.toFixed(2),
        currency:           'KES',
        customerPhone:      phone,
        customerEmail,
        status:             'pending',
      })

      return NextResponse.json({
        gateway: 'payhero',
        success: true,
        internalReference,
        checkoutRequestId: phData.reference || phData.CheckoutRequestID,
      })
    }

    // ─── M-Pesa ───────────────────────────────────────────────────────────────
    if (gateway === 'mpesa') {
      if (!config.mpesaEnabled || !config.mpesaConsumerKey || !config.mpesaShortcode) {
        return NextResponse.json({ error: 'M-Pesa is not enabled' }, { status: 422 })
      }
      if (!phone) {
        return NextResponse.json({ error: 'Phone number is required for M-Pesa' }, { status: 400 })
      }

      // Get M-Pesa access token
      const tokenRes = await fetch(
        config.mpesaEnvironment === 'production'
          ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
          : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`).toString('base64')}`,
          },
        }
      )
      const tokenData = await tokenRes.json() as { access_token?: string }
      if (!tokenData.access_token) {
        return NextResponse.json({ error: 'Failed to get M-Pesa token' }, { status: 502 })
      }

      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
      const password  = Buffer.from(`${config.mpesaShortcode}${config.mpesaPasskey}${timestamp}`).toString('base64')
      const normalizedPhone = phone.replace(/^0/, '254').replace(/^\+/, '')

      const stkRes = await fetch(
        config.mpesaEnvironment === 'production'
          ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
          : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            BusinessShortCode: config.mpesaShortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: normalizedPhone,
            PartyB: config.mpesaShortcode,
            PhoneNumber: normalizedPhone,
            CallBackURL: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/mpesa/callback`,
            AccountReference: `PC-${pending.slug}`,
            TransactionDesc: `Payment for ${pending.name}`,
          }),
        }
      )

      const stkData = await stkRes.json() as { CheckoutRequestID?: string; ResponseCode?: string }
      if (!stkRes.ok || stkData.ResponseCode !== '0') {
        return NextResponse.json({ error: 'Failed to initiate M-Pesa STK push' }, { status: 502 })
      }

      await db.insert(gatewayTransactions).values({
        accountId:          session.user.accountId,
        context:            'subscription',
        gateway:            'mpesa',
        internalReference,
        gatewayReference:   stkData.CheckoutRequestID || null,
        pendingCompanyId,
        amount:             amount.toFixed(2),
        currency:           'KES',
        customerPhone:      phone,
        customerEmail,
        status:             'pending',
      })

      return NextResponse.json({
        gateway: 'mpesa',
        success: true,
        internalReference,
        checkoutRequestId: stkData.CheckoutRequestID,
      })
    }

    return NextResponse.json({ error: 'Unsupported gateway' }, { status: 400 })
  } catch (error) {
    logError('api/account/pending-companies/[id]/gateway-pay', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
