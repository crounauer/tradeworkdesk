-- Fix: invoices_enabled was defaulting to FALSE, blocking all invoice access.
-- Set all existing company_settings rows to enabled, and change the column default to TRUE.

UPDATE company_settings
SET invoices_enabled = TRUE
WHERE invoices_enabled = FALSE OR invoices_enabled IS NULL;

ALTER TABLE company_settings
  ALTER COLUMN invoices_enabled SET DEFAULT TRUE;
