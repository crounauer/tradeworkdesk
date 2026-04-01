-- Patch 021: Create 6 missing form tables
-- Tables: burner_setup_records, combustion_analysis_records, fire_valve_test_records,
--         oil_line_vacuum_tests, oil_tank_inspections, oil_tank_risk_assessments

-- 1. Burner Setup Records
CREATE TABLE IF NOT EXISTS burner_setup_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  burner_manufacturer TEXT,
  burner_model TEXT,
  burner_serial_number TEXT,
  nozzle_size TEXT,
  nozzle_type TEXT,
  nozzle_angle TEXT,
  pump_pressure TEXT,
  pump_vacuum TEXT,
  electrode_gap TEXT,
  electrode_position TEXT,
  air_damper_setting TEXT,
  head_setting TEXT,
  combustion_co2 TEXT,
  combustion_co TEXT,
  combustion_smoke TEXT,
  combustion_efficiency TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_burner_setup_records_job_id ON burner_setup_records(job_id);
CREATE INDEX IF NOT EXISTS idx_burner_setup_records_tenant ON burner_setup_records(tenant_id);
ALTER TABLE burner_setup_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "burner_setup_records_tenant" ON burner_setup_records;
CREATE POLICY "burner_setup_records_tenant" ON burner_setup_records FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);

-- 2. Combustion Analysis Records
CREATE TABLE IF NOT EXISTS combustion_analysis_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  co2_reading TEXT,
  co_reading TEXT,
  o2_reading TEXT,
  flue_temperature TEXT,
  ambient_temperature TEXT,
  efficiency TEXT,
  excess_air TEXT,
  smoke_number TEXT,
  ambient_co TEXT,
  draft_reading TEXT,
  instrument_make TEXT,
  instrument_model TEXT,
  instrument_serial TEXT,
  calibration_date TEXT,
  pass_fail TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combustion_analysis_records_job_id ON combustion_analysis_records(job_id);
CREATE INDEX IF NOT EXISTS idx_combustion_analysis_records_tenant ON combustion_analysis_records(tenant_id);
ALTER TABLE combustion_analysis_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "combustion_analysis_records_tenant" ON combustion_analysis_records;
CREATE POLICY "combustion_analysis_records_tenant" ON combustion_analysis_records FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);

-- 3. Fire Valve Test Records
CREATE TABLE IF NOT EXISTS fire_valve_test_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  valve_location TEXT,
  valve_type TEXT,
  valve_manufacturer TEXT,
  test_date TEXT,
  test_method TEXT,
  test_result TEXT,
  response_time TEXT,
  reset_successful BOOLEAN DEFAULT FALSE,
  remedial_action TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fire_valve_test_records_job_id ON fire_valve_test_records(job_id);
CREATE INDEX IF NOT EXISTS idx_fire_valve_test_records_tenant ON fire_valve_test_records(tenant_id);
ALTER TABLE fire_valve_test_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fire_valve_test_records_tenant" ON fire_valve_test_records;
CREATE POLICY "fire_valve_test_records_tenant" ON fire_valve_test_records FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);

-- 4. Oil Line Vacuum Tests
CREATE TABLE IF NOT EXISTS oil_line_vacuum_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipe_size TEXT,
  pipe_material TEXT,
  pipe_length TEXT,
  number_of_joints TEXT,
  initial_vacuum TEXT,
  vacuum_after_5_min TEXT,
  vacuum_after_10_min TEXT,
  allowable_drop TEXT,
  actual_drop TEXT,
  pass_fail TEXT,
  remedial_action TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oil_line_vacuum_tests_job_id ON oil_line_vacuum_tests(job_id);
CREATE INDEX IF NOT EXISTS idx_oil_line_vacuum_tests_tenant2 ON oil_line_vacuum_tests(tenant_id);
ALTER TABLE oil_line_vacuum_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oil_line_vacuum_tests_tenant" ON oil_line_vacuum_tests;
CREATE POLICY "oil_line_vacuum_tests_tenant" ON oil_line_vacuum_tests FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);

-- 5. Oil Tank Inspections
CREATE TABLE IF NOT EXISTS oil_tank_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tank_type TEXT,
  tank_size TEXT,
  tank_material TEXT,
  tank_location TEXT,
  tank_age TEXT,
  bunding_type TEXT,
  bunding_condition TEXT,
  sight_gauge_condition TEXT,
  fill_point_condition TEXT,
  vent_condition TEXT,
  filter_condition TEXT,
  pipework_condition TEXT,
  supports_condition TEXT,
  overall_condition TEXT,
  leaks_found BOOLEAN DEFAULT FALSE,
  leaks_details TEXT,
  remedial_actions TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oil_tank_inspections_job_id ON oil_tank_inspections(job_id);
CREATE INDEX IF NOT EXISTS idx_oil_tank_inspections_tenant ON oil_tank_inspections(tenant_id);
ALTER TABLE oil_tank_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oil_tank_inspections_tenant" ON oil_tank_inspections;
CREATE POLICY "oil_tank_inspections_tenant" ON oil_tank_inspections FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);

-- 6. Oil Tank Risk Assessments
CREATE TABLE IF NOT EXISTS oil_tank_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_hazards TEXT,
  environmental_risks TEXT,
  fire_risk TEXT,
  access_risk TEXT,
  likelihood_rating TEXT,
  severity_rating TEXT,
  overall_risk_rating TEXT,
  control_measures TEXT,
  further_actions_required TEXT,
  assessor_name TEXT,
  assessor_qualification TEXT,
  assessment_date TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oil_tank_risk_assessments_job_id ON oil_tank_risk_assessments(job_id);
CREATE INDEX IF NOT EXISTS idx_oil_tank_risk_assessments_tenant ON oil_tank_risk_assessments(tenant_id);
ALTER TABLE oil_tank_risk_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oil_tank_risk_assessments_tenant" ON oil_tank_risk_assessments;
CREATE POLICY "oil_tank_risk_assessments_tenant" ON oil_tank_risk_assessments FOR ALL TO authenticated
  USING (tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id')::UUID);
