-- patch-054: Invoicing provider preference
-- Allows companies to choose between native TWD invoicing or external (Zoho/Xero etc).
-- Values: 'native' | 'external'  (default: 'native')

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS invoicing_provider VARCHAR(20) NOT NULL DEFAULT 'native';
