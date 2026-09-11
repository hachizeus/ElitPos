/**
 * Reset all saved workspace configs to force users back to defaults.
 * Run: npx tsx scripts/reset-workspace.ts
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { workspaceConfigs } from '../src/lib/db/schema'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool)

  const deleted = await db.delete(workspaceConfigs).returning({ id: workspaceConfigs.id, key: workspaceConfigs.workspaceKey })
  console.log(`Deleted ${deleted.length} workspace configs:`, deleted.map(d => d.key))

  await pool.end()
  console.log('Done — all dashboards will now use the updated defaults.')
}

main().catch(console.error)
