CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  feature_keys TEXT[] NOT NULL DEFAULT '{}',
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  annual_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  stripe_price_id_annual TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_per_seat BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  quantity INTEGER NOT NULL DEFAULT 1,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  stripe_subscription_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_addons_tenant ON tenant_addons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_addons_addon ON tenant_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_addons_active ON addons(is_active);

ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;

UPDATE plans SET is_legacy = true, is_active = false
WHERE name NOT ILIKE '%base plan%';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM plans WHERE is_legacy = false AND is_active = true) THEN
    INSERT INTO plans (name, description, monthly_price, annual_price, max_users, max_jobs_per_month, features, is_active, is_legacy, sort_order)
    VALUES (
      'Base Plan',
      'Core tools for managing your heating engineering business',
      8.50, 85.00,
      1, 50,
      '{"job_management": true, "scheduling": true, "invoicing": true, "reports": true}'::jsonb,
      true, false, 0
    );
  END IF;
END $$;

INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order) VALUES
  ('Digital Forms & Certificates', 'Gas service records, commissioning, compliance forms', ARRAY['compliance_forms', 'commissioning_forms'], 9.99, 99.99, false, 1),
  ('Digital Signatures', 'On-site customer sign-offs', ARRAY['digital_signatures'], 4.99, 49.99, false, 2),
  ('Accounting Integration', 'Xero, QuickBooks, Sage, Zoho, FreeAgent sync', ARRAY['accounting_integration'], 14.99, 149.99, false, 3),
  ('Social Media & AI Marketing', 'Post scheduling, AI content generation', ARRAY['social_media'], 9.99, 99.99, false, 4),
  ('Advanced Analytics', 'Advanced reporting dashboards with export', ARRAY['advanced_analytics', 'report_export'], 7.99, 79.99, false, 5),
  ('Team Management', 'Multi-user access, per-seat pricing', ARRAY['team_management'], 9.99, 99.99, true, 6),
  ('Custom Branding', 'White-label certificates and documents', ARRAY['custom_branding'], 4.99, 49.99, false, 7),
  ('API Access', 'External integrations', ARRAY['api_access'], 19.99, 199.99, false, 8),
  ('Extra Storage', 'Additional photo storage tiers', ARRAY['extra_storage'], 4.99, 49.99, false, 9),
  ('Specialist Forms', 'Oil tank inspections, heat pump commissioning, combustion analysis', ARRAY['oil_tank_forms', 'heat_pump_forms', 'combustion_analysis'], 9.99, 99.99, false, 10)
ON CONFLICT (name) DO NOTHING;
