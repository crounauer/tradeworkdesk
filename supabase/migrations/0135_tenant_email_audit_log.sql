-- Migration 0135: tenant_email_audit_log
-- Master per-tenant audit trail for outbound emails (success/failure).

CREATE TABLE IF NOT EXISTS tenant_email_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  email_type TEXT NOT NULL DEFAULT 'general',
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  to_email TEXT,
  subject TEXT NOT NULL,
  from_email TEXT,
  reply_to TEXT,
  error_message TEXT,
  failure_category TEXT CHECK (failure_category IN ('recipient', 'provider', 'platform', 'unknown')),
  request_path TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_audit_log_tenant_created
  ON tenant_email_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_email_audit_log_tenant_status
  ON tenant_email_audit_log (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_email_audit_log_tenant_type
  ON tenant_email_audit_log (tenant_id, email_type, created_at DESC);

ALTER TABLE tenant_email_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_email_audit_log_select" ON tenant_email_audit_log;
CREATE POLICY "tenant_email_audit_log_select" ON tenant_email_audit_log
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS "tenant_email_audit_log_insert" ON tenant_email_audit_log;
CREATE POLICY "tenant_email_audit_log_insert" ON tenant_email_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician')
    )
  );
