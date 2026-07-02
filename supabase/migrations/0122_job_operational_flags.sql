-- 0122_job_operational_flags.sql
-- Adds independent operational flags so jobs can be both in progress and awaiting parts.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_in_progress BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_awaiting_parts BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing single status values.
UPDATE jobs
SET is_in_progress = true
WHERE status = 'in_progress' AND COALESCE(is_in_progress, false) = false;

UPDATE jobs
SET is_awaiting_parts = true
WHERE status = 'awaiting_parts' AND COALESCE(is_awaiting_parts, false) = false;

CREATE INDEX IF NOT EXISTS idx_jobs_is_in_progress ON jobs (tenant_id, is_in_progress) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_is_awaiting_parts ON jobs (tenant_id, is_awaiting_parts) WHERE is_active = true;
