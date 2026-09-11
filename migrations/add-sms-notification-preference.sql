-- Add SMS notification preference to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT true NOT NULL;

-- Update existing accounts to have SMS notifications enabled by default
UPDATE accounts SET notify_sms = true WHERE notify_sms IS NULL;
