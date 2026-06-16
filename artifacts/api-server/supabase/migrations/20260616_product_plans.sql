-- Flat-rate plan simplification:
-- All plans include everything. Remove granular feature flags and job limits.

-- Clear the features column (no longer used for gating)
UPDATE plans SET features = '{}'::jsonb;

-- Set all plans to unlimited jobs
UPDATE plans SET max_jobs_per_month = 2147483647;

-- Rename plans to clearer product names.
UPDATE plans SET name = 'Job Management' WHERE name = 'TradeWorkDesk';
UPDATE plans SET name = 'Website Builder' WHERE name = 'TradeSite';
