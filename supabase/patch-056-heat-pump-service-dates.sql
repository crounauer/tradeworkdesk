-- Patch 056: Allow heat pump service dates to be entered and edited manually

ALTER TABLE heat_pump_service_records
  ADD COLUMN IF NOT EXISTS service_date DATE,
  ADD COLUMN IF NOT EXISTS next_service_due DATE;