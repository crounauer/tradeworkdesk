-- Patch 029: Add can_be_assigned_jobs column to profiles
-- Controls whether a user appears in the "assign to technician" dropdowns on jobs.
-- Defaults to true for technicians, false for all other roles.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_be_assigned_jobs BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: existing technicians should be assignable
UPDATE profiles SET can_be_assigned_jobs = TRUE WHERE role = 'technician';
