-- Ensure website closure notice columns exist on company_settings.
-- This mirrors supabase/patch-019-website-closure-notice.sql as a numbered migration
-- so managed migration flows cannot miss it.

ALTER TABLE IF EXISTS public.company_settings
  ADD COLUMN IF NOT EXISTS website_closure_notice_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.company_settings
  ADD COLUMN IF NOT EXISTS website_closure_notice_message TEXT;

ALTER TABLE IF EXISTS public.company_settings
  ADD COLUMN IF NOT EXISTS website_closure_notice_start_date DATE;

ALTER TABLE IF EXISTS public.company_settings
  ADD COLUMN IF NOT EXISTS website_closure_notice_end_date DATE;
