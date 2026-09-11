ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "supplier_invoice_no" varchar(100);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "supplier_bill_date" date;