-- patch-050: Add stripe_pass_charges_to_customer to company_settings
-- Allows tenants to pass Stripe card processing fees on to the customer.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS stripe_pass_charges_to_customer BOOLEAN NOT NULL DEFAULT FALSE;
