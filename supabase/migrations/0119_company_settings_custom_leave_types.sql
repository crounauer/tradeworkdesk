ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS custom_leave_types TEXT[] DEFAULT NULL;
