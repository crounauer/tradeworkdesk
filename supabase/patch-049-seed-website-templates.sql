-- patch-049: Seed all 5 website templates
-- Slugs must match TEMPLATE_MAP keys in TemplateLayout.tsx

-- Remove legacy templates that are no longer supported
DELETE FROM website_templates WHERE slug NOT IN ('classic', 'modern', 'bold', 'professional', 'minimal');

INSERT INTO website_templates (name, slug, description, category, sort_order, default_pages, default_theme, is_active)
VALUES
  (
    'Classic',
    'classic',
    'Dark navy header, traditional tradesperson layout. Clean and professional.',
    'general',
    1,
    '[
      {"slug": "", "title": "Home", "page_type": "home", "show_in_nav": true, "nav_label": "Home", "nav_order": 1},
      {"slug": "services", "title": "Services", "page_type": "custom", "show_in_nav": true, "nav_label": "Services", "nav_order": 2},
      {"slug": "why-us", "title": "Why Us", "page_type": "custom", "show_in_nav": true, "nav_label": "Why Us", "nav_order": 3},
      {"slug": "reviews", "title": "Reviews", "page_type": "custom", "show_in_nav": true, "nav_label": "Reviews", "nav_order": 4},
      {"slug": "areas", "title": "Areas", "page_type": "custom", "show_in_nav": true, "nav_label": "Areas", "nav_order": 5},
      {"slug": "faq", "title": "FAQ", "page_type": "custom", "show_in_nav": true, "nav_label": "FAQ", "nav_order": 6},
      {"slug": "contact", "title": "Contact", "page_type": "contact", "show_in_nav": true, "nav_label": "Contact", "nav_order": 7}
    ]'::jsonb,
    '{"nav_background": "#1c2942", "nav_text": "#ffffff", "footer_background": "#111827", "footer_text": "#9ca3af", "accent_color": "#f97316"}'::jsonb,
    true
  ),
  (
    'Modern',
    'modern',
    'White header with teal accent bar. Clean, contemporary split-hero layout.',
    'general',
    2,
    '[
      {"slug": "", "title": "Home", "page_type": "home", "show_in_nav": true, "nav_label": "Home", "nav_order": 1},
      {"slug": "services", "title": "Services", "page_type": "custom", "show_in_nav": true, "nav_label": "Services", "nav_order": 2},
      {"slug": "how-it-works", "title": "How It Works", "page_type": "custom", "show_in_nav": true, "nav_label": "How It Works", "nav_order": 3},
      {"slug": "projects", "title": "Projects", "page_type": "custom", "show_in_nav": true, "nav_label": "Projects", "nav_order": 4},
      {"slug": "reviews", "title": "Reviews", "page_type": "custom", "show_in_nav": true, "nav_label": "Reviews", "nav_order": 5},
      {"slug": "areas", "title": "Areas", "page_type": "custom", "show_in_nav": true, "nav_label": "Areas", "nav_order": 6},
      {"slug": "contact", "title": "Contact", "page_type": "contact", "show_in_nav": true, "nav_label": "Contact", "nav_order": 7}
    ]'::jsonb,
    '{"nav_background": "#ffffff", "nav_text": "#111827", "footer_background": "#1f2937", "footer_text": "#9ca3af", "accent_color": "#0d9488"}'::jsonb,
    true
  ),
  (
    'Bold',
    'bold',
    'Very dark slate background. High contrast and impactful.',
    'general',
    3,
    '[]'::jsonb,
    '{"nav_background": "#0f172a", "nav_text": "#f8fafc", "footer_background": "#0f172a", "footer_text": "#94a3b8", "accent_color": "#f59e0b"}'::jsonb,
    true
  ),
  (
    'Professional',
    'professional',
    'Warm amber accents. Approachable yet expert feel.',
    'general',
    4,
    '[]'::jsonb,
    '{"nav_background": "#78350f", "nav_text": "#fef3c7", "footer_background": "#1c1917", "footer_text": "#a8a29e", "accent_color": "#f59e0b"}'::jsonb,
    true
  ),
  (
    'Minimal',
    'minimal',
    'Light grey background. Simple and understated.',
    'general',
    5,
    '[]'::jsonb,
    '{"nav_background": "#f9fafb", "nav_text": "#111827", "footer_background": "#f3f4f6", "footer_text": "#6b7280", "accent_color": "#10b981"}'::jsonb,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  default_pages = EXCLUDED.default_pages,
  default_theme = EXCLUDED.default_theme,
  is_active = EXCLUDED.is_active;
