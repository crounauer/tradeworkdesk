-- patch-005c: Fix handle_new_user trigger for multi-tenant migration
-- The original trigger had no tenant_id support, causing NOT NULL violations
-- after patch-005 added profiles.tenant_id NOT NULL.
--
-- SOLUTION: The trigger is made trivially safe (just returns NEW).
-- All profile data (tenant_id, role, full_name) is set by the API immediately
-- after auth user creation via an upsert, making the trigger's profile insert
-- redundant and error-prone.
--
-- Run this BEFORE patch-005 if you encounter "Database error creating new user".

-- Remove the existing trigger first to ensure a clean replacement
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Minimal, fail-safe trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Re-attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
