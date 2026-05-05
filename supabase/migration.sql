-- Boiler Service Technician App - Supabase Migration
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types (idempotent — skipped if already exist)
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'office_staff', 'technician'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE job_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'requires_follow_up'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE job_type AS ENUM ('service', 'breakdown', 'installation', 'inspection', 'follow_up'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE property_type AS ENUM ('residential', 'commercial', 'industrial'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE occupancy_type AS ENUM ('owner_occupied', 'tenant', 'landlord', 'vacant', 'holiday_let'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE fuel_type AS ENUM ('oil', 'gas', 'lpg', 'electric', 'solid_fuel', 'heat_pump', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE boiler_type AS ENUM ('combi', 'system', 'regular', 'back_boiler', 'ashp', 'gshp', 'wshp', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE system_type AS ENUM ('open_vented', 'sealed', 'gravity_fed', 'pressurised', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'technician',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT NOT NULL,
  property_type property_type DEFAULT 'residential',
  occupancy_type occupancy_type,
  access_notes TEXT,
  parking_notes TEXT,
  boiler_location TEXT,
  flue_location TEXT,
  tank_location TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Appliances table
CREATE TABLE IF NOT EXISTS appliances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  boiler_type boiler_type,
  fuel_type fuel_type,
  system_type system_type,
  installation_date DATE,
  warranty_expiry DATE,
  burner_make TEXT,
  burner_model TEXT,
  nozzle_size TEXT,
  pump_pressure TEXT,
  controls TEXT,
  last_service_date DATE,
  next_service_due DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  appliance_id UUID REFERENCES appliances(id) ON DELETE SET NULL,
  assigned_technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  job_type job_type NOT NULL DEFAULT 'service',
  status job_status NOT NULL DEFAULT 'scheduled',
  priority priority_level NOT NULL DEFAULT 'medium',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  estimated_duration INTEGER,
  description TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service Records table
CREATE TABLE IF NOT EXISTS service_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  visual_inspection TEXT,
  appliance_condition TEXT,
  flue_inspection TEXT,
  combustion_co2 TEXT,
  combustion_co TEXT,
  combustion_o2 TEXT,
  combustion_temp TEXT,
  combustion_efficiency TEXT,
  smoke_test TEXT,
  smoke_number TEXT,
  burner_cleaned BOOLEAN DEFAULT false,
  heat_exchanger_cleaned BOOLEAN DEFAULT false,
  nozzle_checked BOOLEAN DEFAULT false,
  nozzle_replaced BOOLEAN DEFAULT false,
  nozzle_size_fitted TEXT,
  electrodes_checked BOOLEAN DEFAULT false,
  electrodes_replaced BOOLEAN DEFAULT false,
  filter_checked BOOLEAN DEFAULT false,
  filter_cleaned BOOLEAN DEFAULT false,
  filter_replaced BOOLEAN DEFAULT false,
  oil_line_checked BOOLEAN DEFAULT false,
  fire_valve_checked BOOLEAN DEFAULT false,
  seals_gaskets_checked BOOLEAN DEFAULT false,
  seals_gaskets_replaced BOOLEAN DEFAULT false,
  controls_checked BOOLEAN DEFAULT false,
  thermostat_checked BOOLEAN DEFAULT false,
  safety_devices_checked BOOLEAN DEFAULT false,
  safety_devices_notes TEXT,
  leaks_found BOOLEAN DEFAULT false,
  leaks_details TEXT,
  defects_found BOOLEAN DEFAULT false,
  defects_details TEXT,
  advisories TEXT,
  parts_required TEXT,
  work_completed TEXT,
  appliance_safe BOOLEAN DEFAULT true,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  next_service_due DATE,
  additional_notes TEXT,
  gas_tightness_pass BOOLEAN DEFAULT false,
  gas_standing_pressure TEXT,
  gas_working_pressure TEXT,
  gas_operating_pressure TEXT,
  gas_burner_pressure TEXT,
  gas_heat_input TEXT,
  co_co2_ratio TEXT,
  flue_spillage_test TEXT,
  ventilation_adequate BOOLEAN DEFAULT false,
  gas_meter_type TEXT,
  gas_safe_engineer_id TEXT,
  cp12_certificate_number TEXT,
  landlord_certificate BOOLEAN DEFAULT false,
  appliance_classification TEXT CHECK (appliance_classification IN ('safe', 'at_risk', 'immediately_dangerous', 'not_to_current_standards')),
  warning_notice_issued BOOLEAN DEFAULT false,
  warning_notice_type TEXT,
  warning_notice_details TEXT,
  customer_warned BOOLEAN DEFAULT false,
  gas_valve_checked BOOLEAN DEFAULT false,
  injectors_checked BOOLEAN DEFAULT false,
  pilot_checked BOOLEAN DEFAULT false,
  ignition_checked BOOLEAN DEFAULT false,
  gas_pressure_checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commissioning Records table
CREATE TABLE IF NOT EXISTS commissioning_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  gas_safe_engineer_id TEXT,
  standing_pressure TEXT,
  working_pressure TEXT,
  operating_pressure TEXT,
  gas_rate_measured TEXT,
  combustion_co TEXT,
  combustion_co2 TEXT,
  flue_temp TEXT,
  ignition_tested BOOLEAN DEFAULT false,
  controls_tested BOOLEAN DEFAULT false,
  thermostats_tested BOOLEAN DEFAULT false,
  pressure_relief_tested BOOLEAN DEFAULT false,
  expansion_vessel_checked BOOLEAN DEFAULT false,
  system_flushed BOOLEAN DEFAULT false,
  inhibitor_added BOOLEAN DEFAULT false,
  customer_instructions_given BOOLEAN DEFAULT false,
  customer_name_signed TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Heat Pump Service Records table
CREATE TABLE IF NOT EXISTS heat_pump_service_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  refrigerant_type TEXT,
  refrigerant_pressure_high TEXT,
  refrigerant_pressure_low TEXT,
  flow_temp TEXT,
  return_temp TEXT,
  delta_t TEXT,
  cop_reading TEXT,
  compressor_amps TEXT,
  outdoor_unit_condition TEXT,
  indoor_unit_condition TEXT,
  controls_checked BOOLEAN DEFAULT false,
  filter_condition TEXT,
  dhw_cylinder_checked BOOLEAN DEFAULT false,
  dhw_cylinder_temp TEXT,
  defects_found BOOLEAN DEFAULT false,
  defects_details TEXT,
  advisories TEXT,
  appliance_safe BOOLEAN DEFAULT true,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  customer_name_signed TEXT,
  technician_name_signed TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Heat Pump Commissioning Records table
CREATE TABLE IF NOT EXISTS heat_pump_commissioning_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  heat_loss_kwh TEXT,
  design_flow_temp TEXT,
  refrigerant_type TEXT,
  refrigerant_charge_weight TEXT,
  commissioning_pressure_high TEXT,
  commissioning_pressure_low TEXT,
  measured_cop TEXT,
  expansion_vessel_checked BOOLEAN DEFAULT false,
  safety_devices_checked BOOLEAN DEFAULT false,
  controls_commissioned BOOLEAN DEFAULT false,
  buffer_tank_checked BOOLEAN DEFAULT false,
  cylinder_checked BOOLEAN DEFAULT false,
  system_flushed BOOLEAN DEFAULT false,
  inhibitor_added BOOLEAN DEFAULT false,
  customer_instructions_given BOOLEAN DEFAULT false,
  customer_name_signed TEXT,
  technician_name_signed TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Breakdown Reports table
CREATE TABLE IF NOT EXISTS breakdown_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  reported_fault TEXT,
  symptoms TEXT,
  diagnostics_performed TEXT,
  findings TEXT,
  parts_required TEXT,
  temporary_fix TEXT,
  permanent_fix TEXT,
  appliance_safe BOOLEAN DEFAULT true,
  return_visit_required BOOLEAN DEFAULT false,
  return_visit_notes TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job Notes table
CREATE TABLE IF NOT EXISTS job_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File Attachments table
CREATE TABLE IF NOT EXISTS file_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signatures table
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  signer_type TEXT NOT NULL CHECK (signer_type IN ('technician', 'customer')),
  signer_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_customers_postcode ON customers(postcode);
CREATE INDEX IF NOT EXISTS idx_properties_customer ON properties(customer_id);
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON properties(postcode);
CREATE INDEX IF NOT EXISTS idx_appliances_property ON appliances(property_id);
CREATE INDEX IF NOT EXISTS idx_appliances_serial ON appliances(serial_number);
CREATE INDEX IF NOT EXISTS idx_appliances_next_due ON appliances(next_service_due);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_property ON jobs(property_id);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_service_records_job ON service_records(job_id);
CREATE INDEX IF NOT EXISTS idx_commissioning_records_job ON commissioning_records(job_id);
CREATE INDEX IF NOT EXISTS idx_heat_pump_service_records_job ON heat_pump_service_records(job_id);
CREATE INDEX IF NOT EXISTS idx_heat_pump_commissioning_records_job ON heat_pump_commissioning_records(job_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_job ON breakdown_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_job ON job_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_entity ON file_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_signatures_job ON signatures(job_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON customers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON properties;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON appliances;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appliances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON service_records;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON service_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON commissioning_records;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON commissioning_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON heat_pump_service_records;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON heat_pump_service_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON heat_pump_commissioning_records;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON heat_pump_commissioning_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON breakdown_reports;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON breakdown_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON job_notes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role;
BEGIN
  -- If a role was explicitly passed in metadata, use it.
  -- Otherwise: first user in the system becomes admin; everyone else technician.
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    assigned_role := (NEW.raw_user_meta_data->>'role')::user_role;
  ELSIF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'technician';
  END IF;

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    assigned_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Invite codes (admin creates, new users consume to register)
CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  role        user_role NOT NULL DEFAULT 'technician',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  used_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  note        TEXT
);

-- Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE appliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissioning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE heat_pump_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE heat_pump_commissioning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakdown_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users can read all profiles, update own
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Customers: all authenticated users can read, admin/office can write
DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Properties: same as customers
DROP POLICY IF EXISTS "properties_select" ON properties;
CREATE POLICY "properties_select" ON properties FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "properties_insert" ON properties;
CREATE POLICY "properties_insert" ON properties FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
DROP POLICY IF EXISTS "properties_update" ON properties;
CREATE POLICY "properties_update" ON properties FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
DROP POLICY IF EXISTS "properties_delete" ON properties;
CREATE POLICY "properties_delete" ON properties FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Appliances: same as customers
DROP POLICY IF EXISTS "appliances_select" ON appliances;
CREATE POLICY "appliances_select" ON appliances FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "appliances_insert" ON appliances;
CREATE POLICY "appliances_insert" ON appliances FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician'));
DROP POLICY IF EXISTS "appliances_update" ON appliances;
CREATE POLICY "appliances_update" ON appliances FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician'));
DROP POLICY IF EXISTS "appliances_delete" ON appliances;
CREATE POLICY "appliances_delete" ON appliances FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Jobs: technicians see their own, admin/office see all
DROP POLICY IF EXISTS "jobs_select_admin_office" ON jobs;
CREATE POLICY "jobs_select_admin_office" ON jobs FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR assigned_technician_id = auth.uid());
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
CREATE POLICY "jobs_insert" ON jobs FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
DROP POLICY IF EXISTS "jobs_update" ON jobs;
CREATE POLICY "jobs_update" ON jobs FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR assigned_technician_id = auth.uid());
DROP POLICY IF EXISTS "jobs_delete" ON jobs;
CREATE POLICY "jobs_delete" ON jobs FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Service Records: technicians see their own, admin/office see all
DROP POLICY IF EXISTS "service_records_select" ON service_records;
CREATE POLICY "service_records_select" ON service_records FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
DROP POLICY IF EXISTS "service_records_insert" ON service_records;
CREATE POLICY "service_records_insert" ON service_records FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "service_records_update" ON service_records;
CREATE POLICY "service_records_update" ON service_records FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());

-- Commissioning Records: same as service records
DROP POLICY IF EXISTS "commissioning_records_select" ON commissioning_records;
CREATE POLICY "commissioning_records_select" ON commissioning_records FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
DROP POLICY IF EXISTS "commissioning_records_insert" ON commissioning_records;
CREATE POLICY "commissioning_records_insert" ON commissioning_records FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "commissioning_records_update" ON commissioning_records;
CREATE POLICY "commissioning_records_update" ON commissioning_records FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());

-- Heat Pump Service Records: same as service records
DROP POLICY IF EXISTS "heat_pump_service_records_select" ON heat_pump_service_records;
CREATE POLICY "heat_pump_service_records_select" ON heat_pump_service_records FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
DROP POLICY IF EXISTS "heat_pump_service_records_insert" ON heat_pump_service_records;
CREATE POLICY "heat_pump_service_records_insert" ON heat_pump_service_records FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "heat_pump_service_records_update" ON heat_pump_service_records;
CREATE POLICY "heat_pump_service_records_update" ON heat_pump_service_records FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());

-- Heat Pump Commissioning Records: same as service records
DROP POLICY IF EXISTS "heat_pump_commissioning_records_select" ON heat_pump_commissioning_records;
CREATE POLICY "heat_pump_commissioning_records_select" ON heat_pump_commissioning_records FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
DROP POLICY IF EXISTS "heat_pump_commissioning_records_insert" ON heat_pump_commissioning_records;
CREATE POLICY "heat_pump_commissioning_records_insert" ON heat_pump_commissioning_records FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "heat_pump_commissioning_records_update" ON heat_pump_commissioning_records;
CREATE POLICY "heat_pump_commissioning_records_update" ON heat_pump_commissioning_records FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());

-- Breakdown Reports: same as service records
DROP POLICY IF EXISTS "breakdown_reports_select" ON breakdown_reports;
CREATE POLICY "breakdown_reports_select" ON breakdown_reports FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
DROP POLICY IF EXISTS "breakdown_reports_insert" ON breakdown_reports;
CREATE POLICY "breakdown_reports_insert" ON breakdown_reports FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "breakdown_reports_update" ON breakdown_reports;
CREATE POLICY "breakdown_reports_update" ON breakdown_reports FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());

