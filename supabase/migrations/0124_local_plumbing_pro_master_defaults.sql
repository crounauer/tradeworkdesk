-- Migration 0124: Local Plumbing Pro master defaults + tenant backfill
-- Ensures top info row and lower icon strip are represented by real editable blocks.

-- 1) Update master template default_pages so new tenants get explicit blocks.
UPDATE website_templates
SET default_pages = $json$
[
  {
    "slug": "home",
    "title": "Home",
    "page_type": "home",
    "show_in_nav": true,
    "nav_label": null,
    "nav_order": 1,
    "blocks": [
      {
        "type": "site.header",
        "sort_order": 0,
        "content": {
          "variant": "figma",
          "logoText": "Your Business",
          "scheduleText": "Mon-Sat 7am-8pm | Emergency 24/7",
          "locationText": "Reading & Surrounding Areas",
          "ctaLabel": "Call Now",
          "ctaHref": "#contact"
        }
      },
      {
        "type": "hero",
        "sort_order": 1,
        "content": {
          "heading": "Reliable Local Plumbing Services",
          "subheading": "Honest, fast and fully insured plumbers serving your area. Free quotes, 12-month guarantee.",
          "cta_text": "Call Now",
          "cta_url": "#contact",
          "secondary_cta_text": "Request a Quote",
          "secondary_cta_url": "#contact",
          "overlay_color": "15,31,61",
          "overlay_opacity": 0.75,
          "heading_color": "#ffffff",
          "subheading_color": "rgba(255,255,255,0.8)",
          "primary_button_bg_color": "#00a8a8",
          "primary_button_text_color": "#ffffff",
          "secondary_button_bg_color": "#ffffff",
          "secondary_button_text_color": "#1a3a6b",
          "secondary_button_border_color": "rgba(26, 58, 107, 0.12)",
          "border_radius": "10px",
          "trust_items": [
            { "text": "Fully Insured", "icon": "🛡" },
            { "text": "Local Engineers", "icon": "📍" },
            { "text": "Fast Response", "icon": "⚡" },
            { "text": "Free Quotes", "icon": "✓" }
          ]
        }
      },
      {
        "type": "features_bar",
        "sort_order": 2,
        "content": {
          "layout_variant": "local-strip",
          "section_bg": "#EEF3F8",
          "card_bg": "#EEF3F8",
          "heading_color": "#1A3A6B",
          "text_color": "#1A3A6B",
          "accent_color": "#00A8A8",
          "border_color": "rgba(26, 58, 107, 0.14)",
          "features": [
            { "title": "Fully Insured", "icon": "🛡" },
            { "title": "Local Engineers", "icon": "📍" },
            { "title": "2-Hour Emergency", "icon": "⚡" },
            { "title": "Free Quotes", "icon": "✓" },
            { "title": "12-Month Guarantee", "icon": "◎" },
            { "title": "Mon-Sat 7am-8pm", "icon": "◷" }
          ]
        }
      },
      { "type": "services", "sort_order": 3 },
      { "type": "process", "sort_order": 4 },
      { "type": "testimonials", "sort_order": 5 },
      { "type": "trust_badges", "sort_order": 6 },
      { "type": "cta", "sort_order": 7 }
    ]
  },
  {
    "slug": "services",
    "title": "Services",
    "page_type": "custom",
    "show_in_nav": true,
    "nav_label": null,
    "nav_order": 2,
    "blocks": [
      { "type": "hero", "sort_order": 0 },
      { "type": "services", "sort_order": 1 },
      { "type": "cta", "sort_order": 2 }
    ]
  },
  {
    "slug": "how-it-works",
    "title": "How It Works",
    "page_type": "custom",
    "show_in_nav": true,
    "nav_label": null,
    "nav_order": 3,
    "blocks": [
      { "type": "hero", "sort_order": 0 },
      { "type": "process", "sort_order": 1 },
      { "type": "cta", "sort_order": 2 }
    ]
  },
  {
    "slug": "projects",
    "title": "Projects",
    "page_type": "custom",
    "show_in_nav": true,
    "nav_label": null,
    "nav_order": 4,
    "blocks": [
      { "type": "hero", "sort_order": 0 },
      { "type": "projects", "sort_order": 1 },
      { "type": "cta", "sort_order": 2 }
    ]
  },
  {
    "slug": "reviews",
    "title": "Reviews",
    "page_type": "custom",
    "show_in_nav": true,
    "nav_label": null,
    "nav_order": 5,
    "blocks": [
      { "type": "hero", "sort_order": 0 },
      { "type": "testimonials", "sort_order": 1 },
      { "type": "cta", "sort_order": 2 }
    ]
  },
  {
    "slug": "areas",
    "title": "Areas We Cover",
    "page_type": "custom",
    "show_in_nav": true,
    "nav_label": null,
    "nav_order": 6,
    "blocks": [
      { "type": "hero", "sort_order": 0 },
      { "type": "areas", "sort_order": 1 },
      { "type": "cta", "sort_order": 2 }
    ]
  },
  {
    "slug": "contact",
    "title": "Contact",
    "page_type": "custom",
    "show_in_nav": true,
    "nav_label": null,
    "nav_order": 7,
    "blocks": [
      { "type": "hero", "sort_order": 0 },
      { "type": "contact", "sort_order": 1 }
    ]
  }
]
$json$::jsonb
WHERE lower(slug) = 'local-plumbing-pro';

