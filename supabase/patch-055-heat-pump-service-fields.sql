-- Patch 055: Heat Pump Service Record - new service fields
-- Adds: PRV check, expansion vessel charge, glycol details,
--       anti-freeze valves, inhibitor, fungicide, evaporator cleaned

ALTER TABLE heat_pump_service_records
  ADD COLUMN IF NOT EXISTS prv_checked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expansion_vessel_charge TEXT,
  ADD COLUMN IF NOT EXISTS glycol BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS glycol_temp_rating TEXT,
  ADD COLUMN IF NOT EXISTS anti_freeze_valves BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS inhibitor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fungicide BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS evaporator_cleaned BOOLEAN DEFAULT false;
