-- patch-030: per-user addon assignments + SMS messaging
-- Creates user_addons table (which user within a tenant has which per-seat addon)
-- Creates sms_messages table for SMS send history
-- Inserts SMS Messaging addon and ensures UK Address Lookup addon is marked is_per_seat

-- ──────────────────────────────────────────────────────────────
-- 1. user_addons
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_addons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addon_id      UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  activated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, addon_id)
);

CREATE INDEX IF NOT EXISTS user_addons_tenant_user ON user_addons (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS user_addons_tenant_addon ON user_addons (tenant_id, addon_id);

-- ──────────────────────────────────────────────────────────────
-- 2. sms_messages
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sent_by_user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  destination           TEXT NOT NULL,
  content               TEXT NOT NULL,
  sender_id             TEXT NOT NULL DEFAULT 'TradeWork',
  sms_works_message_id  TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  credits_used          INTEGER,
  job_id                UUID REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_messages_tenant ON sms_messages (tenant_id);
CREATE INDEX IF NOT EXISTS sms_messages_job ON sms_messages (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_messages_customer ON sms_messages (customer_id) WHERE customer_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 3. Insert / update addon catalogue entries
-- ──────────────────────────────────────────────────────────────

-- SMS Messaging addon (new, per-seat)
INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order, is_active)
SELECT
  'SMS Messaging',
  'Send SMS messages to customers directly from jobs and customer records via SMS Works. Billed per assigned user.',
  ARRAY['sms_messaging'],
  2.99,
  29.99,
  true,
  13,
  true
WHERE NOT EXISTS (SELECT 1 FROM addons WHERE name = 'SMS Messaging');

-- UK Address Lookup — ensure it exists and is marked as per-seat
INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order, is_active)
SELECT
  'UK Address Lookup',
  'Postcode lookup with full address and grid coordinates via Ideal Postcodes. Billed per assigned user.',
  ARRAY['uk_address_lookup'],
  1.99,
  19.99,
  true,
  14,
  true
WHERE NOT EXISTS (SELECT 1 FROM addons WHERE name = 'UK Address Lookup');

-- Ensure existing UK Address Lookup row is marked as per-seat
UPDATE addons
SET is_per_seat  = true,
    feature_keys = ARRAY['uk_address_lookup']
WHERE name = 'UK Address Lookup';
