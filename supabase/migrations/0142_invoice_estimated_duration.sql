-- Store customer-facing estimated job duration separately from actual time attended.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS estimated_duration_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS estimated_duration_unit TEXT;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_estimated_duration_unit_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_estimated_duration_unit_check
  CHECK (estimated_duration_unit IS NULL OR estimated_duration_unit IN ('hours', 'days'));
