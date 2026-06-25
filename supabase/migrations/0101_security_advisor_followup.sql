-- Migration 0101: Security Advisor follow-up hardening
-- Fixes additional warnings after 0100.

-- ---------------------------------------------------------------------------
-- 1) RLS policy always true: platform_audit_log
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_log_insert" ON public.platform_audit_log;
CREATE POLICY "audit_log_insert" ON public.platform_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    OR get_user_role(auth.uid()) = 'super_admin'
  );

-- ---------------------------------------------------------------------------
-- 2) RLS policy always true: review_requests public tracking
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "review_requests_public_track" ON public.review_requests;
CREATE POLICY "review_requests_public_track" ON public.review_requests
  FOR UPDATE TO anon
  USING (
    tracking_token IS NOT NULL
    AND status IN ('pending', 'sent', 'opened', 'clicked', 'failed', 'suppressed')
  )
  WITH CHECK (
    tracking_token IS NOT NULL
    AND status IN ('pending', 'sent', 'opened', 'clicked', 'failed', 'suppressed')
  );

-- ---------------------------------------------------------------------------
-- 3) RLS policy always true: website_form_submissions public insert
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "form_submissions_public_insert" ON public.website_form_submissions;
CREATE POLICY "form_submissions_public_insert" ON public.website_form_submissions
  FOR INSERT TO anon
  WITH CHECK (
    status = 'new'
    AND enquiry_id IS NULL
    AND jsonb_typeof(data) = 'object'
  );

-- ---------------------------------------------------------------------------
-- 4) Keep bookings public insert constrained, but avoid tenant lookup that can
--    be blocked for anon by RLS on tenants.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bookings_public_insert" ON public.bookings;
CREATE POLICY "bookings_public_insert" ON public.bookings
  FOR INSERT TO anon
  WITH CHECK (
    source = 'website'
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

-- ---------------------------------------------------------------------------
-- 5) Reduce SECURITY DEFINER execute surface
-- ---------------------------------------------------------------------------
-- Trigger/internal functions should not be callable directly by users.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user'
      AND p.pronargs = 0
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'increment_ai_usage_monthly'
      AND p.pronargs = 0
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_ai_usage_monthly() FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.increment_ai_usage_monthly() TO service_role';
  END IF;
END
$$;

-- Best-effort revoke for rls_auto_enable regardless of signature.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT pr.oid::regprocedure AS signature
    FROM pg_proc pr
    JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public'
      AND pr.proname = 'rls_auto_enable'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', p.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', p.signature);
  END LOOP;
END
$$;

-- Keep helper functions callable for RLS policies by signed-in users, but avoid
-- PUBLIC/anon execution.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_role'
      AND p.pronargs = 1
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated, service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_tenant_id'
      AND p.pronargs = 1
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id(UUID) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_tenant_id(UUID) TO authenticated, service_role';
  END IF;
END
$$;
