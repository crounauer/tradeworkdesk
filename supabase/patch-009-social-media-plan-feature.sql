-- Patch 009: Add social_media feature flag to plans
-- Run this in your Supabase SQL Editor on any existing database.
-- All statements are idempotent (safe to run more than once).

-- ─── 1. Add social_media:false to every plan that is missing the key ───────────

UPDATE plans
SET features = jsonb_set(features, '{social_media}', 'false'::jsonb, true)
WHERE features IS NOT NULL
  AND (features -> 'social_media') IS NULL;

-- Also handle plans with a NULL features column (edge case)
UPDATE plans
SET features = '{"social_media": false}'::jsonb
WHERE features IS NULL;

-- ─── 2. Enable social_media for Professional-tier plans ─────────────────────────

UPDATE plans
SET features = jsonb_set(features, '{social_media}', 'true'::jsonb, true)
WHERE LOWER(name) LIKE '%professional%';

-- ─── 3. Enable social_media for Enterprise-tier plans ───────────────────────────

UPDATE plans
SET features = jsonb_set(features, '{social_media}', 'true'::jsonb, true)
WHERE LOWER(name) LIKE '%enterprise%';