-- Job Notes: all authenticated can read and create
DROP POLICY IF EXISTS "job_notes_select" ON job_notes;
CREATE POLICY "job_notes_select" ON job_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "job_notes_insert" ON job_notes;
CREATE POLICY "job_notes_insert" ON job_notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "job_notes_update" ON job_notes;
CREATE POLICY "job_notes_update" ON job_notes FOR UPDATE TO authenticated USING (author_id = auth.uid());
DROP POLICY IF EXISTS "job_notes_delete" ON job_notes;
CREATE POLICY "job_notes_delete" ON job_notes FOR DELETE TO authenticated USING (author_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- File Attachments: admin/office can see all, technicians only see files for their assigned jobs
DROP POLICY IF EXISTS "file_attachments_select" ON file_attachments;
CREATE POLICY "file_attachments_select" ON file_attachments FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR (entity_type = 'job' AND EXISTS (SELECT 1 FROM jobs WHERE jobs.id = entity_id AND jobs.assigned_technician_id = auth.uid()))
  );
DROP POLICY IF EXISTS "file_attachments_insert" ON file_attachments;
CREATE POLICY "file_attachments_insert" ON file_attachments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "file_attachments_delete" ON file_attachments;
CREATE POLICY "file_attachments_delete" ON file_attachments FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- Signatures: admin/office can see all, technicians only see signatures for their assigned jobs
DROP POLICY IF EXISTS "signatures_select" ON signatures;
CREATE POLICY "signatures_select" ON signatures FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id AND jobs.assigned_technician_id = auth.uid())
  );
