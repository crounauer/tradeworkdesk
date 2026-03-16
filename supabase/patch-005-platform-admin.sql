-- Patch 005: Platform Admin — Multi-tenant SaaS Foundation
-- Run this in your Supabase SQL Editor for existing databases

-- ─── 1. Extend user_role enum ──────────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ─── 2. Tenant status enum ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Plans table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  annual_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_jobs_per_month INTEGER NOT NULL DEFAULT 100,
  features JSONB NOT NULL DEFAULT '{
    "heat_pump_forms": true,
    "combustion_analysis": true,
    "reports": true,
    "api_access": false
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  stripe_price_id_annual TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 4. Tenants table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'United Kingdom',
  status tenant_status NOT NULL DEFAULT 'trial',
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  trial_ends_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ,
  subscription_renewal_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 5. Platform Announcements ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON platform_announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 6. Platform Audit Log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON platform_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON platform_audit_log(event_type);

-- ─── 7. Add tenant_id to all existing data tables ──────────────────────────────

-- Create a default seed tenant so existing data isn't orphaned
INSERT INTO plans (id, name, description, monthly_price, annual_price, max_users, max_jobs_per_month, sort_order)
VALUES ('00000000-0000-0000-0000-000000000001', 'Starter', 'Basic plan for small companies', 29.99, 299.99, 5, 100, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, name, description, monthly_price, annual_price, max_users, max_jobs_per_month, sort_order, features)
VALUES ('00000000-0000-0000-0000-000000000002', 'Professional', 'For growing businesses', 59.99, 599.99, 15, 500, 2, '{"heat_pump_forms": true, "combustion_analysis": true, "reports": true, "api_access": false}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, name, description, monthly_price, annual_price, max_users, max_jobs_per_month, sort_order, features)
VALUES ('00000000-0000-0000-0000-000000000003', 'Enterprise', 'Unlimited access for large operations', 99.99, 999.99, 50, 9999, 3, '{"heat_pump_forms": true, "combustion_analysis": true, "reports": true, "api_access": true}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants (id, company_name, contact_name, status, plan_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Company',
  'Admin',
  'active',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Add tenant_id columns (nullable first, then backfill, then make NOT NULL)
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE customers ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE properties ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE appliances ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE jobs ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE service_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE commissioning_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE heat_pump_service_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE heat_pump_commissioning_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE breakdown_reports ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE job_notes ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE file_attachments ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE signatures ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invite_codes ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE company_settings ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE oil_tank_inspections ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE oil_tank_risk_assessments ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE combustion_analysis_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE burner_setup_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE fire_valve_test_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE oil_line_vacuum_tests ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE job_completion_reports ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE lookup_options ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Backfill existing rows with the default tenant
UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE customers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE properties SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE appliances SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE jobs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE service_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE commissioning_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE heat_pump_service_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE heat_pump_commissioning_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE breakdown_reports SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE job_notes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE file_attachments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE signatures SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE invite_codes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE company_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE oil_tank_inspections SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE oil_tank_risk_assessments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE combustion_analysis_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE burner_setup_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE fire_valve_test_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE oil_line_vacuum_tests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE job_completion_reports SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE lookup_options SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Enforce NOT NULL on tenant_id for all data tables
ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE properties ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE appliances ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE service_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE commissioning_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE heat_pump_service_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE heat_pump_commissioning_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE breakdown_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE job_notes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE file_attachments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE signatures ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invite_codes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE company_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE oil_tank_inspections ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE oil_tank_risk_assessments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE combustion_analysis_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE burner_setup_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE fire_valve_test_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE oil_line_vacuum_tests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE job_completion_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE lookup_options ALTER COLUMN tenant_id SET NOT NULL;

-- Create indexes for tenant_id on all data tables
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appliances_tenant ON appliances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_records_tenant ON service_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissioning_records_tenant ON commissioning_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_heat_pump_service_records_tenant ON heat_pump_service_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_heat_pump_commissioning_records_tenant ON heat_pump_commissioning_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_tenant ON breakdown_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_tenant ON job_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_tenant ON file_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant ON signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_tenant ON invite_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_tenant ON company_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oil_tank_inspections_tenant ON oil_tank_inspections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oil_tank_risk_assessments_tenant ON oil_tank_risk_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_combustion_analysis_records_tenant ON combustion_analysis_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_burner_setup_records_tenant ON burner_setup_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fire_valve_test_records_tenant ON fire_valve_test_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oil_line_vacuum_tests_tenant ON oil_line_vacuum_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reports_tenant ON job_completion_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lookup_options_tenant ON lookup_options(tenant_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_settings_singleton_tenant_uniq'
  ) THEN
    ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS company_settings_singleton_id_key;
    ALTER TABLE company_settings ADD CONSTRAINT company_settings_singleton_tenant_uniq UNIQUE (singleton_id, tenant_id);
  END IF;
END $$;

-- ─── 8. Helper function to get user tenant_id ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_tenant_id(user_id UUID)
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 9. Update handle_new_user trigger to support tenant_id from metadata ──────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role;
  assigned_tenant_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    assigned_role := (NEW.raw_user_meta_data->>'role')::user_role;
  ELSIF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'technician';
  END IF;

  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    assigned_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  ELSE
    assigned_tenant_id := NULL;
  END IF;

  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    assigned_role,
    assigned_tenant_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 10. RLS for new tables ────────────────────────────────────────────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select" ON plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans_admin" ON plans FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "tenants_super_admin" ON tenants FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
CREATE POLICY "tenants_own" ON tenants FOR SELECT TO authenticated
  USING (id = get_user_tenant_id(auth.uid()));

CREATE POLICY "announcements_select" ON platform_announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "announcements_admin" ON platform_announcements FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "audit_log_admin" ON platform_audit_log FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
CREATE POLICY "audit_log_insert" ON platform_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ─── 11. Tenant-aware RLS policies for existing data tables ───────────────────
-- Drop old broad policies and replace with tenant-scoped ones

-- Profiles: drop all legacy policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

DO $$ BEGIN
CREATE POLICY "profiles_tenant_select" ON profiles FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "profiles_tenant_update" ON profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (get_user_role(auth.uid()) = 'admin' AND tenant_id = get_user_tenant_id(auth.uid()))
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Customers: drop all legacy policies
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;
DROP POLICY IF EXISTS "customers_all" ON customers;

DO $$ BEGIN
CREATE POLICY "customers_tenant" ON customers FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  ) WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Properties: drop all legacy policies
DROP POLICY IF EXISTS "properties_select" ON properties;
DROP POLICY IF EXISTS "properties_insert" ON properties;
DROP POLICY IF EXISTS "properties_update" ON properties;
DROP POLICY IF EXISTS "properties_delete" ON properties;
DROP POLICY IF EXISTS "properties_all" ON properties;

DO $$ BEGIN
CREATE POLICY "properties_tenant" ON properties FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  ) WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Appliances: drop all legacy policies
DROP POLICY IF EXISTS "appliances_select" ON appliances;
DROP POLICY IF EXISTS "appliances_insert" ON appliances;
DROP POLICY IF EXISTS "appliances_update" ON appliances;
DROP POLICY IF EXISTS "appliances_delete" ON appliances;
DROP POLICY IF EXISTS "appliances_all" ON appliances;

