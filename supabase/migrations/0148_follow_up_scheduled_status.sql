-- Add job_status value used when a follow-up has been converted into a new scheduled job.
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'follow_up_scheduled';
