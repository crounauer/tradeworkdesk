-- patch-033: Low credits alert tracking
-- Adds columns to tenant_addon_credits to track when a low-credits email was
-- last sent, and what the total_purchased was at that time.
-- This lets the cron job know not to re-send unless the tenant has topped up.

ALTER TABLE tenant_addon_credits
  ADD COLUMN IF NOT EXISTS low_credits_alert_sent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS low_credits_alert_total_purchased   INTEGER;
