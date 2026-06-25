-- Migration 0100: Supabase Security Advisor hardening
-- Fixes:
-- 1) Function Search Path Mutable warnings
-- 2) RLS Policy Always True warnings

-- ---------------------------------------------------------------------------
-- 1) Harden function search_path
-- ---------------------------------------------------------------------------
-- Use a fixed search_path so SECURITY DEFINER / trigger functions do not depend
-- on caller-controlled path resolution.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.get_user_role(UUID) SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.get_user_tenant_id(UUID) SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.set_user_todos_updated_at() SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.next_invoice_number(TEXT, TEXT) SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.update_invoices_updated_at() SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.seed_default_sms_templates(UUID) SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.increment_ai_usage_monthly() SET search_path = public, pg_temp';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) Replace overly permissive RLS policies
-- ---------------------------------------------------------------------------

-- bookings: allow anon insert only for website-origin bookings against a valid
-- tenant, and if a booking service is provided, it must belong to that tenant
-- and be active.
DROP POLICY IF EXISTS "bookings_public_insert" ON public.bookings;
CREATE POLICY "bookings_public_insert" ON public.bookings
  FOR INSERT TO anon
  WITH CHECK (
    source = 'website'
    AND EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = bookings.tenant_id
    )
    AND (
      bookings.booking_service_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.booking_services bs
        WHERE bs.id = bookings.booking_service_id
          AND bs.tenant_id = bookings.tenant_id
          AND bs.is_active = TRUE
      )
    )
  );

-- campaign_recipients: keep public tracking updates possible, but scope them to
-- rows that actually carry a tracking token and a known status.
DROP POLICY IF EXISTS "public_tracking" ON public.campaign_recipients;
CREATE POLICY "public_tracking" ON public.campaign_recipients
  FOR UPDATE TO anon
  USING (
    tracking_token IS NOT NULL
    AND status IN (
      'pending',
      'sent',
      'delivered',
      'bounced',
      'opened',
      'clicked',
      'unsubscribed',
      'failed'
    )
  )
  WITH CHECK (
    tracking_token IS NOT NULL
    AND status IN (
      'pending',
      'sent',
      'delivered',
      'bounced',
      'opened',
      'clicked',
      'unsubscribed',
      'failed'
    )
  );
