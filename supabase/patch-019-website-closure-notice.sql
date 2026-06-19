-- Website closure notice shown on public website pages.
-- Used by Leave & Holidays page controls.

alter table if exists public.company_settings
  add column if not exists website_closure_notice_enabled boolean not null default false;

alter table if exists public.company_settings
  add column if not exists website_closure_notice_message text;

alter table if exists public.company_settings
  add column if not exists website_closure_notice_start_date date;

alter table if exists public.company_settings
  add column if not exists website_closure_notice_end_date date;
