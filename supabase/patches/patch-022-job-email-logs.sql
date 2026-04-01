-- Patch 022: Create job_email_logs table for tracking emailed forms

CREATE TABLE IF NOT EXISTS job_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sent_by UUID NOT NULL REFERENCES profiles(id),
  sent_to TEXT NOT NULL,
  cc TEXT,
  subject TEXT NOT NULL,
  forms_included JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_email_logs_job_id ON job_email_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_email_logs_tenant ON job_email_logs(tenant_id);
ALTER TABLE job_email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_email_logs_tenant" ON job_email_logs;
CREATE POLICY "job_email_logs_tenant" ON job_email_logs FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);
