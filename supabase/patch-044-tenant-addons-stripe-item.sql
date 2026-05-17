-- Add stripe_subscription_item_id to tenant_addons if it doesn't exist
ALTER TABLE tenant_addons
  ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT;
