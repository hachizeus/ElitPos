import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  const val = trimmed.slice(eq + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

// Check current platform_gateways row
const res = await client.query(
  "SELECT key, jsonb_typeof(value) as vtype, length(value::text) as vlen FROM system_settings WHERE key = 'platform_gateways'"
)
console.log('Existing row:', res.rows)

// Try inserting a test value
try {
  await client.query(
    "INSERT INTO system_settings(key, value, description) VALUES('_test_pgw', $1, 'test') ON CONFLICT(key) DO UPDATE SET value=$1",
    [JSON.stringify({ mpesaEnabled: false, stripeEnabled: true, paystackEnabled: false, test: 'hello' })]
  )
  console.log('Test insert/update: OK')
  await client.query("DELETE FROM system_settings WHERE key='_test_pgw'")
} catch (e) {
  console.error('Insert failed:', e.message)
}

await client.end()
