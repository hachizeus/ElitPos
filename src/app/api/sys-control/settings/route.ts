import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { adminAudit, withRateLimit, validateAdminSession } from '@/lib/admin'
import { logError } from '@/lib/ai/error-logger'
import { validateBody } from '@/lib/validation/helpers'
import { sysUpdateSettingSchema } from '@/lib/validation/schemas/sys-control'

// GET /api/sys-control/settings - Get all system settings
export async function GET(request: NextRequest) {
  try {
    const rateLimited = await withRateLimit('/api/sys-control/settings')
    if (rateLimited) return rateLimited

    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key) {
      // gateway_status: count tenants with each gateway enabled (derived from DB)
      if (key === 'gateway_status') {
        try {
          const { paymentGatewayConfigs } = await import('@/lib/db/schema')
          const { count: drizzleCount, eq: deq } = await import('drizzle-orm')
          const [mpesaCount, stripeCount, paystackCount, payheroCount] = await Promise.all([
            db.select({ c: drizzleCount() }).from(paymentGatewayConfigs).where(deq(paymentGatewayConfigs.mpesaEnabled, true)),
            db.select({ c: drizzleCount() }).from(paymentGatewayConfigs).where(deq(paymentGatewayConfigs.stripeEnabled, true)),
            db.select({ c: drizzleCount() }).from(paymentGatewayConfigs).where(deq(paymentGatewayConfigs.paystackEnabled, true)),
            db.select({ c: drizzleCount() }).from(paymentGatewayConfigs).where(deq(paymentGatewayConfigs.payheroEnabled, true)),
          ])
          return NextResponse.json({
            key: 'gateway_status',
            value: {
              mpesa:    Number(mpesaCount[0]?.c    || 0),
              stripe:   Number(stripeCount[0]?.c   || 0),
              paystack: Number(paystackCount[0]?.c || 0),
              payhero:  Number(payheroCount[0]?.c  || 0),
            },
          })
        } catch (gwErr) {
          console.error('[gateway_status]', gwErr)
          return NextResponse.json({ key: 'gateway_status', value: { mpesa: 0, stripe: 0, paystack: 0, payhero: 0 } })
        }
      }

      // Legacy: payhere_status kept for backwards compatibility (now always unconfigured)
      if (key === 'payhere_status') {
        return NextResponse.json({ key: 'payhere_status', value: { configured: false, sandbox: true } })
      }

      // platform_gateways: mask secret fields before returning to the browser
      if (key === 'platform_gateways') {
        const setting = await db.query.systemSettings.findFirst({
          where: eq(systemSettings.key, 'platform_gateways'),
        })
        const raw = (setting?.value as Record<string, unknown>) || {}
        const SECRET_FIELDS = [
          'mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaPasskey',
          'stripeSecretKey', 'stripeWebhookSecret',
          'paystackSecretKey', 'paystackWebhookSecret',
          'payheroApiPassword',
        ]
        const masked: Record<string, unknown> = { ...raw }
        for (const field of SECRET_FIELDS) {
          if (masked[field]) {
            masked[`${field}IsSet`] = true
            masked[field] = '' // never send the actual secret to the browser
          } else {
            masked[`${field}IsSet`] = false
          }
        }
        return NextResponse.json({ key: 'platform_gateways', value: masked })
      }

      const setting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, key),
      })
      return NextResponse.json(setting || { key, value: {} })
    }

    const settings = await db.query.systemSettings.findMany()
    return NextResponse.json(settings)
  } catch (error) {
    logError('api/sys-control/settings', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/sys-control/settings - Update a setting
export async function PUT(request: NextRequest) {
  try {
    const rateLimited = await withRateLimit('/api/sys-control/settings')
    if (rateLimited) return rateLimited

    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = await validateBody(request, sysUpdateSettingSchema)
    if (!parsed.success) return parsed.response
    const { key, value, description } = parsed.data

    // Special handling for platform_gateways: merge with existing so empty fields
    // don't wipe out previously saved secret keys
    let finalValue = value
    if (key === 'platform_gateways') {
      const existing = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'platform_gateways'),
      })
      const existingVal = (existing?.value as Record<string, unknown>) || {}
      const incoming = (value as Record<string, unknown>) || {}

      // Secret fields: only overwrite if the incoming value is a non-empty string
      const SECRET_FIELDS = [
        'mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaPasskey',
        'stripeSecretKey', 'stripeWebhookSecret',
        'paystackSecretKey', 'paystackWebhookSecret',
        'payheroApiPassword',
      ]

      const merged: Record<string, unknown> = { ...existingVal }
      for (const [k, v] of Object.entries(incoming)) {
        if (SECRET_FIELDS.includes(k)) {
          // Only overwrite secret if a real new value was provided
          if (typeof v === 'string' && v.length > 0) {
            merged[k] = v
          }
          // else keep the existing value
        } else {
          merged[k] = v
        }
      }
      finalValue = merged
    }

    // Check if setting exists
    const existing = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key),
    })

    let result
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({
          value: finalValue as Record<string, unknown>,
          description: description || existing.description,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, key))
        .returning()
      result = updated
    } else {
      const [created] = await db.insert(systemSettings)
        .values({
          key,
          value: finalValue as Record<string, unknown>,
          description,
        })
        .returning()
      result = created
    }

    // Audit log
    await adminAudit.update(session.superAdminId, 'setting', result.id, { key })

    return NextResponse.json(result)
  } catch (error) {
    logError('api/sys-control/settings', error)
    return NextResponse.json({ error: 'Failed to update setting', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
