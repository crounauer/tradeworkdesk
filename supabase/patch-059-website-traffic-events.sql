-- Patch 059: First-party website traffic events for tenant analytics
-- Stores lightweight page/session signals for hits, unique visitors, session duration and top pages.

CREATE TABLE IF NOT EXISTS website_traffic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'session_end')),
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  user_agent TEXT,
  session_elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  session_page_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_traffic_events_website_created
  ON website_traffic_events (website_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_traffic_events_tenant_created
  ON website_traffic_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_traffic_events_website_event_created
  ON website_traffic_events (website_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_traffic_events_website_session
  ON website_traffic_events (website_id, session_id);
