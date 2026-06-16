-- Phase 4: Maintenance Plans & Service Reminders
-- Allows tenants to sell recurring maintenance contracts and send annual service reminders

-- ─── Maintenance plan tiers (what the company sells) ─────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_plan_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                          -- e.g. "Basic Cover", "Premium Cover"
  description     TEXT,
  price_per_year  NUMERIC(10,2) NOT NULL DEFAULT 0,
  includes_parts  BOOLEAN NOT NULL DEFAULT false,
  max_callouts    INTEGER,                                -- NULL = unlimited
  services_included INTEGER NOT NULL DEFAULT 1,          -- annual visits included
  colour          TEXT DEFAULT '#6366f1',                 -- badge colour in UI
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON maintenance_plan_tiers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON maintenance_plan_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Subscriptions (customer enrolled in a plan) ──────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_plan_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tier_id         UUID NOT NULL REFERENCES maintenance_plan_tiers(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  appliance_id    UUID REFERENCES appliances(id) ON DELETE SET NULL,
  start_date      DATE NOT NULL,
  renewal_date    DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','expired','cancelled','suspended')),
  payment_method  TEXT DEFAULT 'invoice'
                  CHECK (payment_method IN ('invoice','direct_debit','card','cash')),
  stripe_subscription_id TEXT,
  gocardless_mandate_id  TEXT,
  notes           TEXT,
  callouts_used   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON maintenance_plan_subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON maintenance_plan_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Service reminder settings (per-tenant) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS service_reminder_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  advance_days    INTEGER NOT NULL DEFAULT 30,           -- send reminder X days before due
  follow_up_days  INTEGER NOT NULL DEFAULT 7,            -- 2nd reminder if no response
  email_enabled   BOOLEAN NOT NULL DEFAULT true,
  sms_enabled     BOOLEAN NOT NULL DEFAULT false,
  auto_create_job BOOLEAN NOT NULL DEFAULT false,        -- auto-book a job when reminder sent
  email_subject   TEXT NOT NULL DEFAULT 'Your annual boiler service is due',
  email_body      TEXT,
  sms_body        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON service_reminder_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON service_reminder_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Service reminders (individual records) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS service_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  appliance_id    UUID REFERENCES appliances(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES maintenance_plan_subscriptions(id) ON DELETE SET NULL,
  reminder_type   TEXT NOT NULL DEFAULT 'annual_service'
                  CHECK (reminder_type IN ('annual_service','gas_safety','boiler_check','oil_service','heat_pump_service','custom')),
  due_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','opened','completed','dismissed','failed')),
  channel         TEXT NOT NULL DEFAULT 'email'
                  CHECK (channel IN ('email','sms','both')),
  scheduled_for   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  tracking_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON service_reminders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON service_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS service_reminders_tenant_status
  ON service_reminders(tenant_id, status);
CREATE INDEX IF NOT EXISTS service_reminders_due_date
  ON service_reminders(tenant_id, due_date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE maintenance_plan_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_plan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_reminders ENABLE ROW LEVEL SECURITY;

-- We use service role key (bypasses RLS) — policies are a safety net
CREATE POLICY "tenant_access" ON maintenance_plan_tiers
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_access" ON maintenance_plan_subscriptions
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_access" ON service_reminder_settings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_access" ON service_reminders
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
