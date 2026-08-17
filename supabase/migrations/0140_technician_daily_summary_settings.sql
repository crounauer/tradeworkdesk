-- Migration 0140: technician daily summary email settings
-- Adds per-tenant controls for next-day technician job summary emails.

ALTER TABLE IF EXISTS public.company_settings
  ADD COLUMN IF NOT EXISTS technician_daily_summary_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS technician_daily_summary_time_utc VARCHAR(5) NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS technician_daily_summary_send_if_no_jobs BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS technician_daily_summary_weekdays_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS technician_daily_summary_last_sent_date DATE NULL;

COMMENT ON COLUMN public.company_settings.technician_daily_summary_enabled IS
  'When true, send each technician a summary email of jobs scheduled for tomorrow.';

COMMENT ON COLUMN public.company_settings.technician_daily_summary_time_utc IS
  'UK local time (Europe/London) in HH:mm format for dispatching technician next-day summaries.';

COMMENT ON COLUMN public.company_settings.technician_daily_summary_send_if_no_jobs IS
  'When true, technicians receive an email even when they have no jobs for tomorrow.';

COMMENT ON COLUMN public.company_settings.technician_daily_summary_weekdays_only IS
  'When true, summaries are not sent for Saturdays or Sundays.';

COMMENT ON COLUMN public.company_settings.technician_daily_summary_last_sent_date IS
  'UK local date (Europe/London) of the most recent successful dispatch for this tenant.';
