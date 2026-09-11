/**
 * ElitPOS — Offline SQLite Database Connection
 *
 * This module provides a Drizzle ORM instance backed by better-sqlite3.
 * It is used:
 *   - In the Electron main process (via server.js) when ELITPOS_RUNTIME_MODE=electron
 *   - In the Next.js API routes that need local SQLite reads/writes offline
 *
 * The module gracefully skips initialization when better-sqlite3 is not
 * available (i.e. in a browser/Capacitor context where IndexedDB is used).
 */

import path from 'path'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as offlineSchema from './offline-schema'

// Use a loose type for the offline DB instance to avoid hard dependency
// on better-sqlite3 types at compile time (it's an optional native module)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OfflineDb = BetterSQLite3Database<typeof offlineSchema> | any

let _offlineDb: OfflineDb | null = null

function createOfflineDb(dbPath: string) {
  // Dynamic require — better-sqlite3 is a native module, only available in Node.
  // The `any` cast is intentional: the types come from @types/better-sqlite3
  // which is a devDependency. If the types aren't installed yet the cast
  // prevents a hard TS error while still giving us runtime safety.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Database = require('better-sqlite3') as any
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3') as typeof import('drizzle-orm/better-sqlite3')

  const sqlite = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  })

  // Performance pragmas
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('cache_size = -32000')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('temp_store = MEMORY')

  return drizzle(sqlite, { schema: offlineSchema })
}

/** Get or create the offline SQLite Drizzle instance. */
export function getOfflineDb(): OfflineDb {
  if (_offlineDb) return _offlineDb

  const dataDir = process.env.ELITPOS_DATA_DIR
    || (process.platform === 'win32'
      ? path.join(process.env.APPDATA ?? process.env.HOME ?? '.', 'ElitPOS')
      : path.join(process.env.HOME ?? '.', '.elitpos'))

  const dbPath = path.join(dataDir, 'elitpos-offline.db')
  _offlineDb = createOfflineDb(dbPath)
  return _offlineDb
}

/** True when the runtime is configured for offline/SQLite mode. */
export function isOfflineMode(): boolean {
  return (
    process.env.ELITPOS_RUNTIME_MODE === 'electron' ||
    process.env.ELITPOS_RUNTIME_MODE === 'offline'
  )
}

export type { OfflineDb }
export { offlineSchema }
