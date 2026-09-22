CREATE TABLE IF NOT EXISTS job_appliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, appliance_id)
);

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS appliance_id UUID REFERENCES appliances(id) ON DELETE SET NULL;

INSERT INTO job_appliances (tenant_id, job_id, appliance_id)
SELECT j.tenant_id, j.id, j.appliance_id
FROM jobs j
WHERE j.appliance_id IS NOT NULL
ON CONFLICT (job_id, appliance_id) DO NOTHING;

UPDATE service_records sr
SET appliance_id = j.appliance_id
FROM jobs j
WHERE sr.job_id = j.id
  AND sr.appliance_id IS NULL
  AND j.appliance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_appliances_tenant_job
  ON job_appliances (tenant_id, job_id);

CREATE INDEX IF NOT EXISTS idx_job_appliances_appliance
  ON job_appliances (appliance_id);

CREATE INDEX IF NOT EXISTS idx_service_records_job_appliance
  ON service_records (job_id, appliance_id);