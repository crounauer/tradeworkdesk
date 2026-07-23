-- patch-074: Add tenant/platform OAuth state tables for X and Google Business
-- Idempotent schema patch for fully separated OAuth state handling.

-- Tenant OAuth state table for X OAuth2
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
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
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

-- Platform OAuth state table for X OAuth2 (superadmin-only workspace)
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

-- Tenant OAuth state table for Google Business
CREATE TABLE IF NOT EXISTS google_business_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS google_business_oauth_states_state_hash_unique
  ON google_business_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS google_business_oauth_states_tenant_idx
  ON google_business_oauth_states (tenant_id);

CREATE INDEX IF NOT EXISTS google_business_oauth_states_expires_idx
  ON google_business_oauth_states (expires_at);

ALTER TABLE google_business_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_business_oauth_states_select ON google_business_oauth_states;
CREATE POLICY google_business_oauth_states_select ON google_business_oauth_states
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS google_business_oauth_states_insert ON google_business_oauth_states;
CREATE POLICY google_business_oauth_states_insert ON google_business_oauth_states
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS google_business_oauth_states_update ON google_business_oauth_states;
CREATE POLICY google_business_oauth_states_update ON google_business_oauth_states
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS google_business_oauth_states_delete ON google_business_oauth_states;
CREATE POLICY google_business_oauth_states_delete ON google_business_oauth_states
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

-- Platform OAuth state table for Google Business (superadmin-only workspace)
CREATE TABLE IF NOT EXISTS platform_google_business_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_google_business_oauth_states_state_hash_unique
  ON platform_google_business_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS platform_google_business_oauth_states_expires_idx
  ON platform_google_business_oauth_states (expires_at);

ALTER TABLE platform_google_business_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_google_business_oauth_states_super_admin ON platform_google_business_oauth_states;
CREATE POLICY platform_google_business_oauth_states_super_admin ON platform_google_business_oauth_states
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
