-- Patch 017: Sole Trader to Company Upgrade Lifecycle
-- Adds company_type to tenants, sole trader pricing to plans, can_be_assigned_jobs to profiles
-- All statements are idempotent (safe to run more than once).

-- ─── 1. Company type on tenants ──────────────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_type TEXT NOT NULL DEFAULT 'sole_trader'
  CHECK (company_type IN ('sole_trader', 'company'));

-- ─── 2. Sole trader pricing columns on plans ────────────────────────────────
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sole_trader_price NUMERIC(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sole_trader_price_annual NUMERIC(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_sole_trader_price_id TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_sole_trader_price_id_annual TEXT;

-- ─── 3. can_be_assigned_jobs on profiles ─────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_be_assigned_jobs BOOLEAN NOT NULL DEFAULT false;

-- Set can_be_assigned_jobs = true for existing sole-trader admins
UPDATE profiles
SET can_be_assigned_jobs = true
WHERE role = 'admin'
  AND tenant_id IN (
    SELECT id FROM tenants WHERE company_type = 'sole_trader'
  )
  AND can_be_assigned_jobs = false;

-- Also set it true for all technicians (they should always be assignable)
UPDATE profiles
SET can_be_assigned_jobs = true
WHERE role = 'technician'
  AND can_be_assigned_jobs = false;