DROP POLICY IF EXISTS "signatures_insert" ON signatures;
CREATE POLICY "signatures_insert" ON signatures FOR INSERT TO authenticated WITH CHECK (true);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('service-photos', 'service-photos', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('service-documents', 'service-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false) ON CONFLICT DO NOTHING;

-- Storage policies - scoped by role: admin/office have full access, technicians restricted to their job paths
DROP POLICY IF EXISTS "auth_upload_photos" ON storage.objects;
CREATE POLICY "auth_upload_photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-photos');
DROP POLICY IF EXISTS "auth_read_photos" ON storage.objects;
CREATE POLICY "auth_read_photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-photos' AND (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR EXISTS (SELECT 1 FROM jobs WHERE jobs.assigned_technician_id = auth.uid() AND name LIKE 'jobs/' || jobs.id::text || '/%')
  ));
DROP POLICY IF EXISTS "auth_delete_photos" ON storage.objects;
CREATE POLICY "auth_delete_photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-photos' AND (owner = auth.uid() OR get_user_role(auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "auth_upload_docs" ON storage.objects;
CREATE POLICY "auth_upload_docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-documents');
DROP POLICY IF EXISTS "auth_read_docs" ON storage.objects;
CREATE POLICY "auth_read_docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-documents' AND (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR EXISTS (SELECT 1 FROM jobs WHERE jobs.assigned_technician_id = auth.uid() AND name LIKE 'jobs/' || jobs.id::text || '/%')
  ));
