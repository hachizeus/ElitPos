-- Add SMS notification preference to accounts table
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "notify_sms" boolean DEFAULT true NOT NULL;