DO $$ BEGIN
CREATE POLICY "appliances_tenant" ON appliances FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  ) WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Jobs: drop all legacy policies
DROP POLICY IF EXISTS "jobs_select_admin_office" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_update" ON jobs;
DROP POLICY IF EXISTS "jobs_delete" ON jobs;
DROP POLICY IF EXISTS "jobs_all" ON jobs;

DO $$ BEGIN
CREATE POLICY "jobs_tenant" ON jobs FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  ) WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service records: drop all legacy policies
DROP POLICY IF EXISTS "service_records_select" ON service_records;
DROP POLICY IF EXISTS "service_records_insert" ON service_records;
DROP POLICY IF EXISTS "service_records_update" ON service_records;
DROP POLICY IF EXISTS "service_records_all" ON service_records;

DO $$ BEGIN
CREATE POLICY "service_records_tenant" ON service_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Commissioning records: drop all legacy policies
DROP POLICY IF EXISTS "commissioning_records_select" ON commissioning_records;
DROP POLICY IF EXISTS "commissioning_records_insert" ON commissioning_records;
DROP POLICY IF EXISTS "commissioning_records_update" ON commissioning_records;
DROP POLICY IF EXISTS "commissioning_records_all" ON commissioning_records;

DO $$ BEGIN
CREATE POLICY "commissioning_records_tenant" ON commissioning_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job notes: drop all legacy policies
DROP POLICY IF EXISTS "job_notes_select" ON job_notes;
DROP POLICY IF EXISTS "job_notes_insert" ON job_notes;
DROP POLICY IF EXISTS "job_notes_update" ON job_notes;
DROP POLICY IF EXISTS "job_notes_delete" ON job_notes;
DROP POLICY IF EXISTS "job_notes_all" ON job_notes;

