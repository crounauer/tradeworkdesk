-- Migration 0108: Website template import system
--
-- Additive schema only. Preserves existing tenant website tables and extends
-- the template stack so ZIP imports can be validated, stored, published, and
-- cloned into tenant-owned pages/blocks.

-- ---------------------------------------------------------------------------
-- 1) Global template upload records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS website_template_uploads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID REFERENCES website_templates(id) ON DELETE SET NULL,
  file_name             TEXT NOT NULL,
  original_zip_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_bucket        TEXT NOT NULL DEFAULT 'website-template-imports',
  storage_path          TEXT NOT NULL,
  checksum_sha256       TEXT NOT NULL,
  file_size_bytes       BIGINT,
  mime_type             TEXT,
  validation_status     TEXT NOT NULL DEFAULT 'uploaded',
  validation_errors     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  validated_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (storage_bucket, storage_path),
  UNIQUE (checksum_sha256)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'website_template_uploads'
      AND c.conname = 'website_template_uploads_validation_status_check'
  ) THEN
    ALTER TABLE website_template_uploads
      ADD CONSTRAINT website_template_uploads_validation_status_check
      CHECK (validation_status IN ('uploaded', 'validating', 'validated', 'failed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_website_template_uploads_template_id
  ON website_template_uploads(template_id);
CREATE INDEX IF NOT EXISTS idx_website_template_uploads_status
  ON website_template_uploads(validation_status);
CREATE INDEX IF NOT EXISTS idx_website_template_uploads_checksum
  ON website_template_uploads(checksum_sha256);

DROP TRIGGER IF EXISTS trigger_website_template_uploads_updated_at ON website_template_uploads;
CREATE TRIGGER trigger_website_template_uploads_updated_at
  BEFORE UPDATE ON website_template_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_template_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_template_uploads_super_admin ON website_template_uploads;
CREATE POLICY website_template_uploads_super_admin ON website_template_uploads
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- 2) Global template definitions
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS website_templates
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_html_url TEXT,
  ADD COLUMN IF NOT EXISTS design_tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS figma_export_info JSONB,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_upload_id UUID REFERENCES website_template_uploads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cms_mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'website_templates'
      AND c.conname = 'website_templates_status_check'
  ) THEN
    ALTER TABLE website_templates
      ADD CONSTRAINT website_templates_status_check
      CHECK (status IN ('uploaded', 'validated', 'draft', 'published', 'archived', 'failed'));
  END IF;
END
$$;

UPDATE website_templates
SET
  status = CASE
    WHEN status IS NULL THEN CASE WHEN is_active THEN 'published' ELSE 'draft' END
    WHEN status = 'published' THEN 'published'
    WHEN is_active AND status IN ('draft', 'validated') THEN 'published'
    ELSE status
  END,
  published_at = CASE
    WHEN is_active AND published_at IS NULL THEN created_at
    ELSE published_at
  END,
  theme_json = CASE
    WHEN theme_json = '{}'::jsonb AND default_theme IS NOT NULL THEN default_theme
    ELSE theme_json
  END,
  cms_mapping_json = CASE
    WHEN cms_mapping_json = '{}'::jsonb THEN jsonb_build_object('pages', default_pages)
    ELSE cms_mapping_json
  END;

CREATE INDEX IF NOT EXISTS idx_website_templates_slug
  ON website_templates(slug);
CREATE INDEX IF NOT EXISTS idx_website_templates_status
  ON website_templates(status);
CREATE INDEX IF NOT EXISTS idx_website_templates_category
  ON website_templates(category);
CREATE INDEX IF NOT EXISTS idx_website_templates_featured
  ON website_templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_website_templates_source_upload
  ON website_templates(source_upload_id);
CREATE INDEX IF NOT EXISTS idx_website_templates_figma_export_info
  ON website_templates USING GIN(figma_export_info);

DROP TRIGGER IF EXISTS trigger_website_templates_updated_at ON website_templates;
CREATE TRIGGER trigger_website_templates_updated_at
  BEFORE UPDATE ON website_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_website_templates_status_sync ON website_templates;
CREATE OR REPLACE FUNCTION sync_website_templates_status_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' THEN
    NEW.is_active := true;
    IF NEW.published_at IS NULL THEN
      NEW.published_at := NOW();
    END IF;
  ELSIF NEW.status IN ('uploaded', 'validated', 'draft', 'archived', 'failed') THEN
    NEW.is_active := false;
  END IF;

  IF NEW.is_active AND NEW.status <> 'published' THEN
    NEW.status := 'published';
    IF NEW.published_at IS NULL THEN
      NEW.published_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_website_templates_status_sync
  BEFORE INSERT OR UPDATE ON website_templates
  FOR EACH ROW
  EXECUTE FUNCTION sync_website_templates_status_sync();

