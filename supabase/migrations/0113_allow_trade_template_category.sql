alter table public.website_templates
  drop constraint if exists website_templates_category_check;

alter table public.website_templates
  add constraint website_templates_category_check
  check (
    category is null
    or category in (
      'business',
      'portfolio',
      'restaurant',
      'health',
      'fitness',
      'beauty',
      'property',
      'ecommerce',
      'blog',
      'trade'
    )
  );

comment on constraint website_templates_category_check on public.website_templates is
  'Allowed template categories, including trade for TWD local-service templates.';
