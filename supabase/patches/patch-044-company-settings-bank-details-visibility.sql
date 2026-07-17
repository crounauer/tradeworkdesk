alter table if exists public.company_settings
  add column if not exists show_bank_details_on_invoices boolean not null default true,
  add column if not exists show_bank_details_on_quotes boolean not null default true;
