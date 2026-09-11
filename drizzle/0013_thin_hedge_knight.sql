DO $$ BEGIN
  CREATE TYPE "public"."customer_business_type" AS ENUM('individual', 'company');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."customer_type" AS ENUM('retail', 'wholesale', 'vip');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."part_condition" AS ENUM('new', 'refurbished', 'used');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."pending_company_status" AS ENUM('pending_payment', 'pending_approval', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."stock_transfer_status" AS ENUM('draft', 'pending_approval', 'approved', 'in_transit', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"link" varchar(500),
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"payment_deposit_id" uuid,
	"subscription_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"business_type" "business_type" NOT NULL,
	"country" varchar(2) NOT NULL,
	"date_format" varchar(20) NOT NULL,
	"time_format" varchar(10) NOT NULL,
	"tier_id" uuid NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
	"status" "pending_company_status" DEFAULT 'pending_payment' NOT NULL,
	"payment_deposit_id" uuid,
	"expires_at" timestamp NOT NULL,
	"admin_notes" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pos_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"received_quantity" numeric(12, 3),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transfer_no" varchar(50) NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"status" "stock_transfer_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"requested_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp,
	"shipped_at" timestamp,
	"shipped_by" uuid,
	"received_at" timestamp,
	"received_by" uuid,
	"cancellation_reason" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"last_login_ip" varchar(45),
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "super_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb DEFAULT '{}' NOT NULL,
	"description" text,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouse_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"current_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"min_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"reorder_qty" numeric(12, 3),
	"bin_location" varchar(50),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" DROP CONSTRAINT "admin_sessions_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "country" varchar(2) DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "language" varchar(10) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "timezone" varchar(50) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "date_format" varchar(20) DEFAULT 'MM/DD/YYYY' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "theme" varchar(20) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "notify_billing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "notify_security" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "notify_marketing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "wallet_balance" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "deactivation_reason" text;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN IF NOT EXISTS "super_admin_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "first_name" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_name" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company_name" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "mobile_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "alternate_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address_line_1" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address_line_2" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "city" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "state" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "postal_code" varchar(20);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "country" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "use_same_billing_address" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_address_line_1" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_address_line_2" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_city" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_state" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_postal_code" varchar(20);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_country" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tax_exempt" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_type" "customer_business_type" DEFAULT 'individual';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_terms" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "default_payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "customer_type" "customer_type" DEFAULT 'retail';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "referral_source" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "marketing_opt_in" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "birthday" date;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "special_instructions" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "driver_license_number" varchar(50);--> statement-breakpoint
ALTER TABLE "held_sales" ADD COLUMN IF NOT EXISTS "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "insurance_estimates" ADD COLUMN IF NOT EXISTS "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "oem_part_number" varchar(100);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "alternate_part_numbers" jsonb;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "brand" varchar(100);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "condition" "part_condition" DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "supplier_part_number" varchar(100);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "lead_time_days" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "dimensions" varchar(50);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "warranty_months" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "image_url" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "superseded_by" uuid;--> statement-breakpoint
ALTER TABLE "payment_deposits" ADD COLUMN IF NOT EXISTS "is_wallet_deposit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_deposits" ADD COLUMN IF NOT EXISTS "pending_company_id" uuid;--> statement-breakpoint
ALTER TABLE "pricing_tiers" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "country" varchar(2) DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "date_format" varchar(20) DEFAULT 'DD/MM/YYYY' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "time_format" varchar(10) DEFAULT '12h' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "warehouse_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "account_notifications" ADD CONSTRAINT "account_notifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_payment_deposit_id_payment_deposits_id_fk" FOREIGN KEY ("payment_deposit_id") REFERENCES "public"."payment_deposits"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pending_companies" ADD CONSTRAINT "pending_companies_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pending_companies" ADD CONSTRAINT "pending_companies_tier_id_pricing_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."pricing_tiers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_profiles" ADD CONSTRAINT "pos_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_profiles" ADD CONSTRAINT "pos_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_profiles" ADD CONSTRAINT "pos_profiles_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_shipped_by_users_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_accounts_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_super_admin_id_super_admins_id_fk" FOREIGN KEY ("super_admin_id") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "held_sales" ADD CONSTRAINT "held_sales_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "insurance_estimates" ADD CONSTRAINT "insurance_estimates_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchases" ADD CONSTRAINT "purchases_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "admin_sessions" DROP COLUMN IF EXISTS "account_id";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN IF EXISTS "current_stock";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN IF EXISTS "min_stock";