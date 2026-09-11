/**
 * Drizzle Kit config for generating/running SQLite offline migrations.
 * Run with: npx drizzle-kit generate --config=src/lib/db/drizzle-offline.config.ts
 *           npx drizzle-kit migrate  --config=src/lib/db/drizzle-offline.config.ts
 */
import { defineConfig } from 'drizzle-kit'
import path from 'path'

const dbPath = process.env.ELITPOS_OFFLINE_DB_PATH
  || path.join(process.env.APPDATA ?? process.env.HOME ?? '.', 'ElitPOS', 'elitpos-offline.db')

export default defineConfig({
  schema: './src/lib/db/offline-schema.ts',
  out: './drizzle-offline',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
})
