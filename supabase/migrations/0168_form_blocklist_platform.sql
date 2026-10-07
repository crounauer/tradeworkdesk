-- Migration 0168: platform-wide form blocklist entries
-- Allow global (tenant_id IS NULL) blocklist rows managed by super admins and
-- applied across every tenant's website enquiry form.

ALTER TABLE form_blocklist ALTER COLUMN tenant_id DROP NOT NULL;

-- Prevent duplicate platform-wide entries (NULLs are distinct in the existing
-- composite unique index, so add a dedicated partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_blocklist_platform_type_value
  ON form_blocklist (type, lower(value))
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_form_blocklist_platform
  ON form_blocklist (type, lower(value))
  WHERE tenant_id IS NULL;

-- Super admins can see and manage platform-wide rows; the existing super_admin
-- FOR ALL policy already covers this. Tenants can read platform rows so the
-- filter applies, but cannot modify them.
DROP POLICY IF EXISTS "form_blocklist_select_platform" ON form_blocklist;
CREATE POLICY "form_blocklist_select_platform" ON form_blocklist
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL);
