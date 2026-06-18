-- Patch 026: Add website enquiry notification settings to company_settings
-- Allows admins to control whether they get email/SMS alerts for new website form submissions.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS website_enquiry_email_notify boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS website_enquiry_sms_notify   boolean NOT NULL DEFAULT false;

-- Back-fill: existing tenants keep email on (already the default behaviour)
UPDATE company_settings SET website_enquiry_email_notify = true WHERE website_enquiry_email_notify IS NULL;
UPDATE company_settings SET website_enquiry_sms_notify   = false WHERE website_enquiry_sms_notify IS NULL;
