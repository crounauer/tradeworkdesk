-- Phase 5: White-Label Branding
-- Adds brand customisation columns to company_settings.
-- company_settings already has tenant_id, logo_url, logo_storage_path.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS white_label_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_name           TEXT,
  ADD COLUMN IF NOT EXISTS primary_color        TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS accent_color         TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url          TEXT,
  ADD COLUMN IF NOT EXISTS email_from_name      TEXT,
  ADD COLUMN IF NOT EXISTS email_reply_to       TEXT;

COMMENT ON COLUMN company_settings.white_label_enabled IS
  'When true, the app displays brand_name + primary_color instead of TradeWorkDesk defaults.';
COMMENT ON COLUMN company_settings.brand_name IS
  'Replaces "TradeWorkDesk" in the sidebar and browser title when white_label_enabled = true.';
COMMENT ON COLUMN company_settings.primary_color IS
  'Hex colour (e.g. #6366f1) applied to primary UI elements when white_label_enabled = true.';
COMMENT ON COLUMN company_settings.accent_color IS
  'Optional secondary accent hex colour for highlights.';
COMMENT ON COLUMN company_settings.favicon_url IS
  'URL of a custom favicon. Swapped into <link rel="icon"> when white_label_enabled = true.';
COMMENT ON COLUMN company_settings.email_from_name IS
  'Name shown in the "From" field of emails sent to customers (e.g. "Acme Heating").';
COMMENT ON COLUMN company_settings.email_reply_to IS
  'Reply-to email address for outbound customer emails.';
