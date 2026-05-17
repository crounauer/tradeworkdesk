-- patch-047: Add Extra Photo Storage addon + retire standalone photo_storage addon
--
-- Background: Photo storage (500 GB) is now included free in the base plan.
-- The old photo_storage addon gate has been removed from code.
-- Tenants who need more than 500 GB can purchase the Extra Photo Storage addon.
--
-- Extra Photo Storage: +500 GB (total 1 TB) for £4.99/month  |  £49.99/year
-- Feature key: extra_photo_storage

-- 1. Deactivate the old standalone photo_storage addon (no longer needed — included in base plan)
UPDATE addons
SET is_active = false
WHERE name = 'Job Photo Storage'
  AND 'photo_storage' = ANY(feature_keys);

-- 2. Insert the new Extra Photo Storage addon (idempotent)
INSERT INTO addons (
  name,
  description,
  feature_keys,
  monthly_price,
  annual_price,
  is_active,
  is_per_seat,
  sort_order
)
SELECT
  'Extra Photo Storage',
  'Increase your photo storage from 500 GB to 1 TB. Ideal for busy engineers uploading multiple photos per job.',
  ARRAY['extra_photo_storage'],
  4.99,
  49.99,
  true,
  false,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM addons)
WHERE NOT EXISTS (
  SELECT 1 FROM addons WHERE name = 'Extra Photo Storage'
);
