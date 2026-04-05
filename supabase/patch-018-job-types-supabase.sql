-- Patch 018: Create job_types table in Supabase
-- Migrates job_types from Replit heliumdb/Drizzle to Supabase

CREATE TABLE IF NOT EXISTS job_types (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'service',
  color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
  default_duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_types_tenant_id ON job_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_types_tenant_active ON job_types(tenant_id, is_active);

ALTER TABLE job_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_types' AND policyname = 'job_types_tenant'
  ) THEN
    CREATE POLICY job_types_tenant ON job_types FOR ALL TO authenticated
      USING (
        tenant_id = get_user_tenant_id(auth.uid())
        OR get_user_role(auth.uid()) = 'super_admin'
      ) WITH CHECK (
        tenant_id = get_user_tenant_id(auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_types' AND policyname = 'job_types_service_role_all'
  ) THEN
    CREATE POLICY job_types_service_role_all ON job_types
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
