-- Add oil_pressure field to service_records for oil boiler service forms
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS oil_pressure TEXT;
