-- Migration 0099: Populate template default_pages
-- Defines the pages and blocks that should be created when a website uses a template

UPDATE website_templates
SET default_pages = jsonb_build_array(
  jsonb_build_object(
    'slug', 'home',
    'title', 'Home',
    'page_type', 'home',
    'show_in_nav', true,
    'nav_order', 0,
    'blocks', jsonb_build_array(
      jsonb_build_object('type', 'hero', 'sort_order', 0),
      jsonb_build_object('type', 'features', 'sort_order', 1),
      jsonb_build_object('type', 'services_grid', 'sort_order', 2),
      jsonb_build_object('type', 'testimonials', 'sort_order', 3),
      jsonb_build_object('type', 'trust_badges', 'sort_order', 4),
      jsonb_build_object('type', 'cta', 'sort_order', 5)
    )
  ),
  jsonb_build_object(
    'slug', 'services',
    'title', 'Services',
    'page_type', 'service',
    'show_in_nav', true,
    'nav_order', 1,
    'blocks', jsonb_build_array(
      jsonb_build_object('type', 'hero', 'sort_order', 0),
      jsonb_build_object('type', 'services_grid', 'sort_order', 1),
      jsonb_build_object('type', 'cta', 'sort_order', 2)
    )
  ),
  jsonb_build_object(
    'slug', 'how-it-works',
    'title', 'How It Works',
    'page_type', 'custom',
    'show_in_nav', true,
    'nav_order', 2,
    'blocks', jsonb_build_array(
      jsonb_build_object('type', 'hero', 'sort_order', 0),
      jsonb_build_object('type', 'text', 'sort_order', 1),
      jsonb_build_object('type', 'stats', 'sort_order', 2)
    )
  ),
  jsonb_build_object(
    'slug', 'projects',
    'title', 'Projects',
    'page_type', 'custom',
    'show_in_nav', true,
    'nav_order', 3,
    'blocks', jsonb_build_array(
      jsonb_build_object('type', 'hero', 'sort_order', 0),
      jsonb_build_object('type', 'gallery', 'sort_order', 1)
    )
  ),
  jsonb_build_object(
    'slug', 'reviews',
    'title', 'Reviews',
    'page_type', 'custom',
    'show_in_nav', true,
    'nav_order', 4,
    'blocks', jsonb_build_array(
      jsonb_build_object('type', 'hero', 'sort_order', 0),
      jsonb_build_object('type', 'testimonials', 'sort_order', 1)
    )
  ),
  jsonb_build_object(
    'slug', 'contact',
    'title', 'Contact',
    'page_type', 'contact',
    'show_in_nav', true,
    'nav_order', 5,
    'blocks', jsonb_build_array(
      jsonb_build_object('type', 'hero', 'sort_order', 0),
      jsonb_build_object('type', 'contact_form', 'sort_order', 1),
      jsonb_build_object('type', 'map', 'sort_order', 2)
    )
  )
)
WHERE is_active = true;
