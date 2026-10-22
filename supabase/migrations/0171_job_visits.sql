-- The original jobs schedule remains the primary visit; additional dates live here.
CREATE TABLE IF NOT EXISTS job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_duration INTEGER,
  assigned_technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_visits_schedule_valid CHECK (
    (all_day AND scheduled_time IS NULL AND estimated_duration IS NULL)
    OR (NOT all_day AND scheduled_time IS NOT NULL AND estimated_duration IS NOT NULL AND estimated_duration > 0)
  )
);

CREATE INDEX IF NOT EXISTS job_visits_job ON job_visits (tenant_id, job_id, scheduled_date);
CREATE INDEX IF NOT EXISTS job_visits_engineer ON job_visits (tenant_id, assigned_technician_id, scheduled_date);
ALTER TABLE job_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_visits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_visits TO service_role;

-- Scheduling queries use the service role with explicit tenant/engineer filters.
-- No client grants: job/visit ownership is enforced by the API.
CREATE OR REPLACE VIEW job_schedule_entries AS
SELECT id, id AS job_id, tenant_id, job_ref, scheduled_date, scheduled_end_date,
       scheduled_time, all_day, estimated_duration, assigned_technician_id, status, is_active
FROM jobs
UNION ALL
SELECT v.id, j.id AS job_id, v.tenant_id, j.job_ref, v.scheduled_date, NULL::DATE,
       v.scheduled_time, v.all_day, v.estimated_duration, v.assigned_technician_id, j.status, j.is_active
FROM job_visits v JOIN jobs j ON j.id = v.job_id AND j.tenant_id = v.tenant_id;

REVOKE ALL ON job_schedule_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON job_schedule_entries TO service_role;
