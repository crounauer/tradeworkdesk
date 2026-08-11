-- Migration 0137: Add an explicit all-day flag to jobs
-- This keeps all-day bookings from being silently downgraded to the default service duration.

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_all_day
  ON public.jobs (tenant_id, all_day)
  WHERE is_active = true;
