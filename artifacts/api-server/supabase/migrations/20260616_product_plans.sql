-- Simplify plan features to flat-rate model.
-- All plans now include everything; the only meaningful distinction is
-- job_management vs website_builder vs both (Bundle).
-- Strip all granular feature flags from every plan, preserving only these two keys.

UPDATE plans
SET features = jsonb_build_object(
  'job_management', COALESCE((features->>'job_management')::boolean, false),
  'website_builder', COALESCE((features->>'website_builder')::boolean, false)
);

-- Rename plans to clearer product names.
UPDATE plans SET name = 'Job Management' WHERE name = 'TradeWorkDesk';
UPDATE plans SET name = 'Website Builder' WHERE name = 'TradeSite';
