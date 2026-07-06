-- patch-071: Site pages and blocks for template rendering
-- Stores page and block configuration for websites using templates

CREATE TABLE IF NOT EXISTS site_pages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  website_id            UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  template_id           UUID REFERENCES website_templates(id) ON DELETE SET NULL,
  
  -- Page metadata
  slug                  VARCHAR(255) NOT NULL,
  page_type             VARCHAR(100), -- 'home', 'services', 'contact', etc.
  title                 VARCHAR(255),
  
  -- SEO
  meta_title            VARCHAR(255),
  meta_description      TEXT,
  og_image_url          TEXT,
  canonical_url         TEXT,
  no_index              BOOLEAN DEFAULT false,
  schema_markup         JSONB,
  
  -- Navigation
  show_in_nav           BOOLEAN DEFAULT true,
  nav_label             VARCHAR(255),
  nav_order             INTEGER DEFAULT 0,
  
  -- Status
  status                VARCHAR(50) DEFAULT 'draft', -- 'draft', 'published'
  published_at          TIMESTAMPTZ,
  
  -- Lifecycle
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(website_id, slug)
);

CREATE TABLE IF NOT EXISTS site_blocks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  page_id               UUID NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  website_id            UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  
  -- Block type and content
  block_type            VARCHAR(100) NOT NULL,
  content               JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "layout": "standard",
  --   "accent_color": "#f97316",
  --   "heading_font_family": "Inter",
  --   ... block-specific content
  -- }
  
  -- Display
  sort_order            INTEGER DEFAULT 0,
  hidden                BOOLEAN DEFAULT false,
  
  -- Lifecycle
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_site_pages_website ON site_pages(website_id);
CREATE INDEX IF NOT EXISTS idx_site_pages_template ON site_pages(template_id);
CREATE INDEX IF NOT EXISTS idx_site_pages_status ON site_pages(status);
CREATE INDEX IF NOT EXISTS idx_site_pages_slug ON site_pages(website_id, slug);
CREATE INDEX IF NOT EXISTS idx_site_pages_nav_order ON site_pages(website_id, nav_order);

CREATE INDEX IF NOT EXISTS idx_site_blocks_page ON site_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_site_blocks_website ON site_blocks(website_id);
CREATE INDEX IF NOT EXISTS idx_site_blocks_type ON site_blocks(block_type);
CREATE INDEX IF NOT EXISTS idx_site_blocks_sort ON site_blocks(page_id, sort_order);

-- RLS
ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_blocks ENABLE ROW LEVEL SECURITY;

-- Policies: tenant users can view/manage pages for their websites
DROP POLICY IF EXISTS "pages_view" ON site_pages;
CREATE POLICY "pages_view" ON site_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = site_pages.website_id
      AND w.tenant_id = (
        SELECT tenant_id FROM profiles p WHERE p.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "pages_manage" ON site_pages;
CREATE POLICY "pages_manage" ON site_pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = site_pages.website_id
      AND w.tenant_id = (
        SELECT tenant_id FROM profiles p WHERE p.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "blocks_view" ON site_blocks;
CREATE POLICY "blocks_view" ON site_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = site_blocks.website_id
      AND w.tenant_id = (
        SELECT tenant_id FROM profiles p WHERE p.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "blocks_manage" ON site_blocks;
CREATE POLICY "blocks_manage" ON site_blocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = site_blocks.website_id
      AND w.tenant_id = (
        SELECT tenant_id FROM profiles p WHERE p.id = auth.uid()
      )
    )
  );
