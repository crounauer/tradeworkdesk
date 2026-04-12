ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS fuel_category TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_fuel_category_check'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_fuel_category_check
      CHECK (fuel_category IS NULL OR fuel_category IN ('gas', 'oil', 'heat_pump', 'general'));
  END IF;
END $$;
