-- Patch 054: Add small bundle support to usage-based addons
-- Allows addons to offer a smaller starter bundle alongside the standard bundle.
-- Adds small_bundle_size and small_bundle_price columns to addons table.

ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS small_bundle_size integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS small_bundle_price numeric(10,2) DEFAULT NULL;

-- Set the £10 starter bundle for AI Blog Writing
UPDATE addons
SET small_bundle_size = 1000,
    small_bundle_price = 10.00
WHERE 'ai_blog_writing' = ANY(feature_keys);
