-- Patch 052: Website postcode coverage settings
-- Stores a simple coverage radius on company_settings so the website Areas block
-- can check whether a visitor's postcode is within range.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS coverage_radius_miles INTEGER;
