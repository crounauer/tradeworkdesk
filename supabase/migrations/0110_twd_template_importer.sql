-- Migration 0110: TWD Template Importer Schema
--
-- Extends the template import system (0108) with:
-- 1. template_imports table for tracking ZIP import lifecycle
-- 2. website_template_block_registry for storing valid block types per template
-- 3. Additional columns to website_templates for TWD-specific metadata
-- 4. Additional columns to support block-level operations
--
-- This migration supports the TradeWorkDesk template importer workflow:
-- - Import templates from ZIP packages as 'draft' status
-- - Publish templates via explicit publish action
-- - Track block registry per template for validation

-- ---------------------------------------------------------------------------
-- 1) Template import tracking
-- ---------------------------------------------------------------------------
-- Tracks the lifecycle of template imports distinct from file uploads.
-- Each import creates one record with status progression: pending → completed/failed

CREATE TABLE IF NOT EXISTS template_imports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug     TEXT NOT NULL,
  template_name     TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  source_filename   TEXT,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  UNIQUE (template_slug, created_at)
);

CREATE INDEX IF NOT EXISTS idx_template_imports_status
  ON template_imports(status);
CREATE INDEX IF NOT EXISTS idx_template_imports_template_slug
  ON template_imports(template_slug);
CREATE INDEX IF NOT EXISTS idx_template_imports_created_at
  ON template_imports(created_at DESC);

ALTER TABLE template_imports ENABLE ROW LEVEL SECURITY;

-- TODO: Lock this table to superadmin/service-role access before production
DROP POLICY IF EXISTS template_imports_super_admin ON template_imports;
CREATE POLICY template_imports_super_admin ON template_imports
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- 2) TWD-specific columns for website_templates
-- ---------------------------------------------------------------------------
-- Extends website_templates with TWD metadata: industry targeting, style variant,
-- and structured import source information.

ALTER TABLE website_templates
  ADD COLUMN IF NOT EXISTS industries JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS style TEXT,
  ADD COLUMN IF NOT EXISTS source JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Create index for template filtering by industries
CREATE INDEX IF NOT EXISTS idx_website_templates_industries
  ON website_templates USING GIN(industries);

-- ---------------------------------------------------------------------------
-- 3) Block count cache on template pages
-- ---------------------------------------------------------------------------
-- Caches the block count per page to avoid expensive COUNT queries in listings.
-- Updated via trigger when blocks are inserted/deleted.

ALTER TABLE website_template_pages
  ADD COLUMN IF NOT EXISTS block_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_website_template_pages_block_count
  ON website_template_pages(block_count);

-- ---------------------------------------------------------------------------
-- 4) Block ID for TWD block system integration
-- ---------------------------------------------------------------------------
-- Each block in a TWD template has both:
-- - id (UUID for database internal use)
-- - block_id (TEXT for TWD block system, e.g., 'hero-1', 'cta-section-2')
--
-- This allows the TWD block registry and importer to reference blocks
-- consistently across imports.

ALTER TABLE website_template_blocks
  ADD COLUMN IF NOT EXISTS block_id TEXT;

-- Enforce block_id uniqueness per page (if block_id is provided)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'website_template_blocks'
      AND c.conname = 'unique_page_block_id'
  ) THEN
    ALTER TABLE website_template_blocks
      ADD CONSTRAINT unique_page_block_id UNIQUE (page_id, block_id);
  END IF;
END
$$;

-- Enforce sort_order uniqueness per page
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'website_template_blocks'
      AND c.conname = 'unique_page_block_order'
  ) THEN
    ALTER TABLE website_template_blocks
      ADD CONSTRAINT unique_page_block_order UNIQUE (page_id, sort_order);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5) Template block registry
-- ---------------------------------------------------------------------------
-- Per-template registry of valid block types and their metadata.
-- Populated from the source template's block-registry.json during import.
--
-- Enables:
-- - Validation that imported blocks use defined types
-- - Quick lookup of block metadata (label, category, editable fields)
-- - Admin UI to visualize available blocks per template

CREATE TABLE IF NOT EXISTS website_template_block_registry (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    UUID NOT NULL REFERENCES website_templates(id) ON DELETE CASCADE,
  block_type     TEXT NOT NULL,
  label          TEXT NOT NULL,
  category       TEXT NOT NULL,
  editable_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, block_type)
);

CREATE INDEX IF NOT EXISTS idx_website_template_block_registry_template_id
  ON website_template_block_registry(template_id);
CREATE INDEX IF NOT EXISTS idx_website_template_block_registry_block_type
  ON website_template_block_registry(template_id, block_type);
CREATE INDEX IF NOT EXISTS idx_website_template_block_registry_category
  ON website_template_block_registry(template_id, category);

ALTER TABLE website_template_block_registry ENABLE ROW LEVEL SECURITY;

-- TODO: Lock this table to superadmin/service-role access before production
DROP POLICY IF EXISTS website_template_block_registry_super_admin ON website_template_block_registry;
CREATE POLICY website_template_block_registry_super_admin ON website_template_block_registry
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- 6) Trigger to update block_count on website_template_pages
-- ---------------------------------------------------------------------------
-- Maintains the block_count cache when blocks are inserted, updated, or deleted.

DROP TRIGGER IF EXISTS trigger_update_page_block_count ON website_template_blocks;

CREATE OR REPLACE FUNCTION update_page_block_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update block_count on the affected page
  UPDATE website_template_pages
  SET block_count = (
    SELECT COUNT(*)
    FROM website_template_blocks
    WHERE page_id = COALESCE(NEW.page_id, OLD.page_id)
  )
  WHERE id = COALESCE(NEW.page_id, OLD.page_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_page_block_count
  AFTER INSERT OR DELETE ON website_template_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_page_block_count();

-- ---------------------------------------------------------------------------
-- 7) Comments and metadata
-- ---------------------------------------------------------------------------
-- Document the import lifecycle for future reference
COMMENT ON TABLE template_imports IS
  'Tracks the lifecycle of ZIP template imports. Each import creates one record with status progressing from pending to completed or failed.';

COMMENT ON COLUMN template_imports.status IS
  'Import status: pending, completed, failed. Defaults to pending.';

COMMENT ON TABLE website_template_block_registry IS
  'Per-template block type registry. Populated from template block-registry.json during import. Used for validation and admin UI.';

COMMENT ON COLUMN website_templates.industries IS
  'Array of industries this template serves (e.g., ["plumbing", "hvac"]).';

COMMENT ON COLUMN website_templates.style IS
  'TWD template style variant name (e.g., "modern", "classic", "minimal").';

COMMENT ON COLUMN website_templates.source IS
  'Structured metadata about template source: {version, importedFrom, lastImportedAt, etc.}.';

COMMENT ON COLUMN website_template_pages.block_count IS
  'Cache of the number of blocks on this page. Updated automatically by trigger.';

COMMENT ON COLUMN website_template_blocks.block_id IS
  'String identifier from TWD block system (e.g., "hero-1", "cta-section-2"). Used for consistent referencing across imports.';
