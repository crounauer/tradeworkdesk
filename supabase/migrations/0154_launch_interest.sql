-- Migration 0154: Capture public launch interest while registrations remain invite-only.

CREATE TABLE IF NOT EXISTS launch_interest (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  business_name TEXT,
  phone         TEXT,
  trade         TEXT,
  notified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_launch_interest_unnotified
  ON launch_interest(created_at DESC)
  WHERE notified_at IS NULL;

ALTER TABLE launch_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "launch_interest_super_admin" ON launch_interest;
CREATE POLICY "launch_interest_super_admin" ON launch_interest
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
