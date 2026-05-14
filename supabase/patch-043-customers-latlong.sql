-- patch-043: Add latitude/longitude to customers table
-- The customer add/edit form geocodes the address and attempts to save
-- coordinates alongside the customer record, but these columns were missing.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
