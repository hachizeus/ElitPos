import { NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { withTenant } from '@/lib/db'
import { appointments, workOrders, insuranceEstimates, warehouseStock, items } from '@/lib/db/schema'
import { eq, and, or, sql } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

export async function GET() {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessType = session.user.businessType || 'retail'
    const today = new Date().toISOString().split('T')[0]

    // Execute with RLS tenant context
    return await withTenant(session.user.tenantId, async (db) => {
      // Run all 5 COUNT queries in parallel — no dependency between them
      const [
        [todayAppointmentsResult],
        [draftWorkOrdersResult],
        [pendingWorkOrdersResult],
        [pendingEstimatesResult],
        lowStockResult,
      ] = await Promise.all([
        // Today's appointments count (RLS scopes to tenant)
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(appointments)
          .where(and(
            eq(appointments.scheduledDate, today),
            or(
              eq(appointments.status, 'scheduled'),
              eq(appointments.status, 'confirmed'),
              eq(appointments.status, 'arrived')
            )
          )),

        // Draft work orders count (RLS scopes to tenant)
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(workOrders)
          .where(eq(workOrders.status, 'draft')),

        // Pending work orders count - in_progress or confirmed (RLS scopes to tenant)
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(workOrders)
          .where(or(
            eq(workOrders.status, 'in_progress'),
            eq(workOrders.status, 'confirmed')
          )),

        // Pending estimates count - submitted or under_review (RLS scopes to tenant)
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(insuranceEstimates)
          .where(or(
            eq(insuranceEstimates.status, 'submitted'),
            eq(insuranceEstimates.status, 'under_review')
          )),

        // Low stock items count (RLS scopes to tenant)
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${warehouseStock.itemId})` })
          .from(warehouseStock)
          .innerJoin(items, eq(items.id, warehouseStock.itemId))
          .where(and(
            eq(items.isActive, true),
            eq(items.trackStock, true),
            sql`CAST(${warehouseStock.currentStock} AS DECIMAL) <= CAST(${warehouseStock.minStock} AS DECIMAL)`
          ))
          .catch(() => [{ count: 0 as number }]), // warehouse_stock table may not exist yet
      ])

      const lowStockCount = Number((lowStockResult as Array<{ count: number }>)[0]?.count || 0)

      return NextResponse.json({
        stats: {
          todayAppointments: Number(todayAppointmentsResult?.count || 0),
          draftWorkOrders: Number(draftWorkOrdersResult?.count || 0),
          pendingWorkOrders: Number(pendingWorkOrdersResult?.count || 0),
          pendingEstimates: Number(pendingEstimatesResult?.count || 0),
          lowStockItems: lowStockCount,
        },
        businessType,
      })
    })
  } catch (error) {
    logError('api/dashboard/stats', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
