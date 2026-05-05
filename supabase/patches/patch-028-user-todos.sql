-- Patch 028: Personal to-do list for individual users
-- Each user has their own private list, scoped by user_id (not shared with team).
-- The feature is gated behind the "todo_list" plan feature key.

-- -------------------------------------------------------------------------
-- Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_todos_user_id ON user_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_todos_tenant_id ON user_todos(tenant_id);

-- -------------------------------------------------------------------------
-- Row-Level Security
-- -------------------------------------------------------------------------
ALTER TABLE user_todos ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own todos.
DROP POLICY IF EXISTS "user_todos_own" ON user_todos;
CREATE POLICY "user_todos_own" ON user_todos FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admins bypass all restrictions.
DROP POLICY IF EXISTS "user_todos_super_admin" ON user_todos;
CREATE POLICY "user_todos_super_admin" ON user_todos FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- -------------------------------------------------------------------------
-- updated_at auto-update trigger
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_user_todos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_todos_updated_at ON user_todos;
CREATE TRIGGER trg_user_todos_updated_at
  BEFORE UPDATE ON user_todos
  FOR EACH ROW EXECUTE FUNCTION set_user_todos_updated_at();

-- -------------------------------------------------------------------------
-- Add todo_list feature flag to existing plans
-- -------------------------------------------------------------------------
UPDATE plans
SET features = features || '{"todo_list": false}'::jsonb
WHERE name = 'Forms Only' AND features IS NOT NULL;

UPDATE plans
SET features = features || '{"todo_list": true}'::jsonb
WHERE name IN ('Starter', 'Professional', 'Enterprise') AND features IS NOT NULL;

-- -------------------------------------------------------------------------
-- Register the To-Do List as a purchasable addon
-- -------------------------------------------------------------------------
INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order)
SELECT
  'To-Do List',
  'Personal per-user to-do list. Each team member gets their own private task list to track what they need to do.',
  ARRAY['todo_list'],
  0.99,
  9.99,
  false,
  14
WHERE NOT EXISTS (
  SELECT 1 FROM addons WHERE name = 'To-Do List'
);
