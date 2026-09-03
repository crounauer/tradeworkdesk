ALTER TABLE burner_setup_records
  ADD COLUMN IF NOT EXISTS appliance_installation_date date,
  ADD COLUMN IF NOT EXISTS appliance_warranty_expiry date,
  ADD COLUMN IF NOT EXISTS appliance_next_service_due date,
  ADD COLUMN IF NOT EXISTS appliance_notes text;