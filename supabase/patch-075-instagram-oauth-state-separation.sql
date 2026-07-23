-- patch-075: Add tenant/platform OAuth state tables for Instagram
-- Idempotent schema patch for fully separated Instagram OAuth state handling.

-- Tenant OAuth state table for Instagram
CREATE TABLE IF NOT EXISTS instagram_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS instagram_oauth_states_state_hash_unique
  ON instagram_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS instagram_oauth_states_tenant_idx
  ON instagram_oauth_states (tenant_id);

CREATE INDEX IF NOT EXISTS instagram_oauth_states_expires_idx
  ON instagram_oauth_states (expires_at);

ALTER TABLE instagram_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_oauth_states_select ON instagram_oauth_states;
CREATE POLICY instagram_oauth_states_select ON instagram_oauth_states
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS instagram_oauth_states_insert ON instagram_oauth_states;
CREATE POLICY instagram_oauth_states_insert ON instagram_oauth_states
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS instagram_oauth_states_update ON instagram_oauth_states;
CREATE POLICY instagram_oauth_states_update ON instagram_oauth_states
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS instagram_oauth_states_delete ON instagram_oauth_states;
CREATE POLICY instagram_oauth_states_delete ON instagram_oauth_states
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

-- Platform OAuth state table for Instagram (superadmin-only workspace)
CREATE TABLE IF NOT EXISTS platform_instagram_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_instagram_oauth_states_state_hash_unique
  ON platform_instagram_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS platform_instagram_oauth_states_expires_idx
  ON platform_instagram_oauth_states (expires_at);

ALTER TABLE platform_instagram_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_instagram_oauth_states_super_admin ON platform_instagram_oauth_states;
CREATE POLICY platform_instagram_oauth_states_super_admin ON platform_instagram_oauth_states
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
