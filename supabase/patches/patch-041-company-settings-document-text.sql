alter table if exists public.company_settings
  add column if not exists quote_footer_text text,
  add column if not exists invoice_additional_text text,
  add column if not exists quote_additional_text text;