-- 2) Backfill existing tenant home pages using local-plumbing-pro.
WITH plumbing_home_pages AS (
  SELECT wp.id AS page_id, wp.tenant_id
  FROM website_pages wp
  JOIN websites w ON w.id = wp.website_id
  JOIN website_templates wt ON wt.id = w.template_id
  WHERE lower(wt.slug) = 'local-plumbing-pro'
    AND (wp.page_type = 'home' OR wp.slug IN ('home', '/', '/home'))
),
inserted_site_header AS (
  INSERT INTO website_blocks (page_id, tenant_id, block_type, content, sort_order, is_visible)
  SELECT
    hp.page_id,
    hp.tenant_id,
    'site.header',
    jsonb_build_object(
      'variant', 'figma',
      'logoText', 'Your Business',
      'scheduleText', 'Mon-Sat 7am-8pm | Emergency 24/7',
      'locationText', 'Reading & Surrounding Areas',
      'ctaLabel', 'Call Now',
      'ctaHref', '#contact'
    ),
    0,
    true
  FROM plumbing_home_pages hp
  WHERE NOT EXISTS (
    SELECT 1
    FROM website_blocks wb
    WHERE wb.page_id = hp.page_id
      AND lower(wb.block_type) IN ('site.header', 'site_header', 'header')
  )
  RETURNING id, page_id
),
shift_existing_after_header AS (
  UPDATE website_blocks wb
  SET sort_order = wb.sort_order + 1
  FROM inserted_site_header ish
  WHERE wb.page_id = ish.page_id
    AND wb.id <> ish.id
  RETURNING wb.id
)
INSERT INTO website_blocks (page_id, tenant_id, block_type, content, sort_order, is_visible)
SELECT
  hp.page_id,
  hp.tenant_id,
  'features_bar',
  jsonb_build_object(
    'layout_variant', 'local-strip',
    'section_bg', '#EEF3F8',
    'card_bg', '#EEF3F8',
    'heading_color', '#1A3A6B',
    'text_color', '#1A3A6B',
    'accent_color', '#00A8A8',
    'border_color', 'rgba(26, 58, 107, 0.14)',
    'features', jsonb_build_array(
      jsonb_build_object('title', 'Fully Insured', 'icon', '🛡'),
      jsonb_build_object('title', 'Local Engineers', 'icon', '📍'),
      jsonb_build_object('title', '2-Hour Emergency', 'icon', '⚡'),
      jsonb_build_object('title', 'Free Quotes', 'icon', '✓'),
      jsonb_build_object('title', '12-Month Guarantee', 'icon', '◎'),
      jsonb_build_object('title', 'Mon-Sat 7am-8pm', 'icon', '◷')
    )
  ),
  2,
  true
FROM plumbing_home_pages hp
WHERE NOT EXISTS (
  SELECT 1
  FROM website_blocks wb
  WHERE wb.page_id = hp.page_id
    AND lower(wb.block_type) = 'features_bar'
);

-- Ensure existing Site Header blocks and Features Bar blocks contain template defaults
-- while preserving any tenant overrides (existing keys win).
WITH plumbing_home_pages AS (
  SELECT wp.id AS page_id
  FROM website_pages wp
  JOIN websites w ON w.id = wp.website_id
  JOIN website_templates wt ON wt.id = w.template_id
  WHERE lower(wt.slug) = 'local-plumbing-pro'
    AND (wp.page_type = 'home' OR wp.slug IN ('home', '/', '/home'))
)
UPDATE website_blocks wb
SET content =
  CASE
    WHEN lower(wb.block_type) IN ('site.header', 'site_header', 'header') THEN
      jsonb_build_object(
        'variant', 'figma',
        'logoText', 'Your Business',
        'scheduleText', 'Mon-Sat 7am-8pm | Emergency 24/7',
        'locationText', 'Reading & Surrounding Areas',
        'ctaLabel', 'Call Now',
        'ctaHref', '#contact'
      ) || coalesce(wb.content, '{}'::jsonb)
    WHEN lower(wb.block_type) = 'features_bar' THEN
      jsonb_build_object(
        'layout_variant', 'local-strip',
        'section_bg', '#EEF3F8',
        'card_bg', '#EEF3F8',
        'heading_color', '#1A3A6B',
        'text_color', '#1A3A6B',
        'accent_color', '#00A8A8',
        'border_color', 'rgba(26, 58, 107, 0.14)',
        'features', jsonb_build_array(
          jsonb_build_object('title', 'Fully Insured', 'icon', '🛡'),
          jsonb_build_object('title', 'Local Engineers', 'icon', '📍'),
          jsonb_build_object('title', '2-Hour Emergency', 'icon', '⚡'),
          jsonb_build_object('title', 'Free Quotes', 'icon', '✓'),
          jsonb_build_object('title', '12-Month Guarantee', 'icon', '◎'),
          jsonb_build_object('title', 'Mon-Sat 7am-8pm', 'icon', '◷')
        )
      ) || coalesce(wb.content, '{}'::jsonb)
    WHEN lower(wb.block_type) IN ('hero', 'hero_split') THEN
      jsonb_build_object(
        'trust_items', jsonb_build_array(
          jsonb_build_object('text', 'Fully Insured', 'icon', '🛡'),
          jsonb_build_object('text', 'Local Engineers', 'icon', '📍'),
          jsonb_build_object('text', 'Fast Response', 'icon', '⚡'),
          jsonb_build_object('text', 'Free Quotes', 'icon', '✓')
        )
      ) || coalesce(wb.content, '{}'::jsonb)
    ELSE coalesce(wb.content, '{}'::jsonb)
  END
WHERE wb.page_id IN (SELECT page_id FROM plumbing_home_pages)
  AND lower(wb.block_type) IN ('site.header', 'site_header', 'header', 'features_bar', 'hero', 'hero_split');
