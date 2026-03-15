-- Boiler Service Technician App - Supabase Migration
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'office_staff', 'technician');
CREATE TYPE job_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'requires_follow_up');
CREATE TYPE job_type AS ENUM ('service', 'breakdown', 'installation', 'inspection', 'follow_up');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE property_type AS ENUM ('residential', 'commercial', 'industrial');
CREATE TYPE occupancy_type AS ENUM ('owner_occupied', 'tenant', 'landlord', 'vacant', 'holiday_let');
CREATE TYPE fuel_type AS ENUM ('oil', 'gas', 'lpg', 'electric', 'solid_fuel', 'other');
CREATE TYPE boiler_type AS ENUM ('combi', 'system', 'regular', 'back_boiler', 'other');
CREATE TYPE system_type AS ENUM ('open_vented', 'sealed', 'gravity_fed', 'pressurised', 'other');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
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
CREATE TABLE customers (
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
CREATE TABLE properties (
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
  boiler_location TEXT,
  flue_location TEXT,
  tank_location TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Appliances table
CREATE TABLE appliances (
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
CREATE TABLE jobs (
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
CREATE TABLE service_records (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Breakdown Reports table
CREATE TABLE breakdown_reports (
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
CREATE TABLE job_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File Attachments table
CREATE TABLE file_attachments (
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
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  signer_type TEXT NOT NULL CHECK (signer_type IN ('technician', 'customer')),
  signer_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_name ON customers(last_name, first_name);
CREATE INDEX idx_customers_postcode ON customers(postcode);
CREATE INDEX idx_properties_customer ON properties(customer_id);
CREATE INDEX idx_properties_postcode ON properties(postcode);
CREATE INDEX idx_appliances_property ON appliances(property_id);
CREATE INDEX idx_appliances_serial ON appliances(serial_number);
CREATE INDEX idx_appliances_next_due ON appliances(next_service_due);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_property ON jobs(property_id);
CREATE INDEX idx_jobs_technician ON jobs(assigned_technician_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_date);
CREATE INDEX idx_jobs_type ON jobs(job_type);
CREATE INDEX idx_service_records_job ON service_records(job_id);
CREATE INDEX idx_breakdown_reports_job ON breakdown_reports(job_id);
CREATE INDEX idx_job_notes_job ON job_notes(job_id);
CREATE INDEX idx_file_attachments_entity ON file_attachments(entity_type, entity_id);
CREATE INDEX idx_signatures_job ON signatures(job_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appliances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON service_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON breakdown_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'technician')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE appliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Customers: all authenticated users can read, admin/office can write
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Properties: same as customers
CREATE POLICY "properties_select" ON properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "properties_insert" ON properties FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
CREATE POLICY "properties_update" ON properties FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
CREATE POLICY "properties_delete" ON properties FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Appliances: same as customers
CREATE POLICY "appliances_select" ON appliances FOR SELECT TO authenticated USING (true);
CREATE POLICY "appliances_insert" ON appliances FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician'));
CREATE POLICY "appliances_update" ON appliances FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician'));
CREATE POLICY "appliances_delete" ON appliances FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Jobs: technicians see their own, admin/office see all
CREATE POLICY "jobs_select_admin_office" ON jobs FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR assigned_technician_id = auth.uid());
CREATE POLICY "jobs_insert" ON jobs FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'office_staff'));
CREATE POLICY "jobs_update" ON jobs FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR assigned_technician_id = auth.uid());
CREATE POLICY "jobs_delete" ON jobs FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- Service Records: technicians see their own, admin/office see all
CREATE POLICY "service_records_select" ON service_records FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
CREATE POLICY "service_records_insert" ON service_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_records_update" ON service_records FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());

-- Breakdown Reports: same as service records
CREATE POLICY "breakdown_reports_select" ON breakdown_reports FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
CREATE POLICY "breakdown_reports_insert" ON breakdown_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "breakdown_reports_update" ON breakdown_reports FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());

-- Job Notes: all authenticated can read and create
CREATE POLICY "job_notes_select" ON job_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_notes_insert" ON job_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "job_notes_update" ON job_notes FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "job_notes_delete" ON job_notes FOR DELETE TO authenticated USING (author_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- File Attachments: all authenticated can read and upload
CREATE POLICY "file_attachments_select" ON file_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "file_attachments_insert" ON file_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "file_attachments_delete" ON file_attachments FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- Signatures: all authenticated can read and create
CREATE POLICY "signatures_select" ON signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "signatures_insert" ON signatures FOR INSERT TO authenticated WITH CHECK (true);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('service-photos', 'service-photos', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('service-documents', 'service-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "auth_upload_photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-photos');
CREATE POLICY "auth_read_photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'service-photos');
CREATE POLICY "auth_delete_photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'service-photos');

CREATE POLICY "auth_upload_docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-documents');
CREATE POLICY "auth_read_docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'service-documents');
CREATE POLICY "auth_delete_docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'service-documents');

CREATE POLICY "auth_upload_sigs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
CREATE POLICY "auth_read_sigs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signatures');
