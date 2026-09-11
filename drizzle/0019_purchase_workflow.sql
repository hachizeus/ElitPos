-- Migration: Purchase Order / Invoice Workflow Improvements

-- Step 1: Add new columns to purchases table
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "supplier_invoice_no" varchar(100);
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "supplier_bill_date" date;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "payment_term" varchar(20) DEFAULT 'cash';

-- Step 2: Remove columns from purchase_orders
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "supplier_invoice_no";
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "supplier_bill_date";

-- Step 3: Add new enum values (must be committed before they can be used in UPDATE)
DO $$ BEGIN
  ALTER TYPE "purchase_order_status" ADD VALUE IF NOT EXISTS 'submitted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "purchase_order_status" ADD VALUE IF NOT EXISTS 'confirmed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "purchase_order_status" ADD VALUE IF NOT EXISTS 'invoice_created';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
