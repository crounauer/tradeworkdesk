-- patch-040: Add payment_link_url to company_settings
-- Allows tenants to specify a payment link (e.g. Stripe, PayPal) shown to
-- customers as a "Pay Now" button on portal invoices.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT;
