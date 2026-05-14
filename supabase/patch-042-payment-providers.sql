-- patch-042: GoCardless, PayPal & TrueLayer per-tenant payment providers
-- Each tenant can independently connect their preferred payment provider.
-- Funds from invoice payments go directly to the tenant's account.

-- ── GoCardless (OAuth Partner Connect) ──────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS gocardless_access_token  TEXT,   -- AES-256-GCM encrypted
  ADD COLUMN IF NOT EXISTS gocardless_organisation_id TEXT; -- from token exchange

-- ── PayPal (per-tenant Business API credentials) ────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS paypal_client_id     TEXT,       -- AES-256-GCM encrypted
  ADD COLUMN IF NOT EXISTS paypal_client_secret TEXT,       -- AES-256-GCM encrypted
  ADD COLUMN IF NOT EXISTS paypal_webhook_id    TEXT;       -- for signature verification

-- ── TrueLayer (platform-level credentials, per-tenant bank account) ─────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS truelayer_sort_code          TEXT,
  ADD COLUMN IF NOT EXISTS truelayer_account_number     TEXT,
  ADD COLUMN IF NOT EXISTS truelayer_account_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS truelayer_enabled            BOOLEAN DEFAULT false;

-- ── Per-invoice payment links for each provider ──────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS gocardless_payment_link_url  TEXT,
  ADD COLUMN IF NOT EXISTS gocardless_billing_request_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_payment_link_url      TEXT,
  ADD COLUMN IF NOT EXISTS paypal_order_id              TEXT,
  ADD COLUMN IF NOT EXISTS truelayer_payment_link_url   TEXT,
  ADD COLUMN IF NOT EXISTS truelayer_payment_id         TEXT;
