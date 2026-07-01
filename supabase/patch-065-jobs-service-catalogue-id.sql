-- Phase 1: add service_catalogue_id to jobs for dual-write migration away from job_types
BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS service_catalogue_id UUID REFERENCES service_catalogue(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_service_catalogue
  ON jobs (tenant_id, service_catalogue_id);

COMMIT;
