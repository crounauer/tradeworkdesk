CREATE TABLE IF NOT EXISTS social_post_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  account_id UUID,
  platform social_platform NOT NULL,
  is_platform_scope BOOLEAN NOT NULL DEFAULT false,
  trigger_source TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot JSONB,
  error_message TEXT,
  error_snapshot JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_post_delivery_attempts_post_idx
  ON social_post_delivery_attempts (post_id, is_platform_scope, started_at DESC);

CREATE INDEX IF NOT EXISTS social_post_delivery_attempts_tenant_idx
  ON social_post_delivery_attempts (tenant_id, started_at DESC)
  WHERE is_platform_scope = false;

CREATE INDEX IF NOT EXISTS social_post_delivery_attempts_platform_idx
  ON social_post_delivery_attempts (started_at DESC)
  WHERE is_platform_scope = true;

CREATE INDEX IF NOT EXISTS social_post_delivery_attempts_correlation_idx
  ON social_post_delivery_attempts (correlation_id);

ALTER TABLE social_post_delivery_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_post_delivery_attempts_select_policy ON social_post_delivery_attempts;
CREATE POLICY social_post_delivery_attempts_select_policy ON social_post_delivery_attempts
  FOR SELECT TO authenticated
  USING (
    (is_platform_scope = false AND tenant_id = get_user_tenant_id(auth.uid()))
    OR
    (is_platform_scope = true AND get_user_role(auth.uid()) = 'super_admin')
  );
