-- Phase 4: Missed Call Text-Back
-- When a call is missed on the business number, automatically send an SMS to the caller

-- ─── Settings (per-tenant) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missed_call_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  business_number TEXT,                                   -- the number to monitor (E.164)
  sender_id       TEXT,                                   -- SMS sender name or number
  message_template TEXT NOT NULL DEFAULT
    'Hi, sorry we missed your call. We''ll be in touch shortly. - {{company_name}}',
  delay_seconds   INTEGER NOT NULL DEFAULT 30,            -- wait before sending
  business_hours_only BOOLEAN NOT NULL DEFAULT true,
  business_start  TIME NOT NULL DEFAULT '08:00',
  business_end    TIME NOT NULL DEFAULT '18:00',
  provider        TEXT NOT NULL DEFAULT 'smsworks'
                  CHECK (provider IN ('smsworks','twilio')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON missed_call_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON missed_call_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Missed call log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missed_call_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  caller_number   TEXT NOT NULL,                          -- E.164 caller ID
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_sent   BOOLEAN NOT NULL DEFAULT false,
  response_at     TIMESTAMPTZ,
  message_sent    TEXT,                                   -- actual message content used
  sms_provider_ref TEXT,                                  -- provider message ID
  suppressed      BOOLEAN NOT NULL DEFAULT false,         -- e.g. outside business hours
  suppression_reason TEXT,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS missed_call_logs_tenant
  ON missed_call_logs(tenant_id, received_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE missed_call_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE missed_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_access" ON missed_call_settings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_access" ON missed_call_logs
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ─── Platform settings for webhook secret ────────────────────────────────────
-- The missed-call webhook from Twilio/SMS Works will POST to:
--   POST /api/public/missed-call/webhook
-- and look up the tenant by their registered phone number.
-- No migration needed for platform_settings — already exists.
