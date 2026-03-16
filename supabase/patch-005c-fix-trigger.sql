-- patch-005c v3: Bulletproof handle_new_user trigger
-- The outer EXCEPTION WHEN OTHERS block guarantees the trigger NEVER
-- prevents auth.users insertion. The profile is always created or updated
-- by the API after auth user creation succeeds.
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role := 'technician';
  assigned_tenant_id UUID;
  has_tenant_col BOOLEAN := FALSE;
BEGIN

  -- Safely determine role
  BEGIN
    IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
      assigned_role := (NEW.raw_user_meta_data->>'role')::user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    assigned_role := 'technician';
  END;

  -- Check if tenant_id column exists on profiles
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'profiles'
        AND column_name  = 'tenant_id'
    ) INTO has_tenant_col;
  EXCEPTION WHEN OTHERS THEN
    has_tenant_col := FALSE;
  END;

  -- Build tenant_id
  BEGIN
    IF has_tenant_col AND NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
      assigned_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    ELSIF has_tenant_col THEN
      assigned_tenant_id := '00000000-0000-0000-0000-000000000001'::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    has_tenant_col := FALSE;
  END;

  -- Insert or update profile
  BEGIN
    IF has_tenant_col THEN
      INSERT INTO public.profiles (id, email, full_name, role, tenant_id)
      VALUES (
        NEW.id, NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        assigned_role, assigned_tenant_id
      )
      ON CONFLICT (id) DO UPDATE SET
        role      = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id,
        full_name = EXCLUDED.full_name;
    ELSE
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (
        NEW.id, NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        assigned_role
      )
      ON CONFLICT (id) DO UPDATE SET
        role      = EXCLUDED.role,
        full_name = EXCLUDED.full_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but never block auth user creation
    RAISE WARNING 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Safety net: never block auth.users insertion
  RAISE WARNING 'handle_new_user outer exception for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