DROP POLICY IF EXISTS "auth_delete_docs" ON storage.objects;
CREATE POLICY "auth_delete_docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-documents' AND (owner = auth.uid() OR get_user_role(auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "auth_upload_sigs" ON storage.objects;
CREATE POLICY "auth_upload_sigs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
DROP POLICY IF EXISTS "auth_read_sigs" ON storage.objects;
CREATE POLICY "auth_read_sigs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR EXISTS (SELECT 1 FROM jobs WHERE jobs.assigned_technician_id = auth.uid() AND name LIKE 'jobs/' || jobs.id::text || '/%')
  ));
DROP POLICY IF EXISTS "auth_delete_sigs" ON storage.objects;
CREATE POLICY "auth_delete_sigs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND (owner = auth.uid() OR get_user_role(auth.uid()) = 'admin'));

-- ─── Company Settings ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  singleton_id TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  trading_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'United Kingdom',
  phone TEXT,
  email TEXT,
  website TEXT,
  gas_safe_number TEXT,
  oftec_number TEXT,
  vat_number TEXT,
  company_number TEXT,
  logo_url TEXT,
  logo_storage_path TEXT,
  rates_url TEXT,
  trading_terms_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_settings_singleton UNIQUE (singleton_id)
);

DROP TRIGGER IF EXISTS set_updated_at ON company_settings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
CREATE POLICY "company_settings_select" ON company_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "company_settings_insert" ON company_settings;
CREATE POLICY "company_settings_insert" ON company_settings
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "company_settings_update" ON company_settings;
CREATE POLICY "company_settings_update" ON company_settings
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Public bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "company_logos_upload" ON storage.objects;
CREATE POLICY "company_logos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "company_logos_read" ON storage.objects;
CREATE POLICY "company_logos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_delete" ON storage.objects;
CREATE POLICY "company_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND get_user_role(auth.uid()) = 'admin');
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

