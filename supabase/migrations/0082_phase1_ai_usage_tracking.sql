-- Migration 0082: Phase 1 - AI usage tracking per tenant
-- Adds:
--   - ai_usage_log: per-request log of AI operations
--   - ai_usage_monthly: aggregated monthly counters for billing/limits
-- The existing tenant_addon_credits table handles purchased bundles.
-- This table tracks actual consumption against those limits.

-- ─── 1. AI usage log (raw events) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  operation    TEXT NOT NULL,  -- 'social_post', 'blog_rewrite', 'service_page', 'meta_desc', etc.
  module       TEXT NOT NULL DEFAULT 'social', -- 'social', 'website', 'jobs'
  model        TEXT,           -- e.g. 'gpt-4o-mini'
  tokens_in    INTEGER NOT NULL DEFAULT 0,
  tokens_out   INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER GENERATED ALWAYS AS (tokens_in + tokens_out) STORED,
  images_generated INTEGER NOT NULL DEFAULT 0,
  cost_usd     NUMERIC(10, 6), -- estimated cost for internal tracking
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_month
  ON ai_usage_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_module
  ON ai_usage_log(module, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_log_admin" ON ai_usage_log;
CREATE POLICY "ai_usage_log_admin" ON ai_usage_log
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = ai_usage_log.tenant_id
        AND p.role = 'admin'
    )
  );

-- ─── 2. Monthly aggregated counters ───────────────────────────────────────────
-- Pre-aggregated for fast limit checks. Updated by a trigger on ai_usage_log.

CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month            DATE NOT NULL, -- first day of the month, e.g. 2026-06-01
  tokens_total     INTEGER NOT NULL DEFAULT 0,
  images_generated INTEGER NOT NULL DEFAULT 0,
  social_posts     INTEGER NOT NULL DEFAULT 0,  -- count of social_post operations
  blog_posts       INTEGER NOT NULL DEFAULT 0,  -- count of blog_* operations
  website_rewrites INTEGER NOT NULL DEFAULT 0,  -- count of website_* operations
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_tenant
  ON ai_usage_monthly(tenant_id, month DESC);

ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_monthly_admin" ON ai_usage_monthly;
CREATE POLICY "ai_usage_monthly_admin" ON ai_usage_monthly
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = ai_usage_monthly.tenant_id
        AND p.role = 'admin'
    )
  );

-- ─── 3. Trigger to maintain monthly aggregates ────────────────────────────────

CREATE OR REPLACE FUNCTION increment_ai_usage_monthly()
RETURNS TRIGGER AS $$
DECLARE
  v_month DATE := DATE_TRUNC('month', NEW.created_at)::DATE;
BEGIN
  INSERT INTO ai_usage_monthly (
    tenant_id, month,
    tokens_total, images_generated,
    social_posts, blog_posts, website_rewrites
  )
  VALUES (
    NEW.tenant_id, v_month,
    NEW.tokens_total, NEW.images_generated,
    CASE WHEN NEW.operation LIKE 'social%' THEN 1 ELSE 0 END,
    CASE WHEN NEW.operation LIKE 'blog%' THEN 1 ELSE 0 END,
    CASE WHEN NEW.module = 'website' THEN 1 ELSE 0 END
  )
  ON CONFLICT (tenant_id, month) DO UPDATE SET
    tokens_total     = ai_usage_monthly.tokens_total + EXCLUDED.tokens_total,
    images_generated = ai_usage_monthly.images_generated + EXCLUDED.images_generated,
    social_posts     = ai_usage_monthly.social_posts + EXCLUDED.social_posts,
    blog_posts       = ai_usage_monthly.blog_posts + EXCLUDED.blog_posts,
    website_rewrites = ai_usage_monthly.website_rewrites + EXCLUDED.website_rewrites,
    updated_at       = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ai_usage_monthly ON ai_usage_log;
CREATE TRIGGER trg_ai_usage_monthly
  AFTER INSERT ON ai_usage_log
  FOR EACH ROW EXECUTE FUNCTION increment_ai_usage_monthly();
