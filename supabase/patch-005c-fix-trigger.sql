-- patch-005c: Robust handle_new_user trigger fix
-- Safe to run at any stage of migration (handles presence/absence of tenant_id column).
-- Run this in Supabase SQL Editor to fix "Database error creating new user".

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role;
  assigned_tenant_id UUID;
  has_tenant_col BOOLEAN;
BEGIN
  -- Determine role from metadata, else first user = admin, rest = technician
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    BEGIN
      assigned_role := (NEW.raw_user_meta_data->>'role')::user_role;
    EXCEPTION WHEN invalid_text_representation THEN
      assigned_role := 'technician';
    END;
  ELSIF NOT EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'technician';
  END IF;

  -- Check whether profiles.tenant_id column exists yet
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'tenant_id'
  ) INTO has_tenant_col;

  IF has_tenant_col THEN
    IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
      assigned_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    ELSE
      assigned_tenant_id := '00000000-0000-0000-0000-000000000001';
    END IF;

    INSERT INTO profiles (id, email, full_name, role, tenant_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      assigned_role,
      assigned_tenant_id
    )
    ON CONFLICT (id) DO UPDATE SET
      role      = EXCLUDED.role,
      tenant_id = EXCLUDED.tenant_id,
      full_name = EXCLUDED.full_name;
  ELSE
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      assigned_role
    )
    ON CONFLICT (id) DO UPDATE SET
      role      = EXCLUDED.role,
      full_name = EXCLUDED.full_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
