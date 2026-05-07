-- Patch 034: Simple pricing — one plan, per-seat extra users
-- Replaces the multi-tier plan + add-on model with a single £25/month plan.
-- Up to 2 users included; additional users at £10/month each via Stripe.

-- ─── 1. New columns on plans ──────────────────────────────────────────────────
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_per_seat_price_id TEXT;

-- ─── 2. New column on tenants ─────────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_per_seat_item_id TEXT;

-- ─── 3. Insert the single TradeWorkDesk plan ──────────────────────────────────
INSERT INTO plans (
  name,
  description,
  monthly_price,
  annual_price,
  max_users,
  max_jobs_per_month,  -- column is NOT NULL; use 9999 to represent unlimited
  features,
  is_active,
  is_legacy,
  sort_order
)
VALUES (
  'TradeWorkDesk',
  'Everything included. Up to 2 users. £10/month per additional engineer.',
  25.00,
  25.00,
  2,
  9999,
  '{
    "job_management": true,
    "invoicing": true,
    "reports": true,
    "team_management": true,
    "social_media": true,
    "heat_pump_forms": true,
    "oil_tank_forms": true,
    "commissioning_forms": true,
    "combustion_analysis": true,
    "api_access": true,
    "scheduling": true,
    "custom_branding": true,
    "priority_support": true,
    "digital_signatures": true,
    "accounting_integration": true,
    "advanced_analytics": true,
    "report_export": true,
    "compliance_forms": true,
    "additional_users": true,
    "service_catalogue": true,
    "todo_list": true,
    "geo_mapping": true,
    "uk_address_lookup": true
  }'::jsonb,
  true,
  false,
  10
);

-- ─── 4. Migrate active/trial tenants onto the new plan ────────────────────────
UPDATE tenants
SET plan_id = (SELECT id FROM plans WHERE name = 'TradeWorkDesk' AND is_legacy = false LIMIT 1)
WHERE status IN ('trial', 'active', 'payment_overdue');

-- ─── 5. Retire all old plans ──────────────────────────────────────────────────
UPDATE plans
SET is_active = false, is_legacy = true
WHERE name != 'TradeWorkDesk';

-- ─── 6. Deactivate all existing addon subscriptions (now redundant) ───────────
UPDATE tenant_addons
SET is_active       = false,
    deactivated_at  = NOW()
WHERE is_active = true;
