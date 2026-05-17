-- patch-048: Convert Extra Photo Storage to per-GB usage billing (£4.99/GB, billed in advance)
--
-- Previously the addon was a fixed monthly subscription (£4.99/mo for +500 GB).
-- Now it uses the same credit/advance-payment model as SMS and UK Address Lookup:
--   - 0–500 GB: free with base plan
--   - Each extra GB: £4.99/month, purchased upfront
--   - Storage limit = 500 GB base + purchased GB credits
--
-- Run this AFTER patch-047 (which created the extra_photo_storage addon).

UPDATE addons
SET billing_model      = 'usage',
    usage_unit_label   = 'GB',
    usage_bundle_size  = 1,
    usage_bundle_price = 4.99,
    monthly_price      = 0.00,
    annual_price       = 0.00,
    description        = 'Purchase extra photo storage in 1 GB increments, billed in advance at £4.99/GB/month. Your base plan includes 500 GB free.'
WHERE name = 'Extra Photo Storage'
  AND 'extra_photo_storage' = ANY(feature_keys);
