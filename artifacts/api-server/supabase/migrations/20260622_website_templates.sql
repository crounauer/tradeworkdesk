-- Website Templates System
-- Tables for multi-tenant website template management

-- Website Templates table - Central registry of all available templates
CREATE TABLE IF NOT EXISTS website_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  template_path TEXT NOT NULL,
  preview_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_templates_active ON website_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_website_templates_name ON website_templates(name);

-- Websites table - One website per tenant
CREATE TABLE IF NOT EXISTS websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES website_templates(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  customizations TEXT, -- JSON object with color scheme, fonts, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id) -- One website per tenant
);

CREATE INDEX IF NOT EXISTS idx_websites_tenant_id ON websites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_websites_template_id ON websites(template_id);
CREATE INDEX IF NOT EXISTS idx_websites_slug ON websites(slug);

-- Website Pages table - Custom pages created by tenants
CREATE TABLE IF NOT EXISTS website_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT, -- JSON object with page content blocks
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_pages_tenant_id ON website_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_website_pages_slug ON website_pages(tenant_id, slug);

-- Trigger to update updated_at on website_templates
CREATE OR REPLACE FUNCTION update_website_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_website_templates_updated_at
  BEFORE UPDATE ON website_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_website_templates_updated_at();

-- Trigger to update updated_at on websites
CREATE OR REPLACE FUNCTION update_websites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_websites_updated_at
  BEFORE UPDATE ON websites
  FOR EACH ROW
  EXECUTE FUNCTION update_websites_updated_at();

-- Trigger to update updated_at on website_pages
CREATE OR REPLACE FUNCTION update_website_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_website_pages_updated_at
  BEFORE UPDATE ON website_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_website_pages_updated_at();