ALTER TABLE website_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_templates_read ON website_templates;
DROP POLICY IF EXISTS website_templates_super_admin ON website_templates;
DROP POLICY IF EXISTS templates_view ON website_templates;
DROP POLICY IF EXISTS templates_manage ON website_templates;
DROP POLICY IF EXISTS templates_manage_update ON website_templates;
DROP POLICY IF EXISTS templates_manage_delete ON website_templates;

CREATE POLICY website_templates_read ON website_templates
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR is_active = true
    OR get_user_role(auth.uid()) = 'super_admin'
  );

CREATE POLICY website_templates_super_admin ON website_templates
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- Preserve the existing template creation flow that seeds default_pages and theme.

-- ---------------------------------------------------------------------------
-- 3) Global template pages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS website_template_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES website_templates(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  path          TEXT NOT NULL,
  page_type     TEXT NOT NULL DEFAULT 'custom',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  seo           JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_template_pages_template_slug
  ON website_template_pages(template_id, slug);
CREATE INDEX IF NOT EXISTS idx_website_template_pages_template_order
  ON website_template_pages(template_id, sort_order);

DROP TRIGGER IF EXISTS trigger_website_template_pages_updated_at ON website_template_pages;
CREATE TRIGGER trigger_website_template_pages_updated_at
  BEFORE UPDATE ON website_template_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_template_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_template_pages_read ON website_template_pages;
DROP POLICY IF EXISTS website_template_pages_super_admin ON website_template_pages;

CREATE POLICY website_template_pages_read ON website_template_pages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM website_templates t
      WHERE t.id = website_template_pages.template_id
        AND (t.status = 'published' OR t.is_active = true OR get_user_role(auth.uid()) = 'super_admin')
    )
  );

CREATE POLICY website_template_pages_super_admin ON website_template_pages
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- 4) Global template blocks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS website_template_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES website_templates(id) ON DELETE CASCADE,
  page_id       UUID NOT NULL REFERENCES website_template_pages(id) ON DELETE CASCADE,
  block_type    TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_template_blocks_template_page_sort
  ON website_template_blocks(template_id, page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_website_template_blocks_page_sort
  ON website_template_blocks(page_id, sort_order);

DROP TRIGGER IF EXISTS trigger_website_template_blocks_updated_at ON website_template_blocks;
CREATE TRIGGER trigger_website_template_blocks_updated_at
  BEFORE UPDATE ON website_template_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_template_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_template_blocks_read ON website_template_blocks;
DROP POLICY IF EXISTS website_template_blocks_super_admin ON website_template_blocks;

CREATE POLICY website_template_blocks_read ON website_template_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM website_template_pages p
      JOIN website_templates t ON t.id = p.template_id
      WHERE p.id = website_template_blocks.page_id
        AND (t.status = 'published' OR t.is_active = true OR get_user_role(auth.uid()) = 'super_admin')
    )
  );

CREATE POLICY website_template_blocks_super_admin ON website_template_blocks
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- 5) Legacy compatibility tables already referenced by the current backend
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS template_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES website_templates(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  design_tokens JSONB NOT NULL,
  demo_pages    JSONB NOT NULL,
  release_notes TEXT,
  released_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS template_usage_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id        UUID REFERENCES websites(id) ON DELETE CASCADE,
  template_id       UUID REFERENCES website_templates(id) ON DELETE CASCADE,
  action            TEXT,
  applied_version   INTEGER,
  content_preserved BOOLEAN NOT NULL DEFAULT true,
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_version
  ON template_versions(template_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_website
  ON template_usage_log(website_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_tenant
  ON template_usage_log(tenant_id);

ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_versions_view ON template_versions;
DROP POLICY IF EXISTS usage_log_view ON template_usage_log;

CREATE POLICY template_versions_view ON template_versions
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY usage_log_view ON template_usage_log
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- 6) Existing tenant-owned content indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_website_pages_tenant_website_slug
  ON website_pages(tenant_id, website_id, slug);
CREATE INDEX IF NOT EXISTS idx_website_blocks_page_sort
  ON website_blocks(page_id, sort_order);

-- ---------------------------------------------------------------------------
-- 7) Supabase Storage buckets for template imports
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('template-packages', 'template-packages', false)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('template-assets', 'template-assets', true)
ON CONFLICT DO NOTHING;

