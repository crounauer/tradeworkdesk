-- Fix: company_settings unique constraint was on singleton_id alone.
-- After tenant_id was added, the constraint should be on (singleton_id, tenant_id)
-- so each tenant can have their own settings row.

ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS company_settings_singleton;

DO $$ BEGIN
  ALTER TABLE company_settings
    ADD CONSTRAINT company_settings_singleton UNIQUE (singleton_id, tenant_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
