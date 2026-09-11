import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { accountAuth } from '@/lib/auth/account-auth'
import { db, withTenant } from '@/lib/db'
import { gatewayTransactions, paymentGatewayConfigs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { queryStkStatus, buildMpesaConfig, mpesaResultToStatus } from '@/lib/mpesa'
import { validateSearchParams } from '@/lib/validation/helpers'
import { mpesaStatusSchema } from '@/lib/validation/schemas/gateways'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'

// GET /api/mpesa/status?checkoutRequestId=...
// Works for both company sessions (POS) and account sessions (subscription/wallet)
export async function GET(request: NextRequest) {
  try {
    const parsed = validateSearchParams(request, mpesaStatusSchema)
    if (!parsed.success) return parsed.response
    const { checkoutRequestId } = parsed.data

    const companySession = await authWithCompany()
    const accountSession = await accountAuth()

    if (!companySession?.user?.tenantId && !accountSession?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find transaction — try tenant scope first, then any match for account
    let transaction = null
    if (companySession?.user?.tenantId) {
      transaction = await db.query.gatewayTransactions.findFirst({
        where: and(
          eq(gatewayTransactions.gatewayReference, checkoutRequestId),
          eq(gatewayTransactions.tenantId, companySession.user.tenantId)
        ),
      })
    }
    if (!transaction) {
      transaction = await db.query.gatewayTransactions.findFirst({
        where: eq(gatewayTransactions.gatewayReference, checkoutRequestId),
      })
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Already resolved — return immediately
    if (['success', 'failed', 'cancelled'].includes(transaction.status)) {
      return NextResponse.json({
        status: transaction.status,
        internalReference: transaction.internalReference,
        gatewayReference: transaction.gatewayReference,
        completedAt: transaction.completedAt,
      })
    }

    // Build the correct M-Pesa config to query Safaricom live
    let mpesaConfig = null
    if (transaction.context === 'subscription' || !transaction.tenantId) {
      const platformConfig = await getPlatformGatewayConfig()
      if (platformConfig?.mpesaEnabled) {
        mpesaConfig = buildMpesaConfig({
          mpesaConsumerKey: platformConfig.mpesaConsumerKey,
          mpesaConsumerSecret: platformConfig.mpesaConsumerSecret,
          mpesaShortcode: platformConfig.mpesaShortcode,
          mpesaPasskey: platformConfig.mpesaPasskey,
          mpesaEnvironment: platformConfig.mpesaEnvironment,
          mpesaCallbackBaseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        })
      }
    } else if (transaction.tenantId) {
      const config = await withTenant(transaction.tenantId, async (tdb) => {
        return tdb.query.paymentGatewayConfigs.findFirst({
          where: eq(paymentGatewayConfigs.tenantId, transaction.tenantId!),
        })
      })
      if (config) mpesaConfig = buildMpesaConfig(config)
    }

    if (mpesaConfig) {
      try {
        const queryResult = await queryStkStatus(mpesaConfig, checkoutRequestId)
        const resolvedStatus = mpesaResultToStatus(queryResult.ResultCode)
        if (resolvedStatus !== 'pending') {
          await db
            .update(gatewayTransactions)
            .set({
              status: resolvedStatus,
              completedAt: new Date(),
              metadata: {
                ...(transaction.metadata as Record<string, unknown> || {}),
                queryResultCode: queryResult.ResultCode,
                queryResultDesc: queryResult.ResultDesc,
              },
              updatedAt: new Date(),
            })
            .where(eq(gatewayTransactions.id, transaction.id))

          return NextResponse.json({
            status: resolvedStatus,
            internalReference: transaction.internalReference,
            gatewayReference: transaction.gatewayReference,
          })
        }
      } catch {
        // Safaricom query failed — return pending, client will retry
      }
    }

    return NextResponse.json({
      status: transaction.status,
      internalReference: transaction.internalReference,
      gatewayReference: transaction.gatewayReference,
    })
  } catch (error) {
    logError('api/mpesa/status', error)
    return NextResponse.json({ error: 'Failed to check payment status' }, { status: 500 })
  }
}
