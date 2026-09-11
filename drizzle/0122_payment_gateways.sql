-- ============================================================
-- Migration 0122: Payment Gateway Integration
-- Adds per-tenant gateway config table and unified transaction log
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE "gateway_transaction_status" AS ENUM (
    'pending', 'processing', 'success', 'failed', 'cancelled', 'expired', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payment_gateway" AS ENUM (
    'mpesa', 'stripe', 'paystack', 'payhero'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "gateway_context" AS ENUM (
    'subscription', 'pos_sale'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-tenant payment gateway configuration
CREATE TABLE IF NOT EXISTS "payment_gateway_configs" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,

  -- M-Pesa Daraja
  "mpesa_enabled"            boolean NOT NULL DEFAULT false,
  "mpesa_environment"        varchar(20) DEFAULT 'sandbox',
  "mpesa_consumer_key"       text,
  "mpesa_consumer_secret"    text,
  "mpesa_shortcode"          varchar(20),
  "mpesa_passkey"            text,
  "mpesa_callback_base_url"  text,

  -- Stripe
  "stripe_enabled"           boolean NOT NULL DEFAULT false,
  "stripe_publishable_key"   text,
  "stripe_secret_key"        text,
  "stripe_webhook_secret"    text,
  "stripe_currency"          varchar(3) DEFAULT 'KES',

  -- Paystack
  "paystack_enabled"         boolean NOT NULL DEFAULT false,
  "paystack_public_key"      text,
  "paystack_secret_key"      text,
  "paystack_webhook_secret"  text,
  "paystack_currency"        varchar(3) DEFAULT 'KES',

  -- PayHero
  "payhero_enabled"          boolean NOT NULL DEFAULT false,
  "payhero_api_username"     text,
  "payhero_api_password"     text,
  "payhero_channel_id"       varchar(50),

  "created_at"               timestamp DEFAULT now() NOT NULL,
  "updated_at"               timestamp DEFAULT now() NOT NULL,

  CONSTRAINT "payment_gateway_configs_tenant_id_unique" UNIQUE ("tenant_id")
);

-- Unified gateway transaction log
CREATE TABLE IF NOT EXISTS "gateway_transactions" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"            uuid REFERENCES "tenants"("id"),
  "account_id"           uuid REFERENCES "accounts"("id"),

  "context"              "gateway_context" NOT NULL,
  "sale_id"              uuid REFERENCES "sales"("id"),
  "subscription_id"      uuid REFERENCES "subscriptions"("id"),

  "gateway"              "payment_gateway" NOT NULL,
  "gateway_reference"    varchar(255),
  "internal_reference"   varchar(100) NOT NULL,

  "amount"               decimal(12,2) NOT NULL,
  "currency"             varchar(3) NOT NULL DEFAULT 'KES',

  "status"               "gateway_transaction_status" NOT NULL DEFAULT 'pending',

  "customer_phone"       varchar(30),
  "customer_email"       varchar(255),
  "customer_name"        varchar(255),

  "metadata"             jsonb,

  "initiated_at"         timestamp DEFAULT now() NOT NULL,
  "completed_at"         timestamp,
  "expires_at"           timestamp,
  "created_at"           timestamp DEFAULT now() NOT NULL,
  "updated_at"           timestamp DEFAULT now() NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS "idx_gateway_transactions_tenant"      ON "gateway_transactions"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_gateway_transactions_reference"   ON "gateway_transactions"("internal_reference");
CREATE INDEX IF NOT EXISTS "idx_gateway_transactions_gateway_ref" ON "gateway_transactions"("gateway_reference");
CREATE INDEX IF NOT EXISTS "idx_gateway_transactions_status"      ON "gateway_transactions"("status");
CREATE INDEX IF NOT EXISTS "idx_gateway_transactions_sale"        ON "gateway_transactions"("sale_id");
CREATE INDEX IF NOT EXISTS "idx_gateway_transactions_subscription" ON "gateway_transactions"("subscription_id");
