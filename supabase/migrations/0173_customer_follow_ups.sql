-- Allow a follow-up to be recorded before a related job exists.
ALTER TABLE follow_ups ALTER COLUMN original_job_id DROP NOT NULL;
