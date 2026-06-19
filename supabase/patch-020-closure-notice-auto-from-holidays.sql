-- Auto-publish website closure notice when public/bank holidays are added/imported.

alter table if exists public.company_settings
  add column if not exists website_closure_notice_auto_from_holidays boolean not null default false;
