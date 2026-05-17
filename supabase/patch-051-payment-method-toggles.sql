-- patch-051: Per-provider payment enable/disable toggles in company_settings
-- Allows tenants to turn Stripe card payments and GoCardless bank payments on or off
-- independently without disconnecting the provider.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS stripe_payments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gocardless_payments_enabled BOOLEAN NOT NULL DEFAULT TRUE;
