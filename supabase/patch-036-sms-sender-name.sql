-- patch-036: Add SMS sender name to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS sms_sender_name TEXT;
