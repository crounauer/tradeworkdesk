-- Migration 0085: Phase 3 - Review Request Automation
-- Tables:
--   review_request_settings  — per-tenant configuration
--   review_requests          — individual requests sent to customers
--   automation_rules         — trigger-based automation rules
--   automation_logs          — audit log of automation events

-- ─── 1. Review request settings ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_request_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Feature toggle
  is_enabled              BOOLEAN NOT NULL DEFAULT false,
  -- Trigger
  trigger_on              TEXT NOT NULL DEFAULT 'job_completed'
    CHECK (trigger_on IN ('job_completed', 'invoice_paid', 'manual')),
  delay_hours             INTEGER NOT NULL DEFAULT 24,   -- wait X hours after trigger
  -- Review platform links
  google_review_url       TEXT,
  trustpilot_url          TEXT,
  checkatrade_url         TEXT,
  which_trusted_url       TEXT,
  custom_review_url       TEXT,
  custom_review_label     TEXT,
  -- Email template
  email_subject           TEXT NOT NULL DEFAULT 'How did we do? Leave us a review',
  email_body              TEXT,   -- handlebars-style: {{customer_name}}, {{company_name}}
  -- SMS (if SMS addon enabled)
  sms_enabled             BOOLEAN NOT NULL DEFAULT false,
  sms_body                TEXT,
  -- Limits
  max_per_customer_days   INTEGER NOT NULL DEFAULT 90,  -- don't re-request within X days
  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_review_settings_tenant ON review_request_settings(tenant_id);

DROP TRIGGER IF EXISTS set_updated_at ON review_request_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON review_request_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE review_request_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "review_settings_tenant" ON review_request_settings;
CREATE POLICY "review_settings_tenant" ON review_request_settings
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = review_request_settings.tenant_id)
  );

-- ─── 2. Review requests (individual sends) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS review_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Who
  customer_name     TEXT NOT NULL,
  customer_email    TEXT,
  customer_phone    TEXT,
  -- What triggered it
  trigger_type      TEXT NOT NULL DEFAULT 'job_completed'
    CHECK (trigger_type IN ('job_completed', 'invoice_paid', 'manual')),
  job_id            UUID,       -- references jobs(id)
  invoice_id        UUID,       -- references invoices(id)
  -- Send status
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'failed', 'suppressed')),
  scheduled_for     TIMESTAMPTZ NOT NULL,  -- when to send
  sent_at           TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  clicked_at        TIMESTAMPTZ,
  -- Channel
  channel           TEXT NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'sms')),
  -- Tracking
  tracking_token    TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  error_message     TEXT,
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_tenant    ON review_requests(tenant_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_review_requests_pending   ON review_requests(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_review_requests_email     ON review_requests(tenant_id, customer_email);
CREATE INDEX IF NOT EXISTS idx_review_requests_token     ON review_requests(tracking_token);

DROP TRIGGER IF EXISTS set_updated_at ON review_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON review_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "review_requests_tenant" ON review_requests;
CREATE POLICY "review_requests_tenant" ON review_requests
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = review_requests.tenant_id)
  );

-- Public update for click/open tracking (via tracking token)
DROP POLICY IF EXISTS "review_requests_public_track" ON review_requests;
CREATE POLICY "review_requests_public_track" ON review_requests
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ─── 3. Automation rules ─────────────────────────────────────────────────────
-- Generic trigger-action rules for future extensibility

CREATE TABLE IF NOT EXISTS automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  -- Trigger
  trigger_event   TEXT NOT NULL,
  -- e.g. 'job.completed', 'invoice.paid', 'booking.confirmed',
  --      'enquiry.created', 'booking.reminder_due'
  trigger_filters JSONB NOT NULL DEFAULT '{}',  -- e.g. {job_type_id: "..."}
  -- Action
  action_type     TEXT NOT NULL,
  -- e.g. 'send_review_request', 'send_email', 'send_sms',
  --      'create_job', 'create_task', 'webhook'
  action_config   JSONB NOT NULL DEFAULT '{}',
  -- Delay
  delay_minutes   INTEGER NOT NULL DEFAULT 0,
  -- Stats
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules(tenant_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_event  ON automation_rules(trigger_event, is_enabled);

DROP TRIGGER IF EXISTS set_updated_at ON automation_rules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_rules_tenant" ON automation_rules;
CREATE POLICY "automation_rules_tenant" ON automation_rules
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = automation_rules.tenant_id)
  );

-- ─── 4. Automation logs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  trigger_event   TEXT NOT NULL,
  -- What entity triggered it
  entity_type     TEXT,   -- 'job', 'invoice', 'booking', 'enquiry'
  entity_id       UUID,
  -- Result
  status          TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'skipped')),
  action_type     TEXT,
  message         TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_tenant ON automation_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule   ON automation_logs(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_entity ON automation_logs(entity_type, entity_id);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_logs_tenant" ON automation_logs;
CREATE POLICY "automation_logs_tenant" ON automation_logs
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = automation_logs.tenant_id)
  );

-- ─── 5. Form → enquiry integration (add column to website_form_submissions) ──
-- When website_forms.auto_create_enquiry = true, record the created enquiry ID.
-- (enquiry_id column already exists on website_form_submissions from migration 0083)
-- No schema change needed — just API-level integration.
