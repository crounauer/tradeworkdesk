CREATE TABLE IF NOT EXISTS accounting_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL,
  provider varchar NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  organisation_id varchar,
  extra_config jsonb DEFAULT '{}',
  connected_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

ALTER TABLE accounting_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_integrations_tenant_isolation"
  ON accounting_integrations
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE UNIQUE INDEX IF NOT EXISTS accounting_integrations_one_active_per_tenant
  ON accounting_integrations (tenant_id) WHERE is_active = true;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS external_invoice_id varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS external_invoice_provider varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS external_invoice_sent_at timestamptz;
