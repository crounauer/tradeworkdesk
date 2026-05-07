-- patch-033: SMS Templates
-- Allows tenants to create reusable SMS message templates.

CREATE TABLE IF NOT EXISTS sms_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_tenant ON sms_templates (tenant_id);

-- RLS: admins can manage, all authenticated tenant users can read
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
