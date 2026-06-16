-- Drop columns that are no longer used after the flat-rate plan simplification.
-- All plans include everything; there are no per-feature or sole-trader price tiers.

ALTER TABLE plans
  DROP COLUMN IF EXISTS features,
  DROP COLUMN IF EXISTS max_jobs_per_month,
  DROP COLUMN IF EXISTS user_note,
  DROP COLUMN IF EXISTS sole_trader_price,
  DROP COLUMN IF EXISTS sole_trader_price_annual,
  DROP COLUMN IF EXISTS stripe_sole_trader_price_id,
  DROP COLUMN IF EXISTS stripe_sole_trader_price_id_annual;
