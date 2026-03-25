-- patch-016-plan-feature-gates.sql
-- Add "Forms Only" plan and update existing plans with comprehensive feature flags

-- Ensure name is unique for idempotent upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plans_name_key'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_name_key UNIQUE (name);
  END IF;
END $$;

-- Insert or update "Forms Only" plan (sort_order 0 = first/cheapest)
INSERT INTO plans (name, description, monthly_price, annual_price, max_users, max_jobs_per_month, features, is_active, sort_order, stripe_price_id, stripe_price_id_annual)
VALUES (
  'Forms Only',
  'Digital service records & forms — perfect for sole traders',
  0,
  0,
  1,
  9999,
  '{
    "job_management": false,
    "invoicing": false,
    "reports": false,
    "team_management": false,
    "social_media": false,
    "heat_pump_forms": true,
    "oil_tank_forms": true,
    "commissioning_forms": true,
    "combustion_analysis": true,
    "api_access": false,
    "scheduling": false,
    "custom_branding": false,
    "priority_support": false
  }'::jsonb,
  true,
  0,
  null,
  null
)
ON CONFLICT (name) DO UPDATE SET
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- Update Starter plan features
UPDATE plans
SET features = jsonb_build_object(
  'job_management', true,
  'invoicing', false,
  'reports', false,
  'team_management', false,
  'social_media', false,
  'heat_pump_forms', true,
  'oil_tank_forms', true,
  'commissioning_forms', true,
  'combustion_analysis', true,
  'api_access', false,
  'scheduling', true,
  'custom_branding', false,
  'priority_support', false
),
sort_order = 1
WHERE name = 'Starter' AND features IS NOT NULL;

-- Update Professional plan features
UPDATE plans
SET features = jsonb_build_object(
  'job_management', true,
  'invoicing', true,
  'reports', true,
  'team_management', true,
  'social_media', false,
  'heat_pump_forms', true,
  'oil_tank_forms', true,
  'commissioning_forms', true,
  'combustion_analysis', true,
  'api_access', false,
  'scheduling', true,
  'custom_branding', true,
  'priority_support', false
),
sort_order = 2
WHERE name = 'Professional' AND features IS NOT NULL;

-- Update Enterprise plan features
UPDATE plans
SET features = jsonb_build_object(
  'job_management', true,
  'invoicing', true,
  'reports', true,
  'team_management', true,
  'social_media', true,
  'heat_pump_forms', true,
  'oil_tank_forms', true,
  'commissioning_forms', true,
  'combustion_analysis', true,
  'api_access', true,
  'scheduling', true,
  'custom_branding', true,
  'priority_support', true
),
sort_order = 3
WHERE name = 'Enterprise' AND features IS NOT NULL;
