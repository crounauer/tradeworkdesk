-- Patch 007: Social Media Post Management & Scheduling
-- Run this in your Supabase SQL Editor on any existing database.
-- All statements are idempotent (safe to run more than once).

-- ─── 1. Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE social_platform AS ENUM (
    'x', 'facebook', 'instagram', 'pinterest', 'linkedin', 'tiktok', 'youtube'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE social_post_status AS ENUM (
    'draft', 'scheduled', 'processing', 'posted', 'failed', 'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE social_entity_type AS ENUM (
    'product', 'category', 'article'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. social_accounts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform              social_platform NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  page_id               TEXT,
  page_name             TEXT,
  instagram_business_id TEXT,
  profile_name          TEXT NOT NULL,
  expires_at            TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  auto_post             BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON social_accounts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. social_posts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id     UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform       social_platform NOT NULL,
  content        TEXT NOT NULL,
  link_url       TEXT,
  image_url      TEXT,
  video_url      TEXT,
  scheduled_for  TIMESTAMPTZ,
  status         social_post_status NOT NULL DEFAULT 'draft',
  post_id        TEXT,
  post_url       TEXT,
  error          TEXT,
  entity_type    social_entity_type,
  entity_id      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON social_posts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS social_accounts_tenant_idx ON social_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS social_posts_tenant_idx    ON social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS social_posts_status_idx    ON social_posts(status);
CREATE INDEX IF NOT EXISTS social_posts_scheduled_idx ON social_posts(scheduled_for)
  WHERE status = 'scheduled';

-- ─── 5. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts    ENABLE ROW LEVEL SECURITY;

-- social_accounts: admins can manage their own tenant's accounts
DROP POLICY IF EXISTS "social_accounts_tenant_select" ON social_accounts;
CREATE POLICY "social_accounts_tenant_select" ON social_accounts
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "social_accounts_tenant_insert" ON social_accounts;
CREATE POLICY "social_accounts_tenant_insert" ON social_accounts
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "social_accounts_tenant_update" ON social_accounts;
CREATE POLICY "social_accounts_tenant_update" ON social_accounts
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "social_accounts_tenant_delete" ON social_accounts;
CREATE POLICY "social_accounts_tenant_delete" ON social_accounts
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

-- social_posts: admins can manage their own tenant's posts
DROP POLICY IF EXISTS "social_posts_tenant_select" ON social_posts;
CREATE POLICY "social_posts_tenant_select" ON social_posts
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "social_posts_tenant_insert" ON social_posts;
CREATE POLICY "social_posts_tenant_insert" ON social_posts
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "social_posts_tenant_update" ON social_posts;
CREATE POLICY "social_posts_tenant_update" ON social_posts
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "social_posts_tenant_delete" ON social_posts;
CREATE POLICY "social_posts_tenant_delete" ON social_posts
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );
