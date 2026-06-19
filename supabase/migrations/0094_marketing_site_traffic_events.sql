-- Migration 0094: marketing_site_traffic_events
-- Tracks public marketing-site traffic for platform analytics.

CREATE TABLE IF NOT EXISTS marketing_site_traffic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view')),
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_site_traffic_created
  ON marketing_site_traffic_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_site_traffic_path_created
  ON marketing_site_traffic_events (path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_site_traffic_session
  ON marketing_site_traffic_events (session_id);

ALTER TABLE marketing_site_traffic_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_site_traffic_events_super_admin_read" ON marketing_site_traffic_events;
CREATE POLICY "marketing_site_traffic_events_super_admin_read" ON marketing_site_traffic_events
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
