-- Migration 0083: Phase 2 - Website builder schema
-- Tables:
--   website_templates      — platform-managed design templates
--   websites               — one per tenant, core settings and status
--   website_domains        — custom domain + Cloudflare provisioning state
--   website_pages          — CMS pages (service pages, location pages, static)
--   website_page_versions  — full version history per page
--   website_blocks         — content blocks within a page
--   website_blog_posts     — blog with draft/publish workflow
--   website_blog_categories
--   website_testimonials
--   website_gallery_items
--   website_forms          — contact/quote forms tied to a website
--   website_form_submissions

-- ─── 1. Templates (platform-managed) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  thumbnail_url TEXT,
  preview_url   TEXT,
  category      TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'heating', 'plumbing', 'renewable', 'emergency')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  default_pages JSONB NOT NULL DEFAULT '[]', -- array of {slug, title, template_key}
  default_theme JSONB NOT NULL DEFAULT '{}', -- colours, fonts
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON website_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_templates_read" ON website_templates;
CREATE POLICY "website_templates_read" ON website_templates
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "website_templates_super_admin" ON website_templates;
CREATE POLICY "website_templates_super_admin" ON website_templates
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'super_admin');

-- ─── 2. Websites ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS websites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES website_templates(id) ON DELETE SET NULL,
  applied_template_version INTEGER,
  applied_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'suspended')),
  -- Branding (overrides company_settings for the public site)
  site_name       TEXT,
  tagline         TEXT,
  logo_url        TEXT,
  favicon_url     TEXT,
  -- Theme (colours, fonts — merged with template defaults)
  theme           JSONB NOT NULL DEFAULT '{}',
  -- SEO defaults (overridable per page)
  default_meta_title       TEXT,
  default_meta_description TEXT,
  google_analytics_id      TEXT,
  google_search_console_verification TEXT,
  -- Social media links for the website footer
  social_links    JSONB NOT NULL DEFAULT '{}',
  -- Preview URL (Cloudflare Pages or internal)
  preview_url     TEXT,
  -- Timestamps
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_websites_tenant ON websites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_websites_status ON websites(status);

DROP TRIGGER IF EXISTS set_updated_at ON websites;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON websites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "websites_tenant" ON websites;
CREATE POLICY "websites_tenant" ON websites
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = websites.tenant_id
    )
  );

-- ─── 3. Website domains ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_domains (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id              UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain                  TEXT NOT NULL UNIQUE,    -- e.g. jimboilers.co.uk
  www_redirect            BOOLEAN NOT NULL DEFAULT true, -- redirect www → apex
  -- Verification
  verification_status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verifying', 'verified', 'failed')),
  verification_token      TEXT UNIQUE,             -- TXT record value for DNS proof
  dns_checked_at          TIMESTAMPTZ,
  -- SSL
  ssl_status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'failed')),
  ssl_checked_at          TIMESTAMPTZ,
  -- Cloudflare for SaaS
  cf_hostname_id          TEXT UNIQUE,             -- returned by Cloudflare API
  cf_ownership_verified   BOOLEAN NOT NULL DEFAULT false,
  cf_ssl_verified         BOOLEAN NOT NULL DEFAULT false,
  -- Activation
  is_primary              BOOLEAN NOT NULL DEFAULT true,
  is_active               BOOLEAN NOT NULL DEFAULT false, -- true when DNS+SSL ready
  activated_at            TIMESTAMPTZ,
  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_domains_website ON website_domains(website_id);
CREATE INDEX IF NOT EXISTS idx_website_domains_domain  ON website_domains(domain);
CREATE INDEX IF NOT EXISTS idx_website_domains_tenant  ON website_domains(tenant_id);

DROP TRIGGER IF EXISTS set_updated_at ON website_domains;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_domains_tenant" ON website_domains;
CREATE POLICY "website_domains_tenant" ON website_domains
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = website_domains.tenant_id
    )
  );

-- ─── 4. Website pages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id      UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,          -- URL path, e.g. 'boiler-servicing'
  page_type       TEXT NOT NULL DEFAULT 'custom'
    CHECK (page_type IN ('home', 'service', 'location', 'about', 'contact', 'blog_index', 'custom')),
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  -- SEO
  meta_title      TEXT,
  meta_description TEXT,
  og_image_url    TEXT,
  canonical_url   TEXT,
  no_index        BOOLEAN NOT NULL DEFAULT false,
  -- Schema markup (JSON-LD)
  schema_markup   JSONB,
  -- Navigation
  show_in_nav     BOOLEAN NOT NULL DEFAULT false,
  nav_label       TEXT,
  nav_order       INTEGER DEFAULT 0,
  -- Publishing
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_pages_website  ON website_pages(website_id, slug);
CREATE INDEX IF NOT EXISTS idx_website_pages_tenant   ON website_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_website_pages_status   ON website_pages(status);

DROP TRIGGER IF EXISTS set_updated_at ON website_pages;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_pages_tenant" ON website_pages;
CREATE POLICY "website_pages_tenant" ON website_pages
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = website_pages.tenant_id
    )
  );

-- ─── 5. Website page versions (version history) ───────────────────────────────

CREATE TABLE IF NOT EXISTS website_page_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  blocks      JSONB NOT NULL DEFAULT '[]',  -- snapshot of blocks at this version
  meta_title  TEXT,
  meta_description TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_id, version)
);

CREATE INDEX IF NOT EXISTS idx_page_versions_page ON website_page_versions(page_id, version DESC);

