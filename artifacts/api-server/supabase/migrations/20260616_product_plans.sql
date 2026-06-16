-- Simplify plan features to flat-rate model.
-- All plans now include everything; the only meaningful distinction is
-- job_management (TradeWorkDesk app) vs website_builder (TradeSite) vs both (Bundle).
-- Strip all granular feature flags from every plan, preserving only these two keys.

UPDATE plans
SET features = jsonb_build_object(
  'job_management', COALESCE((features->>'job_management')::boolean, false),
  'website_builder', COALESCE((features->>'website_builder')::boolean, false)
);
