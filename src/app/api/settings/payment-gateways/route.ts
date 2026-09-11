import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { withTenant } from '@/lib/db'
import { paymentGatewayConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '@/lib/auth/roles'
import { validateBody } from '@/lib/validation/helpers'
import { gatewaySettingsSchema } from '@/lib/validation/schemas/gateways'
import { logError } from '@/lib/ai/error-logger'

// Fields that are secret keys — masked on GET so they never leave the server in plaintext.
// The client receives a boolean "isConfigured" indicator instead.
const SECRET_FIELDS = [
  'mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaPasskey',
  'stripeSecretKey', 'stripeWebhookSecret',
  'paystackSecretKey', 'paystackWebhookSecret',
  'payheroApiPassword',
] as const

type SecretField = typeof SECRET_FIELDS[number]

function maskSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config }
  for (const field of SECRET_FIELDS) {
    if (masked[field]) {
      masked[field] = '••••••••' // never expose the real value
      masked[`${field}IsSet`] = true
    } else {
      masked[`${field}IsSet`] = false
    }
  }
  return masked
}

// GET /api/settings/payment-gateways — return current gateway config for this tenant
export async function GET(_request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await withTenant(session.user.tenantId, async (db) => {
      return db.query.paymentGatewayConfigs.findFirst({
        where: eq(paymentGatewayConfigs.tenantId, session.user.tenantId),
      })
    })

    if (!config) {
      // Return safe defaults — no config exists yet
      return NextResponse.json({
        mpesaEnabled: false,
        mpesaEnvironment: 'sandbox',
        mpesaShortcode: null,
        mpesaCallbackBaseUrl: null,
        mpesaConsumerKeyIsSet: false,
        mpesaConsumerSecretIsSet: false,
        mpesaPasskeyIsSet: false,

        stripeEnabled: false,
        stripePublishableKey: null,
        stripeCurrency: 'KES',
        stripeSecretKeyIsSet: false,
        stripeWebhookSecretIsSet: false,

        paystackEnabled: false,
        paystackPublicKey: null,
        paystackCurrency: 'KES',
        paystackSecretKeyIsSet: false,
        paystackWebhookSecretIsSet: false,

        payheroEnabled: false,
        payheroApiUsername: null,
        payheroChannelId: null,
        payheroApiPasswordIsSet: false,
      })
    }

    // Expose non-secret fields, mask secrets
    const safeConfig = maskSecrets({
      mpesaEnabled:          config.mpesaEnabled,
      mpesaEnvironment:      config.mpesaEnvironment,
      mpesaConsumerKey:      config.mpesaConsumerKey,
      mpesaConsumerSecret:   config.mpesaConsumerSecret,
      mpesaShortcode:        config.mpesaShortcode,
      mpesaPasskey:          config.mpesaPasskey,
      mpesaCallbackBaseUrl:  config.mpesaCallbackBaseUrl,

      stripeEnabled:         config.stripeEnabled,
      stripePublishableKey:  config.stripePublishableKey,
      stripeSecretKey:       config.stripeSecretKey,
      stripeWebhookSecret:   config.stripeWebhookSecret,
      stripeCurrency:        config.stripeCurrency,

      paystackEnabled:       config.paystackEnabled,
      paystackPublicKey:     config.paystackPublicKey,
      paystackSecretKey:     config.paystackSecretKey,
      paystackWebhookSecret: config.paystackWebhookSecret,
      paystackCurrency:      config.paystackCurrency,

      payheroEnabled:        config.payheroEnabled,
      payheroApiUsername:    config.payheroApiUsername,
      payheroApiPassword:    config.payheroApiPassword,
      payheroChannelId:      config.payheroChannelId,
    })

    return NextResponse.json(safeConfig)
  } catch (error) {
    logError('api/settings/payment-gateways GET', error)
    return NextResponse.json({ error: 'Failed to load gateway settings' }, { status: 500 })
  }
}

// PUT /api/settings/payment-gateways — upsert gateway config for this tenant
export async function PUT(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only owner/manager can change payment settings
    const permError = requirePermission(session, 'manageSettings')
    if (permError) return permError

    const parsed = await validateBody(request, gatewaySettingsSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    await withTenant(session.user.tenantId, async (db) => {
      const existing = await db.query.paymentGatewayConfigs.findFirst({
        where: eq(paymentGatewayConfigs.tenantId, session.user.tenantId),
      })

      // Build update object — only include fields present in the request.
      // Secret fields with the masked placeholder '••••••••' are skipped so
      // the client can send the form back without clearing existing secrets.
      const updates: Record<string, unknown> = { updatedAt: new Date() }

      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue
        // Skip the masked placeholder — user didn't change this secret
        if (typeof value === 'string' && value === '••••••••') continue
        updates[key] = value
      }

      if (existing) {
        await db
          .update(paymentGatewayConfigs)
          .set(updates)
          .where(eq(paymentGatewayConfigs.tenantId, session.user.tenantId))
      } else {
        await db.insert(paymentGatewayConfigs).values({
          tenantId: session.user.tenantId,
          ...updates,
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('api/settings/payment-gateways PUT', error)
    return NextResponse.json({ error: 'Failed to save gateway settings' }, { status: 500 })
  }
}
