-- Patch 048: Shopping list assignment modes + per-technician self-create permission

DO $$ BEGIN
  CREATE TYPE shopping_list_assignment_mode AS ENUM ('unassigned', 'specific_technician', 'all_technicians');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS assignment_mode shopping_list_assignment_mode NOT NULL DEFAULT 'unassigned';

-- Backfill explicit mode for existing rows that already target a technician.
UPDATE shopping_lists
SET assignment_mode = 'specific_technician'
WHERE assigned_to IS NOT NULL
  AND assignment_mode = 'unassigned';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_create_own_shopping_lists BOOLEAN NOT NULL DEFAULT FALSE;
