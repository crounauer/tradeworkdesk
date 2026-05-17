-- patch-046: Add Job Photo Storage addon
-- Lets tenants attach and view photos on job records.
-- Feature key: photo_storage
-- Price: £3.99/month  |  £39.99/year

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
  'Job Photo Storage',
  'Attach before/after photos, fault evidence and boiler labels directly to job records. Upload from the field using your phone camera.',
  ARRAY['photo_storage'],
  3.99,
  39.99,
  true,
  false,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM addons)
WHERE NOT EXISTS (
  SELECT 1 FROM addons WHERE name = 'Job Photo Storage'
);
