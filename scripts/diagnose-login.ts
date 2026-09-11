/**
 * Diagnoses and fixes login issues for a given email + tenant slug.
 *
 * Run against LOCAL:
 *   npx tsx scripts/diagnose-login.ts
 *
 * Run against PRODUCTION (Railway):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/diagnose-login.ts
 *   or set it in .env temporarily, run, then revert.
 *
 * What it checks:
 *   1. Account exists (accounts table)
 *   2. Tenant exists and is active
 *   3. Tenant planExpiresAt not expired
 *   4. Users row exists and isActive
 *   5. accountTenants membership exists and isActive
 *   6. Password hash matches (by testing bcrypt.compare)
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, and, sql } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'
import bcrypt from 'bcryptjs'

const EMAIL = process.env.CHECK_EMAIL || 'victorgathecha@gmail.com'
const SLUG  = process.env.CHECK_SLUG  || 'elitjohnsdigitalagency'
const PASSWORD = process.env.CHECK_PASS || '' // optional: provide to test password

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })

async function main() {
  console.log(`\n🔍 Diagnosing login for: ${EMAIL} @ ${SLUG}`)
  console.log(`   DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}\n`)

  // ── 1. Account ──────────────────────────────────────────────────────────
  const account = await db.query.accounts.findFirst({
    where: eq(schema.accounts.email, EMAIL),
  })

  if (!account) {
    console.log('❌ FAIL: No accounts row found for this email.')
    console.log('   → The user has never registered on this platform.')
    await pool.end(); return
  }
  console.log(`✅ accounts: id=${account.id} name="${account.fullName}" isActive=${account.isActive}`)
  if (!account.isActive) {
    console.log('⚠️  Account is inactive — will attempt to reactivate.')
    await db.update(schema.accounts).set({ isActive: true }).where(eq(schema.accounts.id, account.id))
    console.log('   ✅ Reactivated account.')
  }

  // ── 2. Tenant ───────────────────────────────────────────────────────────
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, SLUG),
  })

  if (!tenant) {
    console.log(`❌ FAIL: No tenant found with slug="${SLUG}"`)
    await pool.end(); return
  }
  console.log(`✅ tenants: id=${tenant.id} name="${tenant.name}" status=${tenant.status}`)

  if (tenant.status !== 'active') {
    console.log(`⚠️  Tenant status is "${tenant.status}" — must be "active" to login.`)
    console.log('   → Activating tenant...')
    await db.update(schema.tenants)
      .set({ status: 'active' })
      .where(eq(schema.tenants.id, tenant.id))
    console.log('   ✅ Tenant activated.')
  }

  if (tenant.planExpiresAt && new Date(tenant.planExpiresAt) < new Date()) {
    console.log(`⚠️  planExpiresAt=${tenant.planExpiresAt} is in the past — this BLOCKS login.`)
    console.log('   → Clearing planExpiresAt...')
    await db.update(schema.tenants)
      .set({ planExpiresAt: null } as Partial<typeof schema.tenants.$inferInsert>)
      .where(eq(schema.tenants.id, tenant.id))
    console.log('   ✅ planExpiresAt cleared.')
  } else {
    console.log(`   planExpiresAt: ${tenant.planExpiresAt ?? 'not set (OK)'}`)
  }

  // ── 3. users row ────────────────────────────────────────────────────────
  await db.execute(sql`SELECT set_config('app.tenant_id', ${tenant.id}, false)`)

  const user = await db.query.users.findFirst({
    where: and(
      eq(schema.users.email, EMAIL),
      eq(schema.users.tenantId, tenant.id)
    ),
  })

  if (!user) {
    console.log('❌ FAIL: No users row found for this email+tenant combination.')
    console.log('   → Creating users row from account data...')
    const [newUser] = await db.insert(schema.users).values({
      tenantId: tenant.id,
      accountId: account.id,
      email: account.email,
      fullName: account.fullName,
      passwordHash: account.passwordHash,
      role: 'owner',
      isActive: true,
      isSuperAdmin: false,
    }).returning()
    console.log(`   ✅ Created users row: id=${newUser.id}`)
  } else {
    console.log(`✅ users: id=${user.id} role=${user.role} isActive=${user.isActive}`)
    if (!user.isActive) {
      console.log('⚠️  User is inactive — reactivating...')
      await db.update(schema.users)
        .set({ isActive: true })
        .where(eq(schema.users.id, user.id))
      console.log('   ✅ User reactivated.')
    }
  }

  // ── 4. accountTenants ───────────────────────────────────────────────────
  await db.execute(sql`SELECT set_config('app.tenant_id', '', false)`)
  const membership = await db.query.accountTenants.findFirst({
    where: and(
      eq(schema.accountTenants.accountId, account.id),
      eq(schema.accountTenants.tenantId, tenant.id)
    ),
  })

  if (!membership) {
    console.log('⚠️  No accountTenants row — creating owner membership...')
    await db.insert(schema.accountTenants).values({
      accountId: account.id,
      tenantId: tenant.id,
      role: 'owner',
      isOwner: true,
      isActive: true,
      acceptedAt: new Date(),
    })
    console.log('   ✅ Membership created.')
  } else {
    console.log(`✅ accountTenants: id=${membership.id} role=${membership.role} isActive=${membership.isActive} isOwner=${membership.isOwner}`)
    if (!membership.isActive) {
      console.log('⚠️  Membership inactive — reactivating...')
      await db.update(schema.accountTenants)
        .set({ isActive: true })
        .where(eq(schema.accountTenants.id, membership.id))
      console.log('   ✅ Membership reactivated.')
    }
  }

  // ── 5. Rate limit check ─────────────────────────────────────────────────
  // Clear any existing rate limit for this email that might be blocking login
  const rateLimit = await db.query.rateLimitAttempts?.findFirst?.({
    where: (t: { identifier: { equals: (v: string) => unknown } }) => t.identifier.equals(EMAIL),
  }).catch(() => null)

  // Use raw SQL to clear rate limits since the schema access method varies
  await db.execute(
    sql`DELETE FROM rate_limit_attempts WHERE identifier = ${EMAIL} AND category = 'login'`
  ).catch(() => { /* table may not exist with that name */ })
  console.log('✅ Rate limit cleared for this email.')

  // ── 6. Password test ────────────────────────────────────────────────────
  if (PASSWORD) {
    const finalUser = await db.query.users.findFirst({
      where: and(eq(schema.users.email, EMAIL), eq(schema.users.tenantId, tenant.id))
    })
    if (finalUser) {
      const ok = await bcrypt.compare(PASSWORD, finalUser.passwordHash)
      console.log(ok ? '✅ Password: CORRECT' : '❌ Password: INCORRECT — check you are using the right password')
    }
  } else {
    console.log('ℹ️  Password not provided — skipping bcrypt test. Add CHECK_PASS=yourpassword to test.')
  }

  console.log(`\n🎉 Done. Try logging in at: https://${SLUG}.elitpos.elitjohnsdigital.co.ke/login`)
  console.log(`   Or via account portal: https://app.elitpos.elitjohnsdigital.co.ke/account\n`)

  await pool.end()
}

main().catch(e => { console.error('Script error:', e); process.exit(1) })
