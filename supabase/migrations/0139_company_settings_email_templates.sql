-- Migration 0139: tenant email template overrides

ALTER TABLE IF EXISTS company_settings
  ADD COLUMN IF NOT EXISTS email_templates JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN company_settings.email_templates IS
  'Tenant-managed email template overrides keyed by template id, e.g. enquiry_acknowledgement, job_confirmation, portal_invite, booking_pending_approval.';