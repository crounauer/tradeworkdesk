-- Patch 020: Create job_completion_reports table (missing from initial migration)

CREATE TABLE IF NOT EXISTS job_completion_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_completed TEXT,
  parts_fitted TEXT,
  parts_serial_numbers TEXT,
  outstanding_items TEXT,
  defects_found TEXT,
  advisories TEXT,
  customer_advised BOOLEAN DEFAULT FALSE,
  customer_sign_off BOOLEAN DEFAULT FALSE,
  customer_name_signed TEXT,
  next_service_date TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_completion_reports_job_id ON job_completion_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reports_tenant ON job_completion_reports(tenant_id);

ALTER TABLE job_completion_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_completion_reports_tenant" ON job_completion_reports;
CREATE POLICY "job_completion_reports_tenant" ON job_completion_reports FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);
