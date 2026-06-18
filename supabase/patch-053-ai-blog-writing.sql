-- Patch 053: AI Blog Writing addon
-- Adds a usage-based AI Blog Writing addon so tenants can purchase AI credits
-- (in £25 bundles = 2500 credits, where 1 credit = £0.01) to use AI assistance
-- when writing website blog posts. Usage is charged at OpenAI cost + 100%.

INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, billing_model, usage_unit_label, usage_bundle_size, usage_bundle_price, sort_order, is_active)
SELECT
  'AI Blog Writing',
  'Use AI to generate, improve, and expand your website blog posts. Credits are purchased in advance and deducted per operation. Powered by OpenAI GPT-4o mini.',
  ARRAY['ai_blog_writing'],
  0.00,
  0.00,
  false,
  'usage',
  'AI writing credits',
  2500,
  25.00,
  20,
  true
WHERE NOT EXISTS (SELECT 1 FROM addons WHERE 'ai_blog_writing' = ANY(feature_keys));
