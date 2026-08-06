ALTER TABLE IF EXISTS tenant_email_audit_log
  DROP CONSTRAINT IF EXISTS tenant_email_audit_log_status_check;

ALTER TABLE IF EXISTS tenant_email_audit_log
  ADD CONSTRAINT tenant_email_audit_log_status_check
  CHECK (status IN ('queued', 'accepted', 'delivered', 'deferred', 'bounced', 'complained', 'suppressed', 'failed', 'sent'));

ALTER TABLE IF EXISTS tenant_email_audit_log
  ADD COLUMN IF NOT EXISTS needs_action BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redacted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenant_email_audit_log_provider_message_id
  ON tenant_email_audit_log (provider_message_id);

CREATE INDEX IF NOT EXISTS idx_tenant_email_audit_log_needs_action
  ON tenant_email_audit_log (tenant_id, needs_action, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'marketing', 'review_requests', 'campaigns')),
  reason TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email, scope)
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_suppressions_tenant_email
  ON tenant_email_suppressions (tenant_id, email);

ALTER TABLE tenant_email_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_email_suppressions_select ON tenant_email_suppressions;
CREATE POLICY tenant_email_suppressions_select ON tenant_email_suppressions
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS tenant_email_suppressions_insert ON tenant_email_suppressions;
CREATE POLICY tenant_email_suppressions_insert ON tenant_email_suppressions
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS tenant_email_suppressions_delete ON tenant_email_suppressions;
CREATE POLICY tenant_email_suppressions_delete ON tenant_email_suppressions
  FOR DELETE TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );
