/**
 * POST /api/sys-control/fix-login
 *
 * Emergency login repair endpoint. Protected by CRON_SECRET.
 * Diagnoses and fixes the 5 common reasons login fails for a given
 * email + tenant slug without needing direct DB access.
 *
 * Usage:
 *   curl -X POST https://app.elitpos.elitjohnsdigital.co.ke/api/sys-control/fix-login \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"victorgathecha@gmail.com","slug":"elitjohnsdigitalagency"}'
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accounts, tenants, users, accountTenants, rateLimitAttempts } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

export async function POST(request: NextRequest) {
  // Guard with CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email, slug } = await request.json() as { email: string; slug: string }
    if (!email || !slug) {
      return NextResponse.json({ error: 'email and slug are required' }, { status: 400 })
    }

    const fixes: string[] = []
    const issues: string[] = []

    // ── 1. Account ─────────────────────────────────────────────────────────
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.email, email.toLowerCase()),
    })

    if (!account) {
      return NextResponse.json({
        ok: false,
        issues: [`No accounts record found for ${email}. The user has never registered.`],
        fixes: [],
      })
    }

    if (!account.isActive) {
      await db.update(accounts).set({ isActive: true }).where(eq(accounts.id, account.id))
      fixes.push('Reactivated account record')
    }

    // ── 2. Tenant ───────────────────────────────────────────────────────────
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    })

    if (!tenant) {
      return NextResponse.json({
        ok: false,
        issues: [`No tenant found with slug="${slug}"`],
        fixes,
      })
    }

    if (tenant.status !== 'active') {
      issues.push(`Tenant status was "${tenant.status}"`)
      await db.update(tenants).set({ status: 'active' }).where(eq(tenants.id, tenant.id))
      fixes.push(`Tenant status set to "active"`)
    }

    // Clear expired planExpiresAt (blocked login in old code)
    if (tenant.planExpiresAt && new Date(tenant.planExpiresAt) < new Date()) {
      issues.push(`planExpiresAt was ${tenant.planExpiresAt} (expired — this blocked login)`)
      await db.execute(
        sql`UPDATE tenants SET plan_expires_at = NULL WHERE id = ${tenant.id}`
      )
      fixes.push('Cleared expired planExpiresAt')
    }

    // ── 3. Users row ────────────────────────────────────────────────────────
    await db.execute(sql`SELECT set_config('app.tenant_id', ${tenant.id}, false)`)

    const user = await db.query.users.findFirst({
      where: and(
        eq(users.email, email.toLowerCase()),
        eq(users.tenantId, tenant.id)
      ),
    })

    if (!user) {
      issues.push('No users row found for this email+tenant')
      const [newUser] = await db.insert(users).values({
        tenantId: tenant.id,
        accountId: account.id,
        email: account.email,
        fullName: account.fullName,
        passwordHash: account.passwordHash,
        role: 'owner',
        isActive: true,
        isSuperAdmin: false,
      }).returning()
      fixes.push(`Created users row (id: ${newUser.id}, role: owner)`)
    } else if (!user.isActive) {
      issues.push('users row existed but isActive=false')
      await db.update(users).set({ isActive: true }).where(eq(users.id, user.id))
      fixes.push('Reactivated users row')
    }

    // ── 4. accountTenants ───────────────────────────────────────────────────
    await db.execute(sql`SELECT set_config('app.tenant_id', '', false)`)

    const membership = await db.query.accountTenants.findFirst({
      where: and(
        eq(accountTenants.accountId, account.id),
        eq(accountTenants.tenantId, tenant.id)
      ),
    })

    if (!membership) {
      issues.push('No accountTenants membership found')
      await db.insert(accountTenants).values({
        accountId: account.id,
        tenantId: tenant.id,
        role: 'owner',
        isOwner: true,
        isActive: true,
        acceptedAt: new Date(),
      })
      fixes.push('Created accountTenants owner membership')
    } else if (!membership.isActive) {
      issues.push('accountTenants membership was inactive')
      await db.update(accountTenants)
        .set({ isActive: true })
        .where(eq(accountTenants.id, membership.id))
      fixes.push('Reactivated accountTenants membership')
    }

    // ── 5. Rate limit ───────────────────────────────────────────────────────
    try {
      await db.execute(
        sql`DELETE FROM rate_limit_attempts WHERE identifier = ${email.toLowerCase()} AND category = 'login'`
      )
      fixes.push('Cleared login rate limit')
    } catch { /* table may not exist */ }

    const allGood = issues.length === 0

    return NextResponse.json({
      ok: true,
      email,
      slug,
      tenantName: tenant.name,
      issues: issues.length > 0 ? issues : ['No issues found — login should already work'],
      fixes: fixes.length > 0 ? fixes : ['No changes needed'],
      message: allGood
        ? 'No issues found. If login still fails, check the password is correct.'
        : `Fixed ${fixes.length} issue(s). Login should now work.`,
    })
  } catch (error) {
    logError('api/sys-control/fix-login', error)
    return NextResponse.json({ error: 'Fix failed', details: String(error) }, { status: 500 })
  }
}
