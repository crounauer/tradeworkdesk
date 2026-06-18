-- patch-057: Support multiple tenant notification email addresses
-- Stores additional recipient emails to CC on customer-facing outbound emails.

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS notification_emails TEXT[] DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN company_settings.notification_emails IS
  'Additional tenant email addresses (CC) for outbound customer-facing emails.';
