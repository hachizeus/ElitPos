/**
 * GET /api/sys-control/platform-gateways
 *
 * Returns the platform owner's payment gateway configuration from systemSettings.
 * Used server-side by subscription checkout routes to get credentials.
 *
 * This endpoint is admin-only and returns actual secret values (server-to-server use).
 * Never call this from client-side code.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { validateAdminSession } from '@/lib/admin'
import { logError } from '@/lib/ai/error-logger'

export interface PlatformGatewayConfig {
  mpesaEnabled: boolean
  mpesaEnvironment: 'sandbox' | 'production'
  mpesaConsumerKey: string
  mpesaConsumerSecret: string
  mpesaShortcode: string
  mpesaPasskey: string

  stripeEnabled: boolean
  stripePublishableKey: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  stripeCurrency: string

  paystackEnabled: boolean
  paystackPublicKey: string
  paystackSecretKey: string
  paystackWebhookSecret: string
  paystackCurrency: string

  payheroEnabled: boolean
  payheroApiUsername: string
  payheroApiPassword: string
  payheroChannelId: string
}

/**
 * Load platform gateway config from the database.
 * Call this from server-side API routes (not client components).
 */
export async function getPlatformGatewayConfig(): Promise<PlatformGatewayConfig | null> {
  try {
    const setting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'platform_gateways'),
    })
    if (!setting?.value) return null
    return setting.value as PlatformGatewayConfig
  } catch {
    return null
  }
}

// GET /api/sys-control/platform-gateways — admin-only, returns full config
export async function GET() {
  try {
    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getPlatformGatewayConfig()
    return NextResponse.json(config || {})
  } catch (error) {
    logError('api/sys-control/platform-gateways', error)
    return NextResponse.json({ error: 'Failed to load gateway config' }, { status: 500 })
  }
}
