-- Tenant-configurable customer job reminder emails.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS job_reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS job_reminder_lead_days INTEGER[] NOT NULL DEFAULT ARRAY[7, 1],
  ADD COLUMN IF NOT EXISTS job_reminder_time_uk VARCHAR(5) NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS job_reminder_weekdays_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS automated_job_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  lead_days INTEGER NOT NULL,
  target_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, job_id, lead_days, target_date)
);

CREATE INDEX IF NOT EXISTS automated_job_reminder_log_tenant_date_idx
  ON automated_job_reminder_log(tenant_id, target_date);

ALTER TABLE service_reminder_settings
  ADD COLUMN IF NOT EXISTS send_time_uk VARCHAR(5) NOT NULL DEFAULT '09:00';
