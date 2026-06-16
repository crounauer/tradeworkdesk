-- Migration: Product-based plans
-- Replaces the single "Base Plan" with three product plans:
--   1. TradeWorkDesk  — job management software
--   2. TradeSite      — website builder
--   3. Bundle         — both products

-- Mark the old base plan as legacy so it no longer shows in the public picker
UPDATE plans SET is_legacy = true, is_active = false
WHERE is_legacy = false AND name ILIKE '%base plan%';

-- 1. TradeWorkDesk plan
INSERT INTO plans (
  name, description,
  monthly_price, annual_price,
  max_users, max_jobs_per_month,
  features, is_active, is_legacy, sort_order, is_popular
)
VALUES (
  'TradeWorkDesk',
  'Complete job management software for trade businesses. Jobs, scheduling, invoicing, customers, and compliance forms.',
  25.00, 250.00,
  2, 200,
  '{
    "job_management": true,
    "scheduling": true,
    "invoicing": true,
    "reports": true,
    "team_management": true,
    "social_media": false,
    "website_builder": false,
    "heat_pump_forms": true,
    "oil_tank_forms": true,
    "commissioning_forms": true,
    "combustion_analysis": true,
    "compliance_forms": true,
    "api_access": false,
    "custom_branding": false,
    "priority_support": false
  }'::jsonb,
  true, false, 1, false
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  features = EXCLUDED.features,
  is_active = true,
  is_legacy = false,
  sort_order = EXCLUDED.sort_order;

-- 2. TradeSite plan
INSERT INTO plans (
  name, description,
  monthly_price, annual_price,
  max_users, max_jobs_per_month,
  features, is_active, is_legacy, sort_order, is_popular
)
VALUES (
  'TradeSite',
  'Professional website builder for trade businesses. Custom domain, blog, photo gallery, contact forms, and SEO tools.',
  15.00, 150.00,
  1, 0,
  '{
    "job_management": false,
    "scheduling": false,
    "invoicing": false,
    "reports": false,
    "team_management": false,
    "social_media": false,
    "website_builder": true,
    "heat_pump_forms": false,
    "oil_tank_forms": false,
    "commissioning_forms": false,
    "combustion_analysis": false,
    "compliance_forms": false,
    "api_access": false,
    "custom_branding": false,
    "priority_support": false
  }'::jsonb,
  true, false, 2, false
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  features = EXCLUDED.features,
  is_active = true,
  is_legacy = false,
  sort_order = EXCLUDED.sort_order;

-- 3. Bundle plan (both products)
INSERT INTO plans (
  name, description,
  monthly_price, annual_price,
  max_users, max_jobs_per_month,
  features, is_active, is_legacy, sort_order, is_popular
)
VALUES (
  'Bundle',
  'Everything in TradeWorkDesk plus TradeSite. The complete platform for trade businesses at a discounted price.',
  35.00, 350.00,
  2, 200,
  '{
    "job_management": true,
    "scheduling": true,
    "invoicing": true,
    "reports": true,
    "team_management": true,
    "social_media": false,
    "website_builder": true,
    "heat_pump_forms": true,
    "oil_tank_forms": true,
    "commissioning_forms": true,
    "combustion_analysis": true,
    "compliance_forms": true,
    "api_access": false,
    "custom_branding": false,
    "priority_support": false
  }'::jsonb,
  true, false, 3, true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  features = EXCLUDED.features,
  is_active = true,
  is_legacy = false,
  sort_order = EXCLUDED.sort_order,
  is_popular = true;
