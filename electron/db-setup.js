/**
 * ElitPOS Electron — Local SQLite Database Setup
 *
 * When running in offline / Electron mode, the app uses SQLite instead of
 * PostgreSQL. This module:
 *   1. Creates the SQLite database file in the user's app-data directory
 *   2. Runs the schema initialization (creates all tables)
 *   3. Runs pending migrations
 *   4. Seeds default data for single-tenant / offline use
 *
 * NOTE: This module is loaded by the Next.js server process (NOT the Electron
 * main process) when ELITPOS_RUNTIME_MODE === 'electron'.
 */

'use strict'

const path = require('path')
const fs = require('fs')

/**
 * Initialize the offline SQLite database.
 * @param {string} dataDir - path to the Electron userData directory
 * @returns {{ dbPath: string, isNew: boolean }}
 */
async function initOfflineDb(dataDir) {
  // Ensure the data directory exists
  fs.mkdirSync(dataDir, { recursive: true })

  const dbPath = path.join(dataDir, 'elitpos-offline.db')
  const isNew = !fs.existsSync(dbPath)

  console.log(`[DB Setup] SQLite path: ${dbPath} (${isNew ? 'new' : 'existing'})`)

  // Dynamic import: only available in Electron runtime (not in web bundle)
  let Database
  try {
    Database = require('better-sqlite3')
  } catch {
    console.warn('[DB Setup] better-sqlite3 not available — skipping SQLite init')
    return { dbPath, isNew, skipped: true }
  }

  const db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  })

  // Performance pragmas (safe for local single-user DB)
  db.pragma('journal_mode = WAL')      // Write-Ahead Logging for better concurrency
  db.pragma('synchronous = NORMAL')    // Faster writes, still crash-safe
  db.pragma('cache_size = -64000')     // 64MB page cache
  db.pragma('foreign_keys = ON')       // Enforce FK constraints
  db.pragma('temp_store = MEMORY')     // Temp tables in RAM

  if (isNew) {
    // Create schema for offline-capable tables
    runOfflineSchema(db)
    console.log('[DB Setup] Offline schema initialized')
  }

  // Always run migrations to handle upgrades
  runMigrations(db)

  db.close()
  return { dbPath, isNew }
}

/**
 * Create all tables needed for offline operation.
 * This is a subset of the full PostgreSQL schema, focused on:
 * - POS (sales, items, customers)
 * - Inventory (items, stock)
 * - Basic auth (offline JWT validation only)
 * - Offline sync queue
 */
