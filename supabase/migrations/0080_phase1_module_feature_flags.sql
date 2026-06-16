-- Migration 0080: Phase 1 - Module feature flags and tenant source tracking
-- Adds:
--   - website_builder and job_management feature flags to existing plans
--   - source column to tenants (which product they signed up via)
--   - is_legacy flag default fix

-- ─── 1. Add module feature flags to all existing plans ────────────────────────
-- These keys let requirePlanFeature() gate routes per product module.
-- Existing plans: add both flags as true (they already have access).
-- New plans created via the platform admin UI should set these explicitly.

UPDATE plans
SET features = features
  || jsonb_build_object('job_management', true)
  || jsonb_build_object('website_builder', false)
WHERE features -> 'job_management' IS NULL;

-- ─── 2. Add source column to tenants ─────────────────────────────────────────
-- Tracks which product/brand a tenant signed up through.
-- 'tradeworkdesk' = job management product
-- 'tradesite'     = website builder product  
-- 'bundle'        = both products together

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'tradeworkdesk'
  CHECK (source IN ('tradeworkdesk', 'tradesite', 'bundle'));

-- Backfill: existing tenants came through TradeWorkDesk
UPDATE tenants SET source = 'tradeworkdesk' WHERE source IS NULL OR source = '';

-- ─── 3. Ensure plans table has the new feature keys as columns in features JSONB
-- (No schema change needed — already JSONB. This comment documents the expected keys.)
-- Expected plan features keys:
--   job_management    boolean  — access to TradeWorkDesk job management module
--   website_builder   boolean  — access to website builder / CMS module
--   social_media      boolean  — social media scheduling module
--   team_management   boolean  — multi-user team features
--   invoicing         boolean  — invoicing and billing features
--   reports           boolean  — analytics and reporting
--   heat_pump_forms   boolean  — heat pump service / commissioning forms
--   oil_tank_forms    boolean  — oil tank inspection forms
--   commissioning_forms boolean
--   combustion_analysis boolean
--   scheduling        boolean  — calendar and diary features
--   geo_mapping       boolean  — map views and postcode lookup
--   custom_branding   boolean  — logo/colour customisation
--   priority_support  boolean  — priority support tier
--   todo_list         boolean  — technician todo lists
--   api_access        boolean  — external API access