DO $$ BEGIN
CREATE POLICY "job_notes_tenant" ON job_notes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- File attachments: drop all legacy policies
DROP POLICY IF EXISTS "file_attachments_select" ON file_attachments;
DROP POLICY IF EXISTS "file_attachments_insert" ON file_attachments;
DROP POLICY IF EXISTS "file_attachments_delete" ON file_attachments;
DROP POLICY IF EXISTS "file_attachments_all" ON file_attachments;

DO $$ BEGIN
CREATE POLICY "file_attachments_tenant" ON file_attachments FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Signatures: drop all legacy policies
DROP POLICY IF EXISTS "signatures_select" ON signatures;
DROP POLICY IF EXISTS "signatures_insert" ON signatures;
DROP POLICY IF EXISTS "signatures_all" ON signatures;

DO $$ BEGIN
CREATE POLICY "signatures_tenant" ON signatures FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invite codes: drop all legacy policies
DROP POLICY IF EXISTS "invite_codes_select" ON invite_codes;
DROP POLICY IF EXISTS "invite_codes_insert" ON invite_codes;
DROP POLICY IF EXISTS "invite_codes_all" ON invite_codes;

DO $$ BEGIN
CREATE POLICY "invite_codes_tenant" ON invite_codes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Breakdown reports: drop all legacy policies
DROP POLICY IF EXISTS "breakdown_reports_select" ON breakdown_reports;
DROP POLICY IF EXISTS "breakdown_reports_insert" ON breakdown_reports;
DROP POLICY IF EXISTS "breakdown_reports_update" ON breakdown_reports;
DROP POLICY IF EXISTS "breakdown_reports_all" ON breakdown_reports;

DO $$ BEGIN
CREATE POLICY "breakdown_reports_tenant" ON breakdown_reports FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Heat pump service records: drop all legacy policies
DROP POLICY IF EXISTS "heat_pump_service_records_select" ON heat_pump_service_records;
DROP POLICY IF EXISTS "heat_pump_service_records_insert" ON heat_pump_service_records;
DROP POLICY IF EXISTS "heat_pump_service_records_update" ON heat_pump_service_records;
DROP POLICY IF EXISTS "heat_pump_service_records_all" ON heat_pump_service_records;

DO $$ BEGIN
CREATE POLICY "heat_pump_service_records_tenant" ON heat_pump_service_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Heat pump commissioning records: drop all legacy policies
DROP POLICY IF EXISTS "heat_pump_commissioning_records_select" ON heat_pump_commissioning_records;
DROP POLICY IF EXISTS "heat_pump_commissioning_records_insert" ON heat_pump_commissioning_records;
DROP POLICY IF EXISTS "heat_pump_commissioning_records_update" ON heat_pump_commissioning_records;
DROP POLICY IF EXISTS "heat_pump_commissioning_records_all" ON heat_pump_commissioning_records;

DO $$ BEGIN
CREATE POLICY "heat_pump_commissioning_records_tenant" ON heat_pump_commissioning_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS for oil form sub-record tables
ALTER TABLE oil_tank_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oil_tank_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE combustion_analysis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE burner_setup_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fire_valve_test_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE oil_line_vacuum_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_completion_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_options ENABLE ROW LEVEL SECURITY;

-- Oil tank inspections: drop all legacy policies
DROP POLICY IF EXISTS "oil_tank_inspections_select" ON oil_tank_inspections;
DROP POLICY IF EXISTS "oil_tank_inspections_insert" ON oil_tank_inspections;
DROP POLICY IF EXISTS "oil_tank_inspections_update" ON oil_tank_inspections;
DROP POLICY IF EXISTS "oil_tank_inspections_all" ON oil_tank_inspections;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON oil_tank_inspections;

DO $$ BEGIN
CREATE POLICY "oil_tank_inspections_tenant" ON oil_tank_inspections FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Oil tank risk assessments: drop all legacy policies
DROP POLICY IF EXISTS "oil_tank_risk_assessments_select" ON oil_tank_risk_assessments;
DROP POLICY IF EXISTS "oil_tank_risk_assessments_insert" ON oil_tank_risk_assessments;
DROP POLICY IF EXISTS "oil_tank_risk_assessments_update" ON oil_tank_risk_assessments;
DROP POLICY IF EXISTS "oil_tank_risk_assessments_all" ON oil_tank_risk_assessments;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON oil_tank_risk_assessments;