function runOfflineSchema(db) {
  // Schema version tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS _offline_schema_version (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Offline sync queue — stores pending mutations while offline
  db.exec(`
    CREATE TABLE IF NOT EXISTS _offline_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id   TEXT NOT NULL,
      method      TEXT NOT NULL,         -- GET, POST, PATCH, DELETE
      endpoint    TEXT NOT NULL,         -- /api/sales
      body        TEXT,                  -- JSON body (nullable for GET/DELETE)
      headers     TEXT,                  -- JSON headers
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      attempts    INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT,
      synced      INTEGER NOT NULL DEFAULT 0  -- 0=pending, 1=synced
    );

    CREATE INDEX IF NOT EXISTS idx_offline_queue_tenant_synced
      ON _offline_queue(tenant_id, synced);
  `)

  // Items (product catalog)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      name            TEXT NOT NULL,
      sku             TEXT,
      barcode         TEXT,
      category_id     TEXT,
      unit_price      REAL NOT NULL DEFAULT 0,
      cost_price      REAL NOT NULL DEFAULT 0,
      tax_rate        REAL NOT NULL DEFAULT 0,
      stock_quantity  REAL NOT NULL DEFAULT 0,
      min_stock       REAL NOT NULL DEFAULT 0,
      is_active       INTEGER NOT NULL DEFAULT 1,
      is_service      INTEGER NOT NULL DEFAULT 0,
      image_url       TEXT,
      description     TEXT,
      metadata        TEXT,   -- JSON
      updated_at      TEXT,
      synced_at       TEXT    -- last sync from server
    );

    CREATE INDEX IF NOT EXISTS idx_items_tenant ON items(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(tenant_id, barcode);
    CREATE INDEX IF NOT EXISTS idx_items_sku ON items(tenant_id, sku);
  `)

  // Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      parent_id   TEXT,
      color       TEXT,
      icon        TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      synced_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
  `)

  // Customers
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      name          TEXT NOT NULL,
      phone         TEXT,
      email         TEXT,
      address       TEXT,
      credit_limit  REAL NOT NULL DEFAULT 0,
      credit_balance REAL NOT NULL DEFAULT 0,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      is_active     INTEGER NOT NULL DEFAULT 1,
      metadata      TEXT,   -- JSON
      updated_at    TEXT,
      synced_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(tenant_id, phone);
  `)

  // Offline sales (POS transactions created offline)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      sale_number     TEXT,
      customer_id     TEXT,
      subtotal        REAL NOT NULL DEFAULT 0,
      tax_total       REAL NOT NULL DEFAULT 0,
      discount_total  REAL NOT NULL DEFAULT 0,
      total           REAL NOT NULL DEFAULT 0,
      amount_paid     REAL NOT NULL DEFAULT 0,
      change_amount   REAL NOT NULL DEFAULT 0,
      payment_method  TEXT NOT NULL DEFAULT 'cash',
      status          TEXT NOT NULL DEFAULT 'completed',
      cashier_id      TEXT,
      pos_profile_id  TEXT,
      notes           TEXT,
      metadata        TEXT,   -- JSON (line items stored here offline)
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      synced          INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(tenant_id, synced);
  `)

  // Warehouses
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      is_default  INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      synced_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);
  `)

  // POS profiles
  db.exec(`
    CREATE TABLE IF NOT EXISTS pos_profiles (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      name            TEXT NOT NULL,
      warehouse_id    TEXT,
      default_customer_id TEXT,
      tax_inclusive   INTEGER NOT NULL DEFAULT 0,
      allow_discount  INTEGER NOT NULL DEFAULT 1,
      is_active       INTEGER NOT NULL DEFAULT 1,
      settings        TEXT,   -- JSON
      synced_at       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pos_profiles_tenant ON pos_profiles(tenant_id);
  `)

  // Payment methods
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'cash',
      is_active   INTEGER NOT NULL DEFAULT 1,
      synced_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);
  `)

  // Offline session cache (for JWT validation without DB)
  db.exec(`
    CREATE TABLE IF NOT EXISTS _offline_sessions (
      tenant_id     TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      user_role     TEXT NOT NULL,
      user_email    TEXT NOT NULL,
      user_name     TEXT,
      tenant_name   TEXT,
      business_type TEXT,
      jwt_hash      TEXT NOT NULL,  -- SHA256 of the JWT to detect tampering
      expires_at    TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tenant_id, user_id)
    );
  `)

  // Sync state tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS _offline_sync_state (
      entity_type   TEXT NOT NULL,
      tenant_id     TEXT NOT NULL,
      last_synced_at TEXT,
      etag          TEXT,
      PRIMARY KEY (entity_type, tenant_id)
    );
  `)

  // Mark schema version
  const stmt = db.prepare('INSERT OR IGNORE INTO _offline_schema_version (version) VALUES (?)')
  stmt.run(1)
}

/**
 * Run incremental migrations on the SQLite DB.
 * New migrations are added here as the app evolves.
 */
function runMigrations(db) {
  const currentVersion = db.prepare('SELECT MAX(version) as v FROM _offline_schema_version').get()?.v ?? 0

  const migrations = [
    // v1 is handled by runOfflineSchema (initial setup)
    // Add new migrations below:
    // { version: 2, sql: `ALTER TABLE items ADD COLUMN ...` },
  ]

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue

    console.log(`[DB Setup] Running offline migration v${migration.version}`)
    const run = db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO _offline_schema_version (version) VALUES (?)').run(migration.version)
    })
    run()
  }
}

module.exports = { initOfflineDb }
