-- Oil service record columns only
-- Safe to run on production after the base schema exists.

ALTER TABLE service_records ADD COLUMN IF NOT EXISTS appliance_make TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS appliance_manufacturer_date DATE;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS appliance_model TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS appliance_serial TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS appliance_type TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS appliance_output TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS appliance_location_within_property TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS burner_make_model TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS fuel_supply_type_details TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS burner_oring TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS heat_exchanger_cleaned_tb BOOLEAN DEFAULT false;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS heat_exchanger_turbulators TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS blast_nozzle_size TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS blast_nozzle_replaced BOOLEAN DEFAULT false;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS blast_electrode_settings_checked BOOLEAN DEFAULT false;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS blast_electrode_settings_text TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS blast_oring_replaced BOOLEAN DEFAULT false;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS electronics_controlbox TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS capacitor_value TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS capacitor_actual_reading TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS motor_text TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS solenoid_notes TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS control_panel_notes TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS prv_notes TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS oil_hoses_notes TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS combustion_chamber_baffles TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS rope_seal_gasket_comments TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS condensate_cleaned_tb BOOLEAN DEFAULT false;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS condensate_condition TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS oil_pump_pressure TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS solenoid_checked BOOLEAN DEFAULT false;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS electrodes_condition TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS electrode_settings TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS air_setting TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS blast_tube_condition TEXT;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS overall_condition_remarks TEXT;
