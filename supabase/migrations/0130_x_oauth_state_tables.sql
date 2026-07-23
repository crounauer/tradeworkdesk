-- 0130_x_oauth_state_tables.sql
-- Ensure X OAuth state tables and RLS policies exist for tenant and platform scopes.

CREATE TABLE IF NOT EXISTS x_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE x_oauth_states
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS state_hash TEXT,
  ADD COLUMN IF NOT EXISTS code_verifier TEXT,
  ADD COLUMN IF NOT EXISTS return_path TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE x_oauth_states
  ALTER COLUMN return_path SET DEFAULT '/admin/social?tab=accounts',
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS x_oauth_states_state_hash_unique
  ON x_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS x_oauth_states_tenant_idx
  ON x_oauth_states (tenant_id);

CREATE INDEX IF NOT EXISTS x_oauth_states_expires_idx
  ON x_oauth_states (expires_at);

ALTER TABLE x_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS x_oauth_states_select ON x_oauth_states;
CREATE POLICY x_oauth_states_select ON x_oauth_states
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS x_oauth_states_insert ON x_oauth_states;
CREATE POLICY x_oauth_states_insert ON x_oauth_states
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS x_oauth_states_update ON x_oauth_states;
CREATE POLICY x_oauth_states_update ON x_oauth_states
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS x_oauth_states_delete ON x_oauth_states;
CREATE POLICY x_oauth_states_delete ON x_oauth_states
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

CREATE TABLE IF NOT EXISTS platform_x_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_x_oauth_states
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS state_hash TEXT,
  ADD COLUMN IF NOT EXISTS code_verifier TEXT,
  ADD COLUMN IF NOT EXISTS return_path TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE platform_x_oauth_states
  ALTER COLUMN return_path SET DEFAULT '/admin/social?tab=accounts',
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS platform_x_oauth_states_state_hash_unique
  ON platform_x_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS platform_x_oauth_states_expires_idx
  ON platform_x_oauth_states (expires_at);

ALTER TABLE platform_x_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_x_oauth_states_super_admin ON platform_x_oauth_states;
CREATE POLICY platform_x_oauth_states_super_admin ON platform_x_oauth_states
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
