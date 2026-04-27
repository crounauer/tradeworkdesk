-- Patch 022: Add callout_fee to job_time_entries for per-entry independent callout billing
-- Each time entry now stores its own callout fee amount so that different visits on the same job
-- can each carry their own call-out charge independently.
ALTER TABLE job_time_entries ADD COLUMN IF NOT EXISTS callout_fee NUMERIC(10,2);
