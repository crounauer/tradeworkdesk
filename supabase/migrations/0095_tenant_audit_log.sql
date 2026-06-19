-- Migration 0095: tenant_audit_log
-- Tenant-scoped audit log for user/team actions across all roles.

CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_tenant_created
  ON tenant_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_event_created
  ON tenant_audit_log (event_type, created_at DESC);

ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_audit_log_select" ON tenant_audit_log;
CREATE POLICY "tenant_audit_log_select" ON tenant_audit_log
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS "tenant_audit_log_insert" ON tenant_audit_log;
CREATE POLICY "tenant_audit_log_insert" ON tenant_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician')
    )
  );