DROP TRIGGER IF EXISTS set_updated_at ON plans;
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

DROP TRIGGER IF EXISTS set_updated_at ON tenants;
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

DROP TRIGGER IF EXISTS set_updated_at ON platform_announcements;
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

DROP POLICY IF EXISTS "plans_select" ON plans;
CREATE POLICY "plans_select" ON plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "plans_admin" ON plans;
CREATE POLICY "plans_admin" ON plans FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "tenants_super_admin" ON tenants;
CREATE POLICY "tenants_super_admin" ON tenants FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
DROP POLICY IF EXISTS "tenants_own" ON tenants;
CREATE POLICY "tenants_own" ON tenants FOR SELECT TO authenticated
  USING (id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "announcements_select" ON platform_announcements;
CREATE POLICY "announcements_select" ON platform_announcements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "announcements_admin" ON platform_announcements;
CREATE POLICY "announcements_admin" ON platform_announcements FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "audit_log_admin" ON platform_audit_log;
CREATE POLICY "audit_log_admin" ON platform_audit_log FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
DROP POLICY IF EXISTS "audit_log_insert" ON platform_audit_log;
CREATE POLICY "audit_log_insert" ON platform_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ─── 11. Seed default plans ────────────────────────────────────────────────────
-- (Already inserted above in step 7)

-- ─── 12. Add tenant_id to all data tables ──────────────────────────────────────
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
  ALTER TABLE breakdown_reports ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE heat_pump_service_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE heat_pump_commissioning_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE oil_tank_inspections ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE oil_tank_risk_assessments ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE combustion_analysis_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE burner_setup_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE fire_valve_test_records ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE oil_line_vacuum_tests ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE job_completion_reports ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE lookup_options ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Backfill all NULL tenant_id to default tenant
UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE customers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE properties SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE appliances SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE jobs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE service_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE commissioning_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE job_notes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE file_attachments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE signatures SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE invite_codes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE breakdown_reports SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE heat_pump_service_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE heat_pump_commissioning_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE oil_tank_inspections SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE oil_tank_risk_assessments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE combustion_analysis_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE burner_setup_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE fire_valve_test_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE oil_line_vacuum_tests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE job_completion_reports SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE lookup_options SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Add NOT NULL constraints
DO $$ BEGIN ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE properties ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE appliances ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jobs ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE service_records ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE commissioning_records ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE job_notes ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE file_attachments ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE signatures ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE invite_codes ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE breakdown_reports ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE heat_pump_service_records ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE heat_pump_commissioning_records ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE oil_tank_inspections ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE oil_tank_risk_assessments ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE combustion_analysis_records ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE burner_setup_records ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE fire_valve_test_records ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE oil_line_vacuum_tests ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE job_completion_reports ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE lookup_options ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Indexes for tenant_id
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appliances_tenant ON appliances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_records_tenant ON service_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissioning_records_tenant ON commissioning_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_tenant ON job_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_tenant ON file_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant ON signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_tenant ON invite_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_tenant ON breakdown_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_heat_pump_service_records_tenant ON heat_pump_service_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_heat_pump_commissioning_records_tenant ON heat_pump_commissioning_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oil_tank_inspections_tenant ON oil_tank_inspections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oil_tank_risk_assessments_tenant ON oil_tank_risk_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_combustion_analysis_records_tenant ON combustion_analysis_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_burner_setup_records_tenant ON burner_setup_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fire_valve_test_records_tenant ON fire_valve_test_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oil_line_vacuum_tests_tenant ON oil_line_vacuum_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reports_tenant ON job_completion_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lookup_options_tenant ON lookup_options(tenant_id);

-- Helper function: get_user_tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id(uid UUID)
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 11. Tenant-aware RLS policies for existing data tables ───────────────────
-- Drop old broad policies and replace with tenant-scoped ones

-- Profiles: drop all legacy policies
DROP POLICY IF EXISTS "profiles_update" ON profiles;

DO $$ BEGIN
DROP POLICY IF EXISTS "profiles_tenant_select" ON profiles;
CREATE POLICY "profiles_tenant_select" ON profiles FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
DROP POLICY IF EXISTS "profiles_tenant_update" ON profiles;
CREATE POLICY "profiles_tenant_update" ON profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (get_user_role(auth.uid()) = 'admin' AND tenant_id = get_user_tenant_id(auth.uid()))
    OR get_user_role(auth.uid()) = 'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Customers: drop all legacy policies
DROP POLICY IF EXISTS "customers_all" ON customers;

DO $$ BEGIN
DROP POLICY IF EXISTS "customers_tenant" ON customers;
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
DROP POLICY IF EXISTS "properties_all" ON properties;

DO $$ BEGIN
DROP POLICY IF EXISTS "properties_tenant" ON properties;
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
DROP POLICY IF EXISTS "appliances_all" ON appliances;

DO $$ BEGIN
DROP POLICY IF EXISTS "appliances_tenant" ON appliances;
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
DROP POLICY IF EXISTS "jobs_all" ON jobs;

DO $$ BEGIN
DROP POLICY IF EXISTS "jobs_tenant" ON jobs;
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
DROP POLICY IF EXISTS "service_records_all" ON service_records;

DO $$ BEGIN
DROP POLICY IF EXISTS "service_records_tenant" ON service_records;
CREATE POLICY "service_records_tenant" ON service_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Commissioning records: drop all legacy policies
DROP POLICY IF EXISTS "commissioning_records_all" ON commissioning_records;

DO $$ BEGIN
DROP POLICY IF EXISTS "commissioning_records_tenant" ON commissioning_records;
CREATE POLICY "commissioning_records_tenant" ON commissioning_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job notes: drop all legacy policies
DROP POLICY IF EXISTS "job_notes_all" ON job_notes;

DO $$ BEGIN
DROP POLICY IF EXISTS "job_notes_tenant" ON job_notes;
CREATE POLICY "job_notes_tenant" ON job_notes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- File attachments: drop all legacy policies
DROP POLICY IF EXISTS "file_attachments_all" ON file_attachments;

DO $$ BEGIN
DROP POLICY IF EXISTS "file_attachments_tenant" ON file_attachments;
CREATE POLICY "file_attachments_tenant" ON file_attachments FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Signatures: drop all legacy policies
DROP POLICY IF EXISTS "signatures_all" ON signatures;

DO $$ BEGIN
DROP POLICY IF EXISTS "signatures_tenant" ON signatures;
CREATE POLICY "signatures_tenant" ON signatures FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invite codes: drop all legacy policies
DROP POLICY IF EXISTS "invite_codes_all" ON invite_codes;

DO $$ BEGIN
DROP POLICY IF EXISTS "invite_codes_tenant" ON invite_codes;
CREATE POLICY "invite_codes_tenant" ON invite_codes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Breakdown reports: drop all legacy policies
DROP POLICY IF EXISTS "breakdown_reports_all" ON breakdown_reports;

DO $$ BEGIN
DROP POLICY IF EXISTS "breakdown_reports_tenant" ON breakdown_reports;
CREATE POLICY "breakdown_reports_tenant" ON breakdown_reports FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Heat pump service records: drop all legacy policies
DROP POLICY IF EXISTS "heat_pump_service_records_all" ON heat_pump_service_records;

DO $$ BEGIN
DROP POLICY IF EXISTS "heat_pump_service_records_tenant" ON heat_pump_service_records;
CREATE POLICY "heat_pump_service_records_tenant" ON heat_pump_service_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Heat pump commissioning records: drop all legacy policies
DROP POLICY IF EXISTS "heat_pump_commissioning_records_all" ON heat_pump_commissioning_records;

DO $$ BEGIN
DROP POLICY IF EXISTS "heat_pump_commissioning_records_tenant" ON heat_pump_commissioning_records;
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
DROP POLICY IF EXISTS "Enable access for authenticated users" ON oil_tank_inspections;

DO $$ BEGIN
DROP POLICY IF EXISTS "oil_tank_inspections_tenant" ON oil_tank_inspections;
CREATE POLICY "oil_tank_inspections_tenant" ON oil_tank_inspections FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Oil tank risk assessments: drop all legacy policies
DROP POLICY IF EXISTS "Enable access for authenticated users" ON oil_tank_risk_assessments;

DO $$ BEGIN
DROP POLICY IF EXISTS "oil_tank_risk_assessments_tenant" ON oil_tank_risk_assessments;
CREATE POLICY "oil_tank_risk_assessments_tenant" ON oil_tank_risk_assessments FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Combustion analysis records: drop all legacy policies
DROP POLICY IF EXISTS "Enable access for authenticated users" ON combustion_analysis_records;

DO $$ BEGIN
DROP POLICY IF EXISTS "combustion_analysis_records_tenant" ON combustion_analysis_records;
CREATE POLICY "combustion_analysis_records_tenant" ON combustion_analysis_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Burner setup records: drop all legacy policies
DROP POLICY IF EXISTS "Enable access for authenticated users" ON burner_setup_records;

DO $$ BEGIN
DROP POLICY IF EXISTS "burner_setup_records_tenant" ON burner_setup_records;
CREATE POLICY "burner_setup_records_tenant" ON burner_setup_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fire valve test records: drop all legacy policies
DROP POLICY IF EXISTS "Enable access for authenticated users" ON fire_valve_test_records;

DO $$ BEGIN
DROP POLICY IF EXISTS "fire_valve_test_records_tenant" ON fire_valve_test_records;
CREATE POLICY "fire_valve_test_records_tenant" ON fire_valve_test_records FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Oil line vacuum tests: drop all legacy policies
DROP POLICY IF EXISTS "Enable access for authenticated users" ON oil_line_vacuum_tests;

DO $$ BEGIN
DROP POLICY IF EXISTS "oil_line_vacuum_tests_tenant" ON oil_line_vacuum_tests;
CREATE POLICY "oil_line_vacuum_tests_tenant" ON oil_line_vacuum_tests FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job completion reports: drop all legacy policies
DROP POLICY IF EXISTS "Enable access for authenticated users" ON job_completion_reports;

DO $$ BEGIN
DROP POLICY IF EXISTS "job_completion_reports_tenant" ON job_completion_reports;
CREATE POLICY "job_completion_reports_tenant" ON job_completion_reports FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Lookup options: drop all legacy policies
DROP POLICY IF EXISTS "Enable access for authenticated users" ON lookup_options;

DO $$ BEGIN
DROP POLICY IF EXISTS "lookup_options_tenant" ON lookup_options;
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
DROP POLICY IF EXISTS "tenant_subscriptions_super_admin" ON tenant_subscriptions;
CREATE POLICY "tenant_subscriptions_super_admin" ON tenant_subscriptions FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
DROP POLICY IF EXISTS "tenant_subscriptions_own" ON tenant_subscriptions;
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

-- ─── 15. Custom Job Types ────────────────────────────────────────────────────────
-- job_types rows are stored in the application (Drizzle/PostgreSQL) database,
-- not in Supabase, because they are tenant-managed via the API server.
-- The schema is reproduced here for documentation and parity.
--
-- Application DB schema (Drizzle/PostgreSQL):
--   CREATE TABLE job_types (
--     id SERIAL PRIMARY KEY,
--     tenant_id TEXT NOT NULL,
--     name TEXT NOT NULL,
--     slug TEXT NOT NULL,
--     category TEXT NOT NULL DEFAULT 'service',
--     color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
--     default_duration_minutes INTEGER,
--     is_active BOOLEAN NOT NULL DEFAULT true,
--     is_default BOOLEAN NOT NULL DEFAULT false,
--     sort_order INTEGER NOT NULL DEFAULT 0,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--   );
--   CREATE INDEX idx_job_types_tenant ON job_types(tenant_id);

-- Add job_type_id to jobs (references job_types.id in the application DB;
-- no FK constraint here since job_types lives in a separate database)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_jobs_job_type_id ON jobs(job_type_id);

-- =============================================================================
-- Section 16: Multi-day job support
-- =============================================================================
-- Adds scheduled_end_date column to the jobs table.
-- When null (or equal to scheduled_date), the job is treated as a single-day job.
-- When set to a later date, the job spans from scheduled_date to scheduled_end_date.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;

DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT chk_job_end_date
    CHECK (scheduled_end_date IS NULL OR scheduled_end_date >= scheduled_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_end ON jobs(scheduled_end_date)
  WHERE scheduled_end_date IS NOT NULL;

-- =============================================================================
-- Section 17: Fix company_settings unique constraint for multi-tenant
-- =============================================================================
-- The original constraint was UNIQUE (singleton_id) which only allows one row
-- globally. After tenant_id was added, it must be UNIQUE (singleton_id, tenant_id)
-- so each tenant can maintain their own settings.
ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS company_settings_singleton;

DO $$ BEGIN
  ALTER TABLE company_settings
    ADD CONSTRAINT company_settings_singleton UNIQUE (singleton_id, tenant_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Section 18: Add rates_url and trading_terms_url to company_settings
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE company_settings ADD COLUMN rates_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE company_settings ADD COLUMN trading_terms_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- =============================================================================
-- Section 19: Add Free plan for freemium tier
-- =============================================================================
INSERT INTO plans (id, name, description, monthly_price, annual_price, max_users, max_jobs_per_month, sort_order, features)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Free',
  'Free forever plan with basic job management',
  0, 0, 1, 5, 0,
  '{"job_management": true, "scheduling": true, "heat_pump_forms": false, "combustion_analysis": false, "reports": false, "api_access": false, "invoicing": false, "team_management": false, "social_media": false, "oil_tank_forms": false, "commissioning_forms": false, "custom_branding": false, "priority_support": false}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Section 20: Follow-Ups table for tracking jobs awaiting parts / return visits
-- =============================================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  work_description TEXT,
  parts_description TEXT,
  expected_parts_date DATE,
  status TEXT NOT NULL DEFAULT 'awaiting_parts'
    CHECK (status IN ('awaiting_parts', 'parts_arrived', 'booked', 'cancelled')),
  new_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_tenant ON follow_ups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_original_job ON follow_ups(original_job_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_expected_date ON follow_ups(tenant_id, expected_parts_date)
  WHERE status = 'awaiting_parts';

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follow_ups_tenant_isolation" ON follow_ups;
CREATE POLICY "follow_ups_tenant_isolation" ON follow_ups
  FOR ALL
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
    )
  );
