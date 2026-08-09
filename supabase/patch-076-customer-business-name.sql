-- patch-076: add optional business_name to customers for B2B contact records

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS business_name TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_tenant_business_name_active
  ON customers (tenant_id, business_name)
  WHERE is_active = true;
