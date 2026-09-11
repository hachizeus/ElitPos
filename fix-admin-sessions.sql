-- Fix admin_sessions migration issue
-- The constraint is trying to be added but account_id column doesn't exist anymore

-- Drop the constraint if it exists (it shouldn't, but just in case)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_sessions_account_id_accounts_id_fk'
    ) THEN
        ALTER TABLE admin_sessions DROP CONSTRAINT admin_sessions_account_id_accounts_id_fk;
        RAISE NOTICE 'Dropped existing constraint admin_sessions_account_id_accounts_id_fk';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_sessions' 
ORDER BY ordinal_position;
