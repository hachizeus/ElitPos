-- ============================================================
-- ElitPOS — Seed Menu Items for Elitjohns Digital Agency
-- Tenant   : 7b71713d-40bb-4691-9945-ceec2e90c2d6
-- Warehouse : 2b122629-01f5-4da7-a099-52b4fb6d8945 (Main Warehouse)
-- Owner UID : 63e9b71c-fdc3-4cf3-9309-132a66f72fc9
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. ITEMS  (no min_stock column — lives in warehouse_stock)
-- ─────────────────────────────────────────────────────────────
INSERT INTO items (
  id, tenant_id, name, sku, barcode,
  category_id, cost_price, selling_price, valuation_rate,
  unit, track_stock, is_active,
  track_batches, track_serial_numbers, is_gift_card,
  is_vegetarian, is_vegan, is_gluten_free,
  created_at, updated_at
) VALUES

-- 1) Grilled Chicken  — Main Course
(
  'a1000001-0000-0000-0000-000000000001',
  '7b71713d-40bb-4691-9945-ceec2e90c2d6',
  'Grilled Chicken', 'GC001', 'GC001',
  '38c15b27-a6c3-419d-90d0-7a3f9bde14a7',
  320.00, 850.00, 320.00,
  'pcs', true, true,
  false, false, false,
  false, false, false,
  NOW(), NOW()
),

-- 2) Beef Burger  — Main Course
(
  'a1000001-0000-0000-0000-000000000002',
  '7b71713d-40bb-4691-9945-ceec2e90c2d6',
  'Beef Burger', 'BB001', 'BB001',
  '38c15b27-a6c3-419d-90d0-7a3f9bde14a7',
  210.00, 650.00, 210.00,
  'pcs', true, true,
  false, false, false,
  false, false, false,
  NOW(), NOW()
),

-- 3) Chips  — Appetizers
(
  'a1000001-0000-0000-0000-000000000003',
  '7b71713d-40bb-4691-9945-ceec2e90c2d6',
  'Chips', 'CH001', 'CH001',
  '59dd95d1-290d-4dd2-87b1-04f82020f6d8',
  60.00, 250.00, 60.00,
  'pcs', true, true,
  false, false, false,
  true, true, true,
  NOW(), NOW()
),

-- 4) Caesar Salad  — Soups & Salads
(
  'a1000001-0000-0000-0000-000000000004',
  '7b71713d-40bb-4691-9945-ceec2e90c2d6',
  'Caesar Salad', 'CS001', 'CS001',
  'a0528764-b6a2-45cb-b632-204b41214a5f',
  120.00, 450.00, 120.00,
  'pcs', true, true,
  false, false, false,
  true, false, false,
  NOW(), NOW()
),

-- 5) Cappuccino  — Hot Beverages
(
  'a1000001-0000-0000-0000-000000000005',
  '7b71713d-40bb-4691-9945-ceec2e90c2d6',
  'Cappuccino', 'CAP001', 'CAP001',
  '2ea9b63c-a465-4d47-84c4-fb5b0d94b2c7',
  80.00, 280.00, 80.00,
  'cup', true, true,
  false, false, false,
  true, true, false,
  NOW(), NOW()
),

-- 6) Mango Juice  — Cold Beverages
(
  'a1000001-0000-0000-0000-000000000006',
  '7b71713d-40bb-4691-9945-ceec2e90c2d6',
  'Mango Juice', 'MJ001', 'MJ001',
  '272d1d6c-122f-4410-a446-be81a545a13d',
  50.00, 200.00, 50.00,
  'glass', true, true,
  false, false, false,
  true, true, true,
  NOW(), NOW()
),

