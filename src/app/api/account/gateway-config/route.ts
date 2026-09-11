import { NextResponse } from 'next/server'
import { accountAuth as auth } from '@/lib/auth/account-auth'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'
import { logError } from '@/lib/ai/error-logger'

/**
 * GET /api/account/gateway-config
 *
 * Returns which platform payment gateways are currently enabled.
 * Used by wallet/subscription pages to show only active payment options.
 * Returns NO secret keys — only boolean flags and public keys.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getPlatformGatewayConfig()

    // Return only what the frontend needs — never expose secret keys
    return NextResponse.json({
      mpesa:    { enabled: !!(config?.mpesaEnabled && config.mpesaConsumerKey && config.mpesaShortcode) },
      stripe:   { enabled: !!(config?.stripeEnabled && config.stripeSecretKey), publishableKey: config?.stripePublishableKey || null, currency: config?.stripeCurrency || 'KES' },
      paystack: { enabled: !!(config?.paystackEnabled && config.paystackSecretKey), publicKey: config?.paystackPublicKey || null, currency: config?.paystackCurrency || 'KES' },
      payhero:  { enabled: !!(config?.payheroEnabled && config.payheroApiUsername && config.payheroChannelId) },
    })
  } catch (error) {
    logError('api/account/gateway-config', error)
    return NextResponse.json({ error: 'Failed to load gateway config' }, { status: 500 })
  }
}
