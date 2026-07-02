-- DHW Cylinder Commissioning Record table

CREATE TABLE IF NOT EXISTS dhw_cylinder_commissioning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  engineer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  form_status TEXT NOT NULL DEFAULT 'draft',
  jurisdiction TEXT,
  cylinder_type TEXT,

  installation_type JSONB NOT NULL DEFAULT '{}'::jsonb,
  cylinder_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_controls JSONB NOT NULL DEFAULT '{}'::jsonb,
  expansion_cold_inlet JSONB NOT NULL DEFAULT '{}'::jsonb,
  discharge_pipework JSONB NOT NULL DEFAULT '{}'::jsonb,
  temperature_readings JSONB NOT NULL DEFAULT '{}'::jsonb,
  functional_tests JSONB NOT NULL DEFAULT '{}'::jsonb,
  defects JSONB NOT NULL DEFAULT '{}'::jsonb,

  final_status TEXT,
  engineer_signature_data TEXT,
  customer_signature_data TEXT,
  photo_uploads JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT,

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked BOOLEAN NOT NULL DEFAULT false,
  audit_log JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dhw_cylinder_commissioning_job_unique
  ON dhw_cylinder_commissioning_records(job_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_dhw_cylinder_commissioning_job
  ON dhw_cylinder_commissioning_records(job_id);

CREATE INDEX IF NOT EXISTS idx_dhw_cylinder_commissioning_tenant
  ON dhw_cylinder_commissioning_records(tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_dhw_cylinder_commissioning_records'
      AND tgrelid = 'dhw_cylinder_commissioning_records'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_dhw_cylinder_commissioning_records
      BEFORE UPDATE ON dhw_cylinder_commissioning_records
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE dhw_cylinder_commissioning_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dhw_cylinder_commissioning_records_tenant" ON dhw_cylinder_commissioning_records;

CREATE POLICY "dhw_cylinder_commissioning_records_tenant"
  ON dhw_cylinder_commissioning_records
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );
