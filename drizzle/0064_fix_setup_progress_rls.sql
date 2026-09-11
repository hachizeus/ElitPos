-- Fix setup_progress RLS policy to use app.tenant_id (consistent with all other tables)
-- The old policy used app.account_id which is never set by withTenant/withAuthTenant helpers

DROP POLICY IF EXISTS tenant_access_policy ON setup_progress;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_policy ON setup_progress
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::UUID)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
