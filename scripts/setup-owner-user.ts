/**
 * Creates a users row and accountTenants row for an existing account
 * so they can sign into the company portal.
 *
 * Run: npx tsx scripts/setup-owner-user.ts
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql, eq, and } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

const { accounts, tenants, users, accountTenants } = schema

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })

  // ── Step 1: find the account ────────────────────────────────────────────
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.email, 'victorgathecha@gmail.com'),
  })
  if (!account) {
    console.error('❌ Account not found for victorgathecha@gmail.com')
    await pool.end(); process.exit(1)
  }
  console.log('✅ Found account:', account.id, account.fullName)

  // ── Step 2: find the tenant ─────────────────────────────────────────────
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, 'elitjohnsdigitalagency'),
  })
  if (!tenant) {
    console.error('❌ Tenant not found: elitjohnsdigitalagency')
    await pool.end(); process.exit(1)
  }
  console.log('✅ Found tenant:', tenant.id, tenant.name)

  // ── Step 3: set RLS tenant context ─────────────────────────────────────
  await db.execute(sql`SELECT set_config('app.tenant_id', ${tenant.id}, false)`)

  // ── Step 4: check if users row already exists ───────────────────────────
  const existingUser = await db.query.users.findFirst({
    where: and(
      eq(users.email, account.email),
      eq(users.tenantId, tenant.id)
    ),
  })

  if (existingUser) {
    console.log('ℹ️  users row already exists:', existingUser.id, '— activating if inactive')
    if (!existingUser.isActive) {
      await db.update(users)
        .set({ isActive: true, role: 'owner' })
        .where(eq(users.id, existingUser.id))
      console.log('✅ Reactivated user')
    } else {
      console.log('✅ User already active, role:', existingUser.role)
    }
  } else {
    // Insert users row
    const [newUser] = await db.insert(users).values({
      tenantId: tenant.id,
      accountId: account.id,
      email: account.email,
      fullName: account.fullName,
      passwordHash: account.passwordHash,  // same hash as accounts table
      role: 'owner',
      isActive: true,
      isSuperAdmin: false,
    }).returning()
    console.log('✅ Created users row:', newUser.id)
  }

  // ── Step 5: check / create accountTenants row ───────────────────────────
  // Reset RLS to bypass it for the global accountTenants table
  await db.execute(sql`SELECT set_config('app.tenant_id', '', false)`)

  const existingMembership = await db.query.accountTenants.findFirst({
    where: and(
      eq(accountTenants.accountId, account.id),
      eq(accountTenants.tenantId, tenant.id)
    ),
  })

  if (existingMembership) {
    console.log('ℹ️  accountTenants row exists — ensuring active')
    if (!existingMembership.isActive) {
      await db.update(accountTenants)
        .set({ isActive: true, role: 'owner', isOwner: true, acceptedAt: new Date() })
        .where(eq(accountTenants.id, existingMembership.id))
      console.log('✅ Reactivated membership')
    } else {
      console.log('✅ Membership already active')
    }
  } else {
    const [newMembership] = await db.insert(accountTenants).values({
      accountId: account.id,
      tenantId: tenant.id,
      role: 'owner',
      isOwner: true,
      isActive: true,
      acceptedAt: new Date(),
    }).returning()
    console.log('✅ Created accountTenants row:', newMembership.id)
  }

  console.log('\n🎉 Done! You can now:')
  console.log('  1. Log into http://localhost:3000/c/elitjohnsdigitalagency/login')
  console.log('     Email:    victorgathecha@gmail.com')
  console.log('     Password: (same as account portal password)')
  console.log('  2. OR just visit /account and click "Open" next to the company')
  console.log('     (auto-transfer will work now)\n')

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
