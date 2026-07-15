alter table if exists public.service_catalogue
  add column if not exists show_in_website_service_rates boolean not null default false,
  add column if not exists website_service_description text,
  add column if not exists website_service_badge text,
  add column if not exists website_service_price_text text,
  add column if not exists website_service_cta_text text,
  add column if not exists website_service_cta_url text,
  add column if not exists website_service_display_order integer not null default 0;

create index if not exists idx_service_catalogue_website_service_rates
  on public.service_catalogue (tenant_id, show_in_website_service_rates, is_active, website_service_display_order);
