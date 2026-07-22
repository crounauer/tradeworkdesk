-- patch-072: Facebook Login for Business OAuth support
-- Idempotent schema patch for tenant-scoped OAuth state and token metadata.

-- 1) Extend social_accounts to track OAuth connection metadata
ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS connection_method TEXT;

ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS token_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Prevent duplicate Facebook page connections per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_tenant_platform_page_unique
  ON social_accounts (tenant_id, platform, page_id)
  WHERE page_id IS NOT NULL;

-- Harden tenant isolation for updates by enforcing WITH CHECK.
DROP POLICY IF EXISTS "social_accounts_tenant_update" ON social_accounts;
CREATE POLICY "social_accounts_tenant_update" ON social_accounts
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "social_posts_tenant_update" ON social_posts;
CREATE POLICY "social_posts_tenant_update" ON social_posts
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

-- 2) OAuth state table (secure CSRF state bound to tenant/user)
CREATE TABLE IF NOT EXISTS facebook_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS facebook_oauth_states_state_hash_unique
  ON facebook_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS facebook_oauth_states_tenant_idx
  ON facebook_oauth_states (tenant_id);

CREATE INDEX IF NOT EXISTS facebook_oauth_states_expires_idx
  ON facebook_oauth_states (expires_at);

ALTER TABLE facebook_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS facebook_oauth_states_select ON facebook_oauth_states;
CREATE POLICY facebook_oauth_states_select ON facebook_oauth_states
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS facebook_oauth_states_insert ON facebook_oauth_states;
CREATE POLICY facebook_oauth_states_insert ON facebook_oauth_states
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS facebook_oauth_states_update ON facebook_oauth_states;
CREATE POLICY facebook_oauth_states_update ON facebook_oauth_states
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS facebook_oauth_states_delete ON facebook_oauth_states;
CREATE POLICY facebook_oauth_states_delete ON facebook_oauth_states
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );
