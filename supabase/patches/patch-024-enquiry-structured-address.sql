-- Patch 024: Add structured address fields to enquiries table
ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Backfill address_line1 from legacy address field where not already set
UPDATE enquiries SET address_line1 = address WHERE address IS NOT NULL AND address_line1 IS NULL;
