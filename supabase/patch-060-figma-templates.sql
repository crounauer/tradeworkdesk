-- patch-060: Figma template system for design system management
-- Supports uploading Figma-exported React templates and extracting design tokens

CREATE TABLE IF NOT EXISTS website_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(255) UNIQUE NOT NULL,
  description           TEXT,
  category              VARCHAR(100), -- 'service-trades', 'professional', 'minimal', etc
  version               INTEGER DEFAULT 1,
  
  -- Display
  thumbnail_url         TEXT,
  preview_html_url      TEXT,
  
  -- Design system (extracted from Figma CSS variables)
  design_tokens         JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "colors": {
  --     "primary": "#030213",
  --     "secondary": "#e5e7eb",
  --     "destructive": "#d4183d",
  --     ... (all CSS variables extracted)
  --   },
  --   "typography": {
  --     "fontSizeBase": "16px",
  --     "fontWeightNormal": 400,
  --     "fontWeightMedium": 500,
  --     "radius": "0.625rem"
  --   },
  --   "sidebar": {
  --     "background": "#f3f4f6",
  --     ... (sidebar-specific vars)
  --   }
  -- }
  
  -- Optional demo pages from template
  demo_pages            JSONB DEFAULT '[]',
  -- [
  --   { "slug": "home", "title": "Home", "page_type": "home" },
  --   { "slug": "services", "title": "Services", "page_type": "service-list" }
  -- ]
  
  -- Figma metadata
  figma_export_info     JSONB,
  -- {
  --   "exported_at": "2026-06-23T10:00:00Z",
  --   "figma_project_url": "...",
  --   "component_count": 45,
  --   "sass_version": "14.0.0"
  -- }
  
  -- Lifecycle
  is_active             BOOLEAN DEFAULT false,
  is_featured           BOOLEAN DEFAULT false,
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_active_slug UNIQUE (slug, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Track template versions for rollback capability
CREATE TABLE IF NOT EXISTS template_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           UUID NOT NULL REFERENCES website_templates(id) ON DELETE CASCADE,
  version               INTEGER NOT NULL,
  
  design_tokens         JSONB NOT NULL,
  demo_pages            JSONB NOT NULL,
  
  release_notes         TEXT,
  released_at           TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, version)
);

-- Track which templates were applied to which websites
CREATE TABLE IF NOT EXISTS template_usage_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id            UUID REFERENCES websites(id) ON DELETE CASCADE,
  template_id           UUID REFERENCES website_templates(id) ON DELETE CASCADE,
  
  action                VARCHAR(50), -- 'applied', 'switched', 'removed'
  applied_version       INTEGER,
  content_preserved     BOOLEAN DEFAULT true,
  
  applied_at            TIMESTAMPTZ DEFAULT NOW(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE
);

-- Ensure columns exist (in case table was partially created)
ALTER TABLE website_templates ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE website_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_slug ON website_templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_active ON website_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_featured ON website_templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_category ON website_templates(category);
CREATE INDEX IF NOT EXISTS idx_template_usage_website ON template_usage_log(website_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_tenant ON template_usage_log(tenant_id);

ALTER TABLE website_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;

-- Policies: templates are viewable by anyone, managed by superadmin only
DROP POLICY IF EXISTS "templates_view" ON website_templates;
CREATE POLICY "templates_view" ON website_templates
  FOR SELECT
  USING (is_active = true OR get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "templates_manage" ON website_templates;
CREATE POLICY "templates_manage" ON website_templates
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "templates_manage_update" ON website_templates;
CREATE POLICY "templates_manage_update" ON website_templates
  FOR UPDATE
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "templates_manage_delete" ON website_templates;
CREATE POLICY "templates_manage_delete" ON website_templates
  FOR DELETE
  USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "template_versions_view" ON template_versions;
CREATE POLICY "template_versions_view" ON template_versions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "usage_log_view" ON template_usage_log;
CREATE POLICY "usage_log_view" ON template_usage_log
  FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = template_usage_log.website_id
      AND w.tenant_id = (
        SELECT tenant_id FROM profiles p WHERE p.id = auth.uid()
      )
    )
  );
