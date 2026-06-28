alter table public.website_templates
  alter column version type text
  using version::text;

comment on column public.website_templates.version is
  'Semantic template package version, for example 1.0.0.';
