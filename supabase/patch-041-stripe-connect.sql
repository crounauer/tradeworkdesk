-- patch-041: Stripe Connect per-tenant payment processing
-- Allows each tenant to connect their own Stripe account so customers
-- can pay invoices directly. Funds go straight to the tenant's bank.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT false;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
