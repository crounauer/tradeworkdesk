-- Patch 033: Add status column to job_parts
-- Allows parts to be marked as 'fitted' (used/installed) or 'to_order' (needs sourcing)

ALTER TABLE job_parts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'fitted'
  CHECK (status IN ('fitted', 'to_order'));
