-- Patch 030: Public business directory listing fields
-- Adds opt-in public listing to company_settings so businesses can appear
-- on the /find directory and get their own public profile page.

-- Listing toggle
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS is_publicly_listed BOOLEAN NOT NULL DEFAULT FALSE;

-- Short public description (shown on directory card and profile page)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS public_description TEXT;

-- Comma-separated trade types e.g. 'Gas Engineer, Boiler Service, Oil Heating'
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS trade_types TEXT;

-- Service area description e.g. 'Aberdeen & Aberdeenshire' or 'Within 30 miles of AB1'
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS service_area TEXT;

-- URL-friendly slug used for /find/:slug — must be unique across all tenants
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS listing_slug TEXT;

-- Unique constraint on slug (only enforced when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_listing_slug
  ON company_settings(listing_slug)
  WHERE listing_slug IS NOT NULL;

-- Index to quickly fetch all publicly listed businesses
CREATE INDEX IF NOT EXISTS idx_company_settings_public
  ON company_settings(is_publicly_listed)
  WHERE is_publicly_listed = TRUE;