-- 7) Chocolate Cake  — Desserts
(
  'a1000001-0000-0000-0000-000000000007',
  '7b71713d-40bb-4691-9945-ceec2e90c2d6',
  'Chocolate Cake', 'CC001', 'CC001',
  'a9ddaeb1-5a66-4a61-b0ec-774ff60b7f06',
  90.00, 350.00, 90.00,
  'slice', true, true,
  false, false, false,
  true, false, false,
  NOW(), NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. WAREHOUSE STOCK
--    current_stock = opening qty | min_stock = reorder level
-- ─────────────────────────────────────────────────────────────
INSERT INTO warehouse_stock (
  id, tenant_id, warehouse_id, item_id,
  current_stock, min_stock, reorder_qty,
  reserved_stock, updated_at
) VALUES
-- Grilled Chicken  : 20 units, reorder at 5
('b1000001-0000-0000-0000-000000000001',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'a1000001-0000-0000-0000-000000000001',
 20, 5, 10, 0, NOW()),

-- Beef Burger      : 15 units, reorder at 3
('b1000001-0000-0000-0000-000000000002',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'a1000001-0000-0000-0000-000000000002',
 15, 3, 10, 0, NOW()),

-- Chips            : 30 units, reorder at 5
('b1000001-0000-0000-0000-000000000003',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'a1000001-0000-0000-0000-000000000003',
 30, 5, 20, 0, NOW()),

-- Caesar Salad     : 10 units, reorder at 2
('b1000001-0000-0000-0000-000000000004',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'a1000001-0000-0000-0000-000000000004',
 10, 2, 5, 0, NOW()),

-- Cappuccino       : 50 units, reorder at 5
('b1000001-0000-0000-0000-000000000005',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'a1000001-0000-0000-0000-000000000005',
 50, 5, 20, 0, NOW()),

-- Mango Juice      : 40 units, reorder at 5
('b1000001-0000-0000-0000-000000000006',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'a1000001-0000-0000-0000-000000000006',
 40, 5, 20, 0, NOW()),

-- Chocolate Cake   : 12 units, reorder at 2
('b1000001-0000-0000-0000-000000000007',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'a1000001-0000-0000-0000-000000000007',
 12, 2, 5, 0, NOW());

-- ─────────────────────────────────────────────────────────────
-- 3. STOCK MOVEMENTS  (opening stock entries)
--    type = 'in' | reference_type = 'opening'
-- ─────────────────────────────────────────────────────────────
INSERT INTO stock_movements (
  id, tenant_id, item_id, warehouse_id,
  type, quantity,
  reference_type, reference_id,
  notes, created_by, created_at
) VALUES
('c1000001-0000-0000-0000-000000000001',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 'a1000001-0000-0000-0000-000000000001',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'in', 20, 'opening', NULL,
 'Opening stock', '63e9b71c-fdc3-4cf3-9309-132a66f72fc9', NOW()),

('c1000001-0000-0000-0000-000000000002',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 'a1000001-0000-0000-0000-000000000002',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'in', 15, 'opening', NULL,
 'Opening stock', '63e9b71c-fdc3-4cf3-9309-132a66f72fc9', NOW()),

('c1000001-0000-0000-0000-000000000003',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 'a1000001-0000-0000-0000-000000000003',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'in', 30, 'opening', NULL,
 'Opening stock', '63e9b71c-fdc3-4cf3-9309-132a66f72fc9', NOW()),

('c1000001-0000-0000-0000-000000000004',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 'a1000001-0000-0000-0000-000000000004',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'in', 10, 'opening', NULL,
 'Opening stock', '63e9b71c-fdc3-4cf3-9309-132a66f72fc9', NOW()),

('c1000001-0000-0000-0000-000000000005',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 'a1000001-0000-0000-0000-000000000005',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'in', 50, 'opening', NULL,
 'Opening stock', '63e9b71c-fdc3-4cf3-9309-132a66f72fc9', NOW()),

('c1000001-0000-0000-0000-000000000006',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 'a1000001-0000-0000-0000-000000000006',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'in', 40, 'opening', NULL,
 'Opening stock', '63e9b71c-fdc3-4cf3-9309-132a66f72fc9', NOW()),

('c1000001-0000-0000-0000-000000000007',
 '7b71713d-40bb-4691-9945-ceec2e90c2d6',
 'a1000001-0000-0000-0000-000000000007',
 '2b122629-01f5-4da7-a099-52b4fb6d8945',
 'in', 12, 'opening', NULL,
 'Opening stock', '63e9b71c-fdc3-4cf3-9309-132a66f72fc9', NOW());

COMMIT;
