-- Migration 0102: Final Security Advisor SQL hardening

-- ---------------------------------------------------------------------------
-- 1) Remove signed-in SECURITY DEFINER warnings for helper functions used in RLS
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.get_user_role(UUID) SECURITY INVOKER';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER FUNCTION public.get_user_tenant_id(UUID) SECURITY INVOKER';
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
END
$$;

-- Keep execution surface minimal.
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

-- ---------------------------------------------------------------------------
-- 2) Remove broad listing policy on company-logos
-- ---------------------------------------------------------------------------
-- Public object URLs remain usable via bucket public access, but API SELECT/list
-- is constrained to admins/super-admins or objects in the user's tenant prefix.
DROP POLICY IF EXISTS "company_logos_read" ON storage.objects;
CREATE POLICY "company_logos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (
      get_user_role(auth.uid()) IN ('admin', 'super_admin')
      OR (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    )
  );
