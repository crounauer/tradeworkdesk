-- Migration 0155: Manufacturer affiliation and training entries for public directory profiles.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS manufacturer_affiliations JSONB NOT NULL DEFAULT '[]'::jsonb;
