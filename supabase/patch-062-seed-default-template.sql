-- patch-062: Add default_pages / default_theme columns to website_templates
-- and seed a default "Tradesperson Pro" template so users can build websites.
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT DO NOTHING).

ALTER TABLE website_templates
  ADD COLUMN IF NOT EXISTS default_pages JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS default_theme JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preview_image_url TEXT;

-- Back-fill preview_image_url from thumbnail_url where column was already named differently
UPDATE website_templates
   SET preview_image_url = thumbnail_url
 WHERE preview_image_url IS NULL AND thumbnail_url IS NOT NULL;

-- Seed the default template if it doesn't already exist
INSERT INTO website_templates (
  name, slug, description, category, sort_order, is_active,
  default_pages, default_theme
)
VALUES (
  'Tradesperson Pro',
  'tradesperson-pro',
  'Clean, professional template designed for heating engineers and plumbers. Mobile-first with strong local SEO structure.',
  'heating',
  1,
  true,
  '[
    {"slug": "home",        "title": "Home",         "page_type": "home",    "show_in_nav": true,  "nav_label": "Home",         "nav_order": 1},
    {"slug": "services",    "title": "Services",     "page_type": "custom",  "show_in_nav": true,  "nav_label": "Services",     "nav_order": 2},
    {"slug": "how-it-works","title": "How It Works", "page_type": "custom",  "show_in_nav": true,  "nav_label": "How It Works", "nav_order": 3},
    {"slug": "projects",    "title": "Projects",     "page_type": "custom",  "show_in_nav": true,  "nav_label": "Projects",     "nav_order": 4},
    {"slug": "reviews",     "title": "Reviews",      "page_type": "custom",  "show_in_nav": true,  "nav_label": "Reviews",      "nav_order": 5},
    {"slug": "areas",       "title": "Areas We Cover","page_type": "custom", "show_in_nav": true,  "nav_label": "Areas We Cover","nav_order": 6},
    {"slug": "contact",     "title": "Contact",      "page_type": "contact", "show_in_nav": true,  "nav_label": "Contact",      "nav_order": 7}
  ]'::jsonb,
  '{
    "primaryColour": "#1e40af",
    "accentColour":  "#f97316",
    "fontHeading":   "Inter",
    "fontBody":      "Inter",
    "borderRadius":  "md"
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET is_active     = true,
      default_pages = EXCLUDED.default_pages,
      default_theme = EXCLUDED.default_theme;