DO $$ BEGIN
CREATE POLICY "oil_tank_risk_assessments_tenant" ON oil_tank_risk_assessments FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Combustion analysis records: drop all legacy policies
DROP POLICY IF EXISTS "combustion_analysis_records_select" ON combustion_analysis_records;
DROP POLICY IF EXISTS "combustion_analysis_records_insert" ON combustion_analysis_records;
DROP POLICY IF EXISTS "combustion_analysis_records_update" ON combustion_analysis_records;
DROP POLICY IF EXISTS "combustion_analysis_records_all" ON combustion_analysis_records;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON combustion_analysis_records;

DO $$ BEGIN
CREATE POLICY "combustion_analysis_records_tenant" ON combustion_analysis_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Burner setup records: drop all legacy policies
DROP POLICY IF EXISTS "burner_setup_records_select" ON burner_setup_records;
DROP POLICY IF EXISTS "burner_setup_records_insert" ON burner_setup_records;
DROP POLICY IF EXISTS "burner_setup_records_update" ON burner_setup_records;
DROP POLICY IF EXISTS "burner_setup_records_all" ON burner_setup_records;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON burner_setup_records;

DO $$ BEGIN
CREATE POLICY "burner_setup_records_tenant" ON burner_setup_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fire valve test records: drop all legacy policies
DROP POLICY IF EXISTS "fire_valve_test_records_select" ON fire_valve_test_records;
DROP POLICY IF EXISTS "fire_valve_test_records_insert" ON fire_valve_test_records;
DROP POLICY IF EXISTS "fire_valve_test_records_update" ON fire_valve_test_records;
DROP POLICY IF EXISTS "fire_valve_test_records_all" ON fire_valve_test_records;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON fire_valve_test_records;

DO $$ BEGIN
CREATE POLICY "fire_valve_test_records_tenant" ON fire_valve_test_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Oil line vacuum tests: drop all legacy policies
DROP POLICY IF EXISTS "oil_line_vacuum_tests_select" ON oil_line_vacuum_tests;
DROP POLICY IF EXISTS "oil_line_vacuum_tests_insert" ON oil_line_vacuum_tests;
DROP POLICY IF EXISTS "oil_line_vacuum_tests_update" ON oil_line_vacuum_tests;
DROP POLICY IF EXISTS "oil_line_vacuum_tests_all" ON oil_line_vacuum_tests;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON oil_line_vacuum_tests;

DO $$ BEGIN
CREATE POLICY "oil_line_vacuum_tests_tenant" ON oil_line_vacuum_tests FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job completion reports: drop all legacy policies
DROP POLICY IF EXISTS "job_completion_reports_select" ON job_completion_reports;
DROP POLICY IF EXISTS "job_completion_reports_insert" ON job_completion_reports;
DROP POLICY IF EXISTS "job_completion_reports_update" ON job_completion_reports;
DROP POLICY IF EXISTS "job_completion_reports_all" ON job_completion_reports;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON job_completion_reports;

DO $$ BEGIN
CREATE POLICY "job_completion_reports_tenant" ON job_completion_reports FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Lookup options: drop all legacy policies
DROP POLICY IF EXISTS "lookup_options_select" ON lookup_options;
DROP POLICY IF EXISTS "lookup_options_insert" ON lookup_options;
DROP POLICY IF EXISTS "lookup_options_update" ON lookup_options;
DROP POLICY IF EXISTS "lookup_options_delete" ON lookup_options;
DROP POLICY IF EXISTS "lookup_options_all" ON lookup_options;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON lookup_options;

DO $$ BEGIN
CREATE POLICY "lookup_options_tenant" ON lookup_options FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 12. Tenant subscriptions table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','trialing')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_plan ON tenant_subscriptions(plan_id);

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "tenant_subscriptions_super_admin" ON tenant_subscriptions FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "tenant_subscriptions_own" ON tenant_subscriptions FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── 13. Fix handle_new_user trigger for NULL tenant_id ──────────────────────────
-- Profiles.tenant_id must allow NULL for initial signup before tenant assignment
-- The NOT NULL constraint is too strict - invite-based signups via Supabase Auth
-- may not have tenant_id in metadata. Use default tenant as fallback.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role;
  assigned_tenant_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    assigned_role := (NEW.raw_user_meta_data->>'role')::user_role;
  ELSIF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'technician';
  END IF;

  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    assigned_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  ELSE
    assigned_tenant_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    assigned_role,
    assigned_tenant_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 14. Seed default plans ─────────────────────────────────────────────────────
-- (Already inserted above in step 7)
