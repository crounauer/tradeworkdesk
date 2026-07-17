alter table if exists public.company_settings
  add column if not exists show_rates_url_on_invoices boolean not null default true,
  add column if not exists show_rates_url_on_quotes boolean not null default true,
  add column if not exists show_trading_terms_url_on_invoices boolean not null default true,
  add column if not exists show_trading_terms_url_on_quotes boolean not null default true;
