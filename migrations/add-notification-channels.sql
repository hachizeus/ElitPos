-- Add email and SMS delivery tracking to account_notifications
ALTER TABLE account_notifications
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_error TEXT,
ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sms_error TEXT;

COMMENT ON COLUMN account_notifications.email_sent IS 'Whether email notification was successfully sent';
COMMENT ON COLUMN account_notifications.sms_sent IS 'Whether SMS notification was successfully sent';
