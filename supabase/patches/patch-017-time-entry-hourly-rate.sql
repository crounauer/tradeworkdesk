-- Patch 017: Add hourly_rate to job_time_entries for labour cost calculation
ALTER TABLE job_time_entries ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2);
