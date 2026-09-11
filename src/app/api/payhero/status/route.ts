import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { accountAuth } from '@/lib/auth/account-auth'
import { db, withTenant } from '@/lib/db'
import { gatewayTransactions, paymentGatewayConfigs } from '@/lib/db/schema'
import { eq, and, or } from 'drizzle-orm'
import { queryPayheroStatus, buildPayheroConfig, payheroStatusToInternal } from '@/lib/payhero'
import { logError } from '@/lib/ai/error-logger'
import { getPlatformGatewayConfig } from '@/app/api/sys-control/platform-gateways/route'

// GET /api/payhero/status?ref=INTERNAL_REF
// Works for both company sessions (POS) and account sessions (subscription/wallet)
export async function GET(request: NextRequest) {
  try {
    const companySession = await authWithCompany()
    const accountSession = await accountAuth()

    if (!companySession?.user?.tenantId && !accountSession?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref') || ''
    if (!ref) {
      return NextResponse.json({ error: 'ref is required' }, { status: 400 })
    }

    // Find transaction
    let transaction = null
    if (companySession?.user?.tenantId) {
      transaction = await db.query.gatewayTransactions.findFirst({
        where: and(
          eq(gatewayTransactions.tenantId, companySession.user.tenantId),
          or(
            eq(gatewayTransactions.internalReference, ref),
            eq(gatewayTransactions.gatewayReference, ref)
          )
        ),
      })
    }
    if (!transaction) {
      transaction = await db.query.gatewayTransactions.findFirst({
        where: or(
          eq(gatewayTransactions.internalReference, ref),
          eq(gatewayTransactions.gatewayReference, ref)
        ),
      })
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (['success', 'failed', 'cancelled'].includes(transaction.status)) {
      return NextResponse.json({ status: transaction.status })
    }

    // Build correct PayHero config
    let phConfig = null
    if (transaction.context === 'subscription' || !transaction.tenantId) {
      const platformConfig = await getPlatformGatewayConfig()
      if (platformConfig?.payheroEnabled) {
        phConfig = buildPayheroConfig({
          payheroApiUsername: platformConfig.payheroApiUsername,
          payheroApiPassword: platformConfig.payheroApiPassword,
          payheroChannelId: platformConfig.payheroChannelId,
        })
      }
    } else if (transaction.tenantId) {
      const config = await withTenant(transaction.tenantId, async (tdb) => {
        return tdb.query.paymentGatewayConfigs.findFirst({
          where: eq(paymentGatewayConfigs.tenantId, transaction.tenantId!),
        })
      })
      if (config) phConfig = buildPayheroConfig(config)
    }

    if (phConfig && transaction.gatewayReference) {
      try {
        const result = await queryPayheroStatus(phConfig, transaction.gatewayReference)
        const internalStatus = payheroStatusToInternal(result.status || 'PENDING')
        if (internalStatus !== 'pending') {
          await db
            .update(gatewayTransactions)
            .set({
              status: internalStatus,
              completedAt: internalStatus === 'success' ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(gatewayTransactions.id, transaction.id))
          return NextResponse.json({ status: internalStatus })
        }
      } catch {
        // Fall through
      }
    }

    return NextResponse.json({ status: transaction.status })
  } catch (error) {
    logError('api/payhero/status', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
