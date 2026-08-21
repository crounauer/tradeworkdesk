-- Allow admins to receive an operational company-wide summary even when they have no assigned jobs.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS technician_daily_summary_admin_scope VARCHAR(20) NOT NULL DEFAULT 'company';

ALTER TABLE company_settings
  DROP CONSTRAINT IF EXISTS company_settings_technician_daily_summary_admin_scope_check;

ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_technician_daily_summary_admin_scope_check
  CHECK (technician_daily_summary_admin_scope IN ('none', 'company'));
