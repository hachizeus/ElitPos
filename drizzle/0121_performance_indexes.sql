-- Performance indexes added by system audit (2026-08-27)
-- These cover the hot query paths identified in the API routes and reports.

-- =====================================================
-- WAREHOUSE_STOCK TABLE
-- Used in: /api/items, /api/sales, /api/dashboard/stats
-- =====================================================

-- Primary lookup: item+warehouse combo (most common join pattern)
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_item_warehouse
  ON warehouse_stock(item_id, warehouse_id);

-- All stock for a warehouse (used in stock-take, reports)
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse_id
  ON warehouse_stock(warehouse_id);

-- Tenant-scoped stock lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_tenant_id
  ON warehouse_stock(tenant_id);

-- Low-stock dashboard query: items where current_stock <= min_stock
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_low_stock
  ON warehouse_stock(tenant_id, item_id)
  WHERE (current_stock::numeric <= min_stock::numeric);

-- =====================================================
-- STOCK_MOVEMENTS TABLE
-- Used in: /api/items (stock history check), /api/reports/stock-movement
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id
  ON stock_movements(tenant_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id
  ON stock_movements(item_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created
  ON stock_movements(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse
  ON stock_movements(warehouse_id);

-- =====================================================
-- PAYMENTS TABLE
-- Used in: /api/reports/daily-sales, /api/reports/payment-collection
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id
  ON payments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id
  ON payments(sale_id);

-- Reports filter by tenant + non-voided payments
CREATE INDEX IF NOT EXISTS idx_payments_tenant_not_voided
  ON payments(tenant_id, sale_id)
  WHERE voided_at IS NULL;

-- =====================================================
-- TENANTS TABLE
-- Used in: middleware tenant lookup, auth JWT validation, layout cache
-- =====================================================

-- Slug lookup is on the absolute hot path (every request)
CREATE INDEX IF NOT EXISTS idx_tenants_slug
  ON tenants(slug)
  WHERE status = 'active';

-- Status filter used in auth validation
CREATE INDEX IF NOT EXISTS idx_tenants_status
  ON tenants(status);

-- =====================================================
-- SALES TABLE — additional indexes
-- =====================================================

-- Return lookups: finding returns against a specific original sale
CREATE INDEX IF NOT EXISTS idx_sales_return_against
  ON sales(return_against)
  WHERE is_return = true AND return_against IS NOT NULL;

-- Sales order linkage query in GET /api/sales
CREATE INDEX IF NOT EXISTS idx_sales_sales_order_id
  ON sales(sales_order_id)
  WHERE sales_order_id IS NOT NULL;

-- =====================================================
-- ACCOUNT_TENANTS TABLE
-- Used in: auth lookup, dashboard layout redirect
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_account_tenants_account_id
  ON account_tenants(account_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_account_tenants_tenant_id
  ON account_tenants(tenant_id)
  WHERE is_active = true;

-- =====================================================
-- ACCOUNTS TABLE
-- Used in: auth transfer flow, layout super-admin check
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_accounts_email
  ON accounts(email);

-- =====================================================
-- ROLE_PERMISSION_OVERRIDES TABLE
-- Used in: permission cache warm (every authenticated request)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_role_permission_overrides_tenant
  ON role_permission_overrides(tenant_id);

-- =====================================================
-- CUSTOM_ROLES TABLE
-- Used in: permission cache warm (every authenticated request)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_custom_roles_tenant
  ON custom_roles(tenant_id);

-- =====================================================
-- PURCHASES TABLE
-- Used in: /api/reports/tax-report, purchase summary
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_purchases_tenant_created
  ON purchases(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_tenant_status
  ON purchases(tenant_id, status);

SELECT 'Performance indexes created successfully!' AS result;
