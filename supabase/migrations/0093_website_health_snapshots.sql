-- Migration 0093: website_health_snapshots
-- Persists weekly website health score snapshots for trend reporting.

CREATE TABLE IF NOT EXISTS website_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  health_label TEXT NOT NULL CHECK (health_label IN ('Strong', 'Needs Attention', 'At Risk')),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_website_health_snapshots_website_week
  ON website_health_snapshots (website_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_website_health_snapshots_tenant_week
  ON website_health_snapshots (tenant_id, week_start DESC);

DROP TRIGGER IF EXISTS set_updated_at ON website_health_snapshots;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_health_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_health_snapshots_tenant" ON website_health_snapshots;
CREATE POLICY "website_health_snapshots_tenant" ON website_health_snapshots
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = website_health_snapshots.tenant_id
    )
  );
