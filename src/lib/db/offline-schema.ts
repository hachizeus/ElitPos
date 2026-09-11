/**
 * ElitPOS — SQLite Offline Schema (Drizzle ORM)
 *
 * This is the SQLite equivalent of the key tables in the PostgreSQL schema.
 * It covers everything needed for offline POS operation:
 *   - Items, categories, warehouses
 *   - Customers
 *   - Sales / POS transactions
 *   - Payment methods, POS profiles
 *   - Offline queue and sync state (mirrors IndexedDB queue for Electron)
 *
 * Uses drizzle-orm/better-sqlite3 dialect.
 * Shared across: Electron main process + Next.js server when RUNTIME_MODE=electron
 */

import {
  sqliteTable, text, integer, real, blob, index, uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ── Helper: ISO timestamp default ─────────────────────────────────────────────
const now = () => sql`(datetime('now'))`

// ── Tenants (single row in desktop mode) ─────────────────────────────────────
export const offlineTenants = sqliteTable('tenants', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  slug:         text('slug').notNull().unique(),
  businessType: text('business_type').notNull().default('retail'),
  plan:         text('plan').notNull().default('standard'),
  logoUrl:      text('logo_url'),
  currency:     text('currency').notNull().default('KES'),
  timezone:     text('timezone').notNull().default('Africa/Nairobi'),
  settings:     text('settings'),  // JSON
  syncedAt:     text('synced_at'),
})

// ── Users ─────────────────────────────────────────────────────────────────────
export const offlineUsers = sqliteTable('users', {
  id:           text('id').primaryKey(),
  tenantId:     text('tenant_id').notNull(),
  email:        text('email').notNull(),
  fullName:     text('full_name').notNull(),
  role:         text('role').notNull().default('cashier'),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  passwordHash: text('password_hash').notNull().default(''),
  syncedAt:     text('synced_at'),
}, (t) => [
  index('idx_offline_users_tenant').on(t.tenantId),
])

