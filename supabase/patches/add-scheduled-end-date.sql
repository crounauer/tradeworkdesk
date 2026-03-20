-- Patch: Add scheduled_end_date to jobs table
-- Run this in the Supabase SQL Editor to support multi-day jobs.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;

DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT chk_job_end_date
    CHECK (scheduled_end_date IS NULL OR scheduled_end_date >= scheduled_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_end ON jobs(scheduled_end_date)
  WHERE scheduled_end_date IS NOT NULL;
