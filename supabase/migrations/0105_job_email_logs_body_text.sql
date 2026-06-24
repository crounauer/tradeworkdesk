-- Migration 0105: Store email body text in job_email_logs for UI display

ALTER TABLE IF EXISTS public.job_email_logs
  ADD COLUMN IF NOT EXISTS body_text TEXT;
