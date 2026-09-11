import pg from 'pg'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function applyMigration() {
  const dbUrl = process.env.DATABASE_URL?.trim()
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set in .env')
    process.exit(1)
  }
  
  const pool = new Pool({ connectionString: dbUrl })
  
  try {
    const sql = fs.readFileSync('migrations/add-sms-notification-preference.sql', 'utf-8')
    console.log('Applying SMS notification preference migration...')
    await pool.query(sql)
    console.log('✅ SMS notification preference migration applied successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

applyMigration()
