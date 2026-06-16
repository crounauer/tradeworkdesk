-- Phase 4: Email Marketing Campaigns
-- Bulk email campaigns with open/click tracking and customer segmentation

-- ─── Campaigns ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                          -- internal name
  subject         TEXT NOT NULL,
  preview_text    TEXT,                                   -- shown in email client preview
  html_body       TEXT,                                   -- full HTML body
  text_body       TEXT,                                   -- plain-text fallback
  from_name       TEXT,                                   -- defaults to company name
  reply_to        TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sending','sent','cancelled','failed')),
  -- Segmentation: stored as JSONB filter criteria
  recipient_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. {"all": true} or {"has_property": true} or {"last_serviced_before": "2024-01-01"}
  --      {"has_appliance_fuel": "gas"} etc.
  scheduled_for   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  open_count      INTEGER NOT NULL DEFAULT 0,
  click_count     INTEGER NOT NULL DEFAULT 0,
  bounce_count    INTEGER NOT NULL DEFAULT 0,
  unsubscribe_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON email_campaigns;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Per-recipient records ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','delivered','bounced','opened','clicked','unsubscribed','failed')),
  tracking_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  bounce_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaign_recipients_campaign
  ON campaign_recipients(campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_token
  ON campaign_recipients(tracking_token);

-- ─── Email unsubscribes (global opt-out per tenant) ───────────────────────────
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_access" ON email_campaigns
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_access" ON campaign_recipients
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_access" ON email_unsubscribes
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Public: recipient can update their own row via tracking token (open/click)
CREATE POLICY "public_tracking" ON campaign_recipients
  FOR UPDATE USING (true);
-- Public: customer can unsubscribe via token (handled server-side)
