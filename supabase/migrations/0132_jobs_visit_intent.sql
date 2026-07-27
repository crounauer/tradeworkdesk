-- Migration 0132: First-class visit intent for jobs
-- Adds an explicit field to distinguish estimate visits from standard jobs.

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS visit_intent TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_visit_intent_check'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_visit_intent_check
      CHECK (visit_intent IN ('standard', 'estimate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_visit_intent
  ON public.jobs (tenant_id, visit_intent)
  WHERE is_active = true;
