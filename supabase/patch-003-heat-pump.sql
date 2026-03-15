-- Patch 003: Heat Pump Support
-- Run this in your Supabase SQL Editor for existing databases

-- Add heat_pump to fuel_type enum
ALTER TYPE fuel_type ADD VALUE IF NOT EXISTS 'heat_pump';

-- Add heat pump system types to boiler_type enum
ALTER TYPE boiler_type ADD VALUE IF NOT EXISTS 'ashp';
ALTER TYPE boiler_type ADD VALUE IF NOT EXISTS 'gshp';
ALTER TYPE boiler_type ADD VALUE IF NOT EXISTS 'wshp';

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

-- Add technician_name_signed if table already existed
ALTER TABLE heat_pump_service_records ADD COLUMN IF NOT EXISTS technician_name_signed TEXT;

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

-- Add technician_name_signed if table already existed
ALTER TABLE heat_pump_commissioning_records ADD COLUMN IF NOT EXISTS technician_name_signed TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_heat_pump_service_records_job ON heat_pump_service_records(job_id);
CREATE INDEX IF NOT EXISTS idx_heat_pump_commissioning_records_job ON heat_pump_commissioning_records(job_id);

-- Triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at'
    AND tgrelid = 'heat_pump_service_records'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON heat_pump_service_records
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at'
    AND tgrelid = 'heat_pump_commissioning_records'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON heat_pump_commissioning_records
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Row Level Security
ALTER TABLE heat_pump_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE heat_pump_commissioning_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent via DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'heat_pump_service_records' AND policyname = 'heat_pump_service_records_select'
  ) THEN
    CREATE POLICY "heat_pump_service_records_select" ON heat_pump_service_records FOR SELECT TO authenticated
      USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'heat_pump_service_records' AND policyname = 'heat_pump_service_records_insert'
  ) THEN
    CREATE POLICY "heat_pump_service_records_insert" ON heat_pump_service_records FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'heat_pump_service_records' AND policyname = 'heat_pump_service_records_update'
  ) THEN
    CREATE POLICY "heat_pump_service_records_update" ON heat_pump_service_records FOR UPDATE TO authenticated
      USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'heat_pump_commissioning_records' AND policyname = 'heat_pump_commissioning_records_select'
  ) THEN
    CREATE POLICY "heat_pump_commissioning_records_select" ON heat_pump_commissioning_records FOR SELECT TO authenticated
      USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'heat_pump_commissioning_records' AND policyname = 'heat_pump_commissioning_records_insert'
  ) THEN
    CREATE POLICY "heat_pump_commissioning_records_insert" ON heat_pump_commissioning_records FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'heat_pump_commissioning_records' AND policyname = 'heat_pump_commissioning_records_update'
  ) THEN
    CREATE POLICY "heat_pump_commissioning_records_update" ON heat_pump_commissioning_records FOR UPDATE TO authenticated
      USING (get_user_role(auth.uid()) IN ('admin', 'office_staff') OR technician_id = auth.uid());
  END IF;
END $$;
