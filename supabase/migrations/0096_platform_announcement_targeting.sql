-- Add tenant/channel targeting controls for platform announcements
ALTER TABLE platform_announcements
  ADD COLUMN IF NOT EXISTS target_tenant_ids UUID[] NULL,
  ADD COLUMN IF NOT EXISTS target_admin_dashboard BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS target_websites BOOLEAN NOT NULL DEFAULT false;

-- Prevent announcements that target no channel at all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_announcements_target_channel_check'
  ) THEN
    ALTER TABLE platform_announcements
      ADD CONSTRAINT platform_announcements_target_channel_check
      CHECK (target_admin_dashboard OR target_websites);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_platform_announcements_target_tenants
  ON platform_announcements
  USING GIN (target_tenant_ids);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_channels
  ON platform_announcements (target_admin_dashboard, target_websites, is_active, starts_at);
