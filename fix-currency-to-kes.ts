/**
 * One-time script: Update all pricing tier currencies from any value to KES.
 * Run with: npx tsx fix-currency-to-kes.ts
 */
import * as dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { pricingTiers, accounts, tenants } from './src/lib/db/schema'
import { ne, eq } from 'drizzle-orm'

dotenv.config()

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool)

  console.log('Fixing currency references to KES...\n')

  // 1. Update pricing tiers
  const updatedTiers = await db
    .update(pricingTiers)
    .set({ currency: 'KES' })
    .where(ne(pricingTiers.currency, 'KES'))
    .returning({ id: pricingTiers.id, name: pricingTiers.name, oldCurrency: pricingTiers.currency })

  console.log(`✅ Updated ${updatedTiers.length} pricing tier(s) to KES`)
  updatedTiers.forEach(t => console.log(`   - ${t.name}`))

  // 2. Update accounts default currency
  const updatedAccounts = await db
    .update(accounts)
    .set({ currency: 'KES' })
    .where(ne(accounts.currency, 'KES'))
    .returning({ id: accounts.id, email: accounts.email })

  console.log(`\n✅ Updated ${updatedAccounts.length} account(s) to KES`)
  updatedAccounts.forEach(a => console.log(`   - ${a.email}`))

  // 3. Update tenants default currency
  const updatedTenants = await db
    .update(tenants)
    .set({ currency: 'KES' })
    .where(ne(tenants.currency, 'KES'))
    .returning({ id: tenants.id, name: tenants.name, slug: tenants.slug })

  console.log(`\n✅ Updated ${updatedTenants.length} tenant(s) to KES`)
  updatedTenants.forEach(t => console.log(`   - ${t.name} (${t.slug})`))

  console.log('\n✅ Done. All currencies updated to KES.')
  await pool.end()
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
