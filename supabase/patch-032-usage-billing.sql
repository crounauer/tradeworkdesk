-- patch-032: Usage-based billing for addons (SMS, Address Lookup)
-- Adds billing_model, bundle pricing columns to addons.
-- Creates tenant_addon_credits table to track remaining/purchased credits.
-- Updates SMS Messaging and UK Address Lookup to usage-based model.

-- ─── 1. New columns on addons ────────────────────────────────────────────────
ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS billing_model      TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS usage_unit_label   TEXT,          -- e.g. "SMS messages"
  ADD COLUMN IF NOT EXISTS usage_bundle_size  INTEGER,       -- e.g. 1000
  ADD COLUMN IF NOT EXISTS usage_bundle_price NUMERIC(10,2); -- e.g. 10.00

-- ─── 2. Credit balance table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_addon_credits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_id            UUID NOT NULL REFERENCES addons(id)  ON DELETE CASCADE,
  credits_remaining   INTEGER NOT NULL DEFAULT 0,
  total_purchased     INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_addon_credits_tenant ON tenant_addon_credits (tenant_id);

-- ─── 3. Update SMS Messaging to usage model ───────────────────────────────────
UPDATE addons
SET billing_model      = 'usage',
    usage_unit_label   = 'SMS messages',
    usage_bundle_size  = 1000,
    usage_bundle_price = 10.00,
    monthly_price      = 0,
    annual_price       = 0,
    is_per_seat        = false,
    description        = 'Send SMS messages to customers directly from jobs and customer records. Credits purchased in bundles of 1,000.'
WHERE 'sms_messaging' = ANY(feature_keys);

-- ─── 4. Update UK Address Lookup to usage model ───────────────────────────────
UPDATE addons
SET billing_model      = 'usage',
    usage_unit_label   = 'address lookups',
    usage_bundle_size  = 1000,
    usage_bundle_price = 10.00,
    monthly_price      = 0,
    annual_price       = 0,
    is_per_seat        = false,
    description        = 'Postcode lookup with full address and grid coordinates via Ideal Postcodes. Credits purchased in bundles of 1,000.'
WHERE 'uk_address_lookup' = ANY(feature_keys);

-- ─── 5. Seed starter credits for tenants already subscribed ──────────────────
INSERT INTO tenant_addon_credits (tenant_id, addon_id, credits_remaining, total_purchased)
SELECT ta.tenant_id, ta.addon_id, 100, 100
FROM tenant_addons ta
JOIN addons a ON a.id = ta.addon_id
WHERE ta.is_active = true
  AND a.billing_model = 'usage'
ON CONFLICT (tenant_id, addon_id) DO NOTHING;
