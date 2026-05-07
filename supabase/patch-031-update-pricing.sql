-- patch-031: Update plan and addon pricing to £25 + £10/user model
-- Base Plan: £25/month, £250/year
-- Additional Users addon: £10/month, £100/year
-- (All other addons left untouched)

-- ─── 1. Update Base Plan pricing ──────────────────────────────────────────────
UPDATE plans
SET monthly_price = 25.00,
    annual_price  = 250.00,
    description   = 'Everything included. Up to 2 users. Additional engineers at £10/month each.'
WHERE name = 'Base Plan'
  AND is_legacy = false;

-- ─── 2. Update Additional Users addon pricing ─────────────────────────────────
UPDATE addons
SET monthly_price = 10.00,
    annual_price  = 100.00,
    description   = 'Add extra user seats to your account at £10/month per engineer.'
WHERE 'additional_users' = ANY(feature_keys);