// ── Categories ────────────────────────────────────────────────────────────────
export const offlineCategories = sqliteTable('categories', {
  id:       text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name:     text('name').notNull(),
  parentId: text('parent_id'),
  color:    text('color'),
  icon:     text('icon'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  syncedAt: text('synced_at'),
}, (t) => [
  index('idx_offline_categories_tenant').on(t.tenantId),
])

// ── Warehouses ────────────────────────────────────────────────────────────────
export const offlineWarehouses = sqliteTable('warehouses', {
  id:        text('id').primaryKey(),
  tenantId:  text('tenant_id').notNull(),
  name:      text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  syncedAt:  text('synced_at'),
}, (t) => [
  index('idx_offline_warehouses_tenant').on(t.tenantId),
])

// ── Items ─────────────────────────────────────────────────────────────────────
export const offlineItems = sqliteTable('items', {
  id:            text('id').primaryKey(),
  tenantId:      text('tenant_id').notNull(),
  name:          text('name').notNull(),
  sku:           text('sku'),
  barcode:       text('barcode'),
  categoryId:    text('category_id'),
  unitPrice:     real('unit_price').notNull().default(0),
  costPrice:     real('cost_price').notNull().default(0),
  taxRate:       real('tax_rate').notNull().default(0),
  stockQuantity: real('stock_quantity').notNull().default(0),
  minStock:      real('min_stock').notNull().default(0),
  isActive:      integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isService:     integer('is_service', { mode: 'boolean' }).notNull().default(false),
  imageUrl:      text('image_url'),
  description:   text('description'),
  metadata:      text('metadata'),  // JSON
  updatedAt:     text('updated_at'),
  syncedAt:      text('synced_at'),
}, (t) => [
  index('idx_offline_items_tenant').on(t.tenantId),
  index('idx_offline_items_barcode').on(t.tenantId, t.barcode),
  index('idx_offline_items_sku').on(t.tenantId, t.sku),
])

// ── Customers ─────────────────────────────────────────────────────────────────
export const offlineCustomers = sqliteTable('customers', {
  id:             text('id').primaryKey(),
  tenantId:       text('tenant_id').notNull(),
  name:           text('name').notNull(),
  phone:          text('phone'),
  email:          text('email'),
  address:        text('address'),
  creditLimit:    real('credit_limit').notNull().default(0),
  creditBalance:  real('credit_balance').notNull().default(0),
  loyaltyPoints:  integer('loyalty_points').notNull().default(0),
  isActive:       integer('is_active', { mode: 'boolean' }).notNull().default(true),
  metadata:       text('metadata'),  // JSON
  updatedAt:      text('updated_at'),
  syncedAt:       text('synced_at'),
}, (t) => [
  index('idx_offline_customers_tenant').on(t.tenantId),
  index('idx_offline_customers_phone').on(t.tenantId, t.phone),
])

// ── POS Profiles ──────────────────────────────────────────────────────────────
export const offlinePosProfiles = sqliteTable('pos_profiles', {
  id:                text('id').primaryKey(),
  tenantId:          text('tenant_id').notNull(),
  name:              text('name').notNull(),
  warehouseId:       text('warehouse_id'),
  defaultCustomerId: text('default_customer_id'),
  taxInclusive:      integer('tax_inclusive', { mode: 'boolean' }).notNull().default(false),
  allowDiscount:     integer('allow_discount', { mode: 'boolean' }).notNull().default(true),
  isActive:          integer('is_active', { mode: 'boolean' }).notNull().default(true),
  settings:          text('settings'),  // JSON
  syncedAt:          text('synced_at'),
}, (t) => [
  index('idx_offline_pos_profiles_tenant').on(t.tenantId),
])

// ── Payment Methods ───────────────────────────────────────────────────────────
export const offlinePaymentMethods = sqliteTable('payment_methods', {
  id:       text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name:     text('name').notNull(),
  type:     text('type').notNull().default('cash'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  syncedAt: text('synced_at'),
}, (t) => [
  index('idx_offline_payment_methods_tenant').on(t.tenantId),
])

// ── Sales (offline POS transactions) ─────────────────────────────────────────
export const offlineSales = sqliteTable('sales', {
  id:             text('id').primaryKey(),
  tenantId:       text('tenant_id').notNull(),
  saleNumber:     text('sale_number'),
  customerId:     text('customer_id'),
  subtotal:       real('subtotal').notNull().default(0),
  taxTotal:       real('tax_total').notNull().default(0),
  discountTotal:  real('discount_total').notNull().default(0),
  total:          real('total').notNull().default(0),
  amountPaid:     real('amount_paid').notNull().default(0),
  changeAmount:   real('change_amount').notNull().default(0),
  paymentMethod:  text('payment_method').notNull().default('cash'),
  status:         text('status').notNull().default('completed'),
  cashierId:      text('cashier_id'),
  posProfileId:   text('pos_profile_id'),
  notes:          text('notes'),
  lineItems:      text('line_items').notNull().default('[]'),  // JSON array
  createdAt:      text('created_at').notNull().default(sql`(datetime('now'))`),
  synced:         integer('synced', { mode: 'boolean' }).notNull().default(false),
}, (t) => [
  index('idx_offline_sales_tenant').on(t.tenantId),
  index('idx_offline_sales_synced').on(t.tenantId, t.synced),
])

// ── Offline Mutation Queue (mirrors IndexedDB queue for Electron) ──────────────
export const offlineQueue = sqliteTable('_offline_queue', {
  id:        integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  tenantId:  text('tenant_id').notNull(),
  userId:    text('user_id').notNull(),
  method:    text('method').notNull(),      // GET/POST/PATCH/DELETE
  endpoint:  text('endpoint').notNull(),
  body:      text('body'),                  // JSON string
  headers:   text('headers'),              // JSON string
  entityType: text('entity_type'),
  entityId:  text('entity_id'),
  optimisticId: text('optimistic_id'),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch() * 1000)`),
  attempts:  integer('attempts').notNull().default(0),
  lastError: text('last_error'),
}, (t) => [
  index('idx_offline_queue_tenant').on(t.tenantId),
])

// ── Sync State ────────────────────────────────────────────────────────────────
export const offlineSyncState = sqliteTable('_offline_sync_state', {
  key:          text('key').primaryKey(),  // `${tenantId}:${entityType}`
  lastSyncedAt: integer('last_synced_at', { mode: 'number' }),
  etag:         text('etag'),
})

// ── Session cache (JWT validation without network) ────────────────────────────
export const offlineSessions = sqliteTable('_offline_sessions', {
  tenantId:     text('tenant_id').notNull(),
  userId:       text('user_id').notNull(),
  userRole:     text('user_role').notNull(),
  userEmail:    text('user_email').notNull(),
  userName:     text('user_name'),
  tenantName:   text('tenant_name'),
  businessType: text('business_type'),
  jwtHash:      text('jwt_hash').notNull(),
  expiresAt:    integer('expires_at', { mode: 'number' }).notNull(),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  uniqueIndex('idx_offline_sessions_pk').on(t.tenantId, t.userId),
])

// ── Schema version ────────────────────────────────────────────────────────────
export const offlineSchemaVersion = sqliteTable('_offline_schema_version', {
  version:   integer('version').primaryKey(),
  appliedAt: text('applied_at').notNull().default(sql`(datetime('now'))`),
})
