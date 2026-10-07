-- Migration 0167: form_blocklist
-- Per-tenant blocklist used to reject spam website enquiry form submissions.
-- Entries can block a specific email address, an entire email domain, or an IP.

CREATE TABLE IF NOT EXISTS form_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'domain', 'ip')),
  value TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_blocklist_tenant_type_value
  ON form_blocklist (tenant_id, type, lower(value));

CREATE INDEX IF NOT EXISTS idx_form_blocklist_tenant
  ON form_blocklist (tenant_id);

ALTER TABLE form_blocklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_blocklist_select" ON form_blocklist;
CREATE POLICY "form_blocklist_select" ON form_blocklist
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS "form_blocklist_insert" ON form_blocklist;
CREATE POLICY "form_blocklist_insert" ON form_blocklist
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
  );

DROP POLICY IF EXISTS "form_blocklist_delete" ON form_blocklist;
CREATE POLICY "form_blocklist_delete" ON form_blocklist
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
  );

DROP POLICY IF EXISTS "form_blocklist_super_admin" ON form_blocklist;
CREATE POLICY "form_blocklist_super_admin" ON form_blocklist
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