ALTER TABLE website_page_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_versions_tenant" ON website_page_versions;
CREATE POLICY "page_versions_tenant" ON website_page_versions
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = website_page_versions.tenant_id
    )
  );

-- ─── 6. Website blocks (page content) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  block_type  TEXT NOT NULL,
  -- e.g. 'hero', 'text', 'services_grid', 'testimonials', 'faq', 'cta',
  --      'gallery', 'contact_form', 'map', 'trust_badges', 'stats'
  content     JSONB NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_blocks_page ON website_blocks(page_id, sort_order);

DROP TRIGGER IF EXISTS set_updated_at ON website_blocks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_blocks_tenant" ON website_blocks;
CREATE POLICY "website_blocks_tenant" ON website_blocks
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = website_blocks.tenant_id
    )
  );

-- ─── 7. Blog posts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_blog_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, slug)
);

ALTER TABLE website_blog_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blog_cats_tenant" ON website_blog_categories;
CREATE POLICY "blog_cats_tenant" ON website_blog_categories
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = website_blog_categories.tenant_id)
  );

CREATE TABLE IF NOT EXISTS website_blog_posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id       UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES website_blog_categories(id) ON DELETE SET NULL,
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  excerpt          TEXT,
  content          JSONB NOT NULL DEFAULT '[]',   -- array of blocks, same schema as website_blocks.content
  featured_image_url TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  -- SEO
  meta_title       TEXT,
  meta_description TEXT,
  -- Authorship
  author_name      TEXT,
  -- AI generation flag
  ai_generated     BOOLEAN NOT NULL DEFAULT false,
  -- Publishing
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_website ON website_blog_posts(website_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant  ON website_blog_posts(tenant_id);

DROP TRIGGER IF EXISTS set_updated_at ON website_blog_posts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blog_posts_tenant" ON website_blog_posts;
CREATE POLICY "blog_posts_tenant" ON website_blog_posts
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = website_blog_posts.tenant_id)
  );

-- ─── 8. Testimonials ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_testimonials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  location    TEXT,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  body        TEXT NOT NULL,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_website ON website_testimonials(website_id, is_visible, sort_order);

DROP TRIGGER IF EXISTS set_updated_at ON website_testimonials;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_testimonials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "testimonials_tenant" ON website_testimonials;
CREATE POLICY "testimonials_tenant" ON website_testimonials
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = website_testimonials.tenant_id)
  );

-- ─── 9. Gallery ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_gallery_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  alt_text    TEXT,
  category    TEXT,   -- e.g. 'before', 'after', 'installation'
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_website ON website_gallery_items(website_id, is_visible, sort_order);

ALTER TABLE website_gallery_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gallery_tenant" ON website_gallery_items;
CREATE POLICY "gallery_tenant" ON website_gallery_items
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = website_gallery_items.tenant_id)
  );

-- ─── 10. Contact/quote forms ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_forms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  form_type    TEXT NOT NULL DEFAULT 'contact'
    CHECK (form_type IN ('contact', 'quote', 'callback', 'emergency')),
  fields       JSONB NOT NULL DEFAULT '[]',   -- array of {name, label, type, required}
  notify_email TEXT,                          -- override notification email
  -- When job_management module is enabled: auto-create enquiry/lead
  auto_create_enquiry BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON website_forms;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON website_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE website_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "forms_tenant" ON website_forms;
CREATE POLICY "forms_tenant" ON website_forms
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = website_forms.tenant_id)
  );

-- ─── 11. Form submissions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS website_form_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL REFERENCES website_forms(id) ON DELETE CASCADE,
  website_id    UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data          JSONB NOT NULL DEFAULT '{}',  -- submitted field values
  status        TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'read', 'converted', 'spam')),
  -- When converted to TradeWorkDesk enquiry
  enquiry_id    UUID,    -- references enquiries(id) — no FK to avoid cross-module coupling
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant  ON website_form_submissions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form    ON website_form_submissions(form_id, status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_website ON website_form_submissions(website_id, status);

ALTER TABLE website_form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "form_submissions_tenant" ON website_form_submissions;
CREATE POLICY "form_submissions_tenant" ON website_form_submissions
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = website_form_submissions.tenant_id)
  );

-- Public insert: allow unauthenticated form submissions from the rendered site
DROP POLICY IF EXISTS "form_submissions_public_insert" ON website_form_submissions;
CREATE POLICY "form_submissions_public_insert" ON website_form_submissions
  FOR INSERT TO anon
  WITH CHECK (true);

-- ─── 12. Seed: default website template ──────────────────────────────────────

INSERT INTO website_templates (name, slug, description, category, sort_order, default_pages, default_theme)
VALUES (
  'Tradesperson Pro',
  'tradesperson-pro',
  'Clean, professional template designed for heating engineers and plumbers. Mobile-first with strong local SEO structure.',
  'heating',
  1,
  '[
    {"slug": "", "title": "Home", "page_type": "home", "show_in_nav": true, "nav_label": "Home", "nav_order": 1},
    {"slug": "services", "title": "Services", "page_type": "custom", "show_in_nav": true, "nav_label": "Services", "nav_order": 2},
    {"slug": "about", "title": "About Us", "page_type": "about", "show_in_nav": true, "nav_label": "About", "nav_order": 3},
    {"slug": "contact", "title": "Contact", "page_type": "contact", "show_in_nav": true, "nav_label": "Contact", "nav_order": 4}
  ]'::jsonb,
  '{
    "primaryColour": "#1e40af",
    "accentColour": "#f97316",
    "fontHeading": "Inter",
    "fontBody": "Inter",
    "borderRadius": "md"
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
