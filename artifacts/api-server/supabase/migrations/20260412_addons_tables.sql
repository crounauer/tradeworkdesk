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
  ('Digital Forms & Certificates', 'Pre-built gas service records, breakdown reports, commissioning forms, and compliance certificates — all Gas Safe, OFTEC, and MCS ready. Complete on site and export as professional PDFs.', ARRAY['compliance_forms', 'commissioning_forms'], 9.99, 99.99, false, 1),
  ('Digital Signatures', 'Capture legally valid customer sign-offs on site using any device. Signatures are stored securely with each job record for full audit trails.', ARRAY['digital_signatures'], 4.99, 49.99, false, 2),
  ('Accounting Integration', 'Sync invoices, payments, and customer data with Xero, QuickBooks, Sage, Zoho, or FreeAgent. Eliminate double entry and keep your books up to date automatically.', ARRAY['accounting_integration'], 14.99, 149.99, false, 3),
  ('Social Media & AI Marketing', 'Schedule posts across Facebook, Instagram, and Google. AI-powered content generation creates professional marketing copy tailored to your trade business.', ARRAY['social_media'], 9.99, 99.99, false, 4),
  ('Advanced Analytics', 'Unlock detailed reporting dashboards covering revenue trends, engineer productivity, job completion rates, and customer retention. Export reports as CSV or PDF.', ARRAY['advanced_analytics', 'report_export'], 7.99, 79.99, false, 5),
  ('Team Management', 'Add team members with role-based access — admin, office staff, and technician roles. Manage workloads, assign jobs, and oversee compliance across your workforce.', ARRAY['team_management'], 9.99, 99.99, true, 6),
  ('Custom Branding', 'White-label your certificates, invoices, and customer-facing documents with your company logo, colours, and contact details for a professional finish.', ARRAY['custom_branding'], 4.99, 49.99, false, 7),
  ('API Access', 'Connect TradeWorkDesk to your existing tools and workflows via a RESTful API. Build custom integrations, automate data flows, and extend platform capabilities.', ARRAY['api_access'], 19.99, 199.99, false, 8),
  ('Extra Storage', 'Expand your photo and document storage beyond the base allowance. Ideal for businesses that capture extensive on-site photography and documentation.', ARRAY['extra_storage'], 4.99, 49.99, false, 9),
  ('Specialist Forms', 'Industry-specific forms for oil tank inspections, heat pump commissioning, and combustion analysis. Designed around OFTEC and MCS compliance requirements.', ARRAY['oil_tank_forms', 'heat_pump_forms', 'combustion_analysis'], 9.99, 99.99, false, 10),
  ('Additional Users', 'Add extra user seats to your account. Each unit adds one additional team member with full access to job management, forms, and scheduling.', ARRAY['additional_users'], 4.99, 49.99, true, 11),
  ('Jobs Per Month', 'Add 25 extra jobs per month to your allowance', ARRAY['jobs_per_month'], 1, 10, false, 12)
ON CONFLICT (name) DO NOTHING;
