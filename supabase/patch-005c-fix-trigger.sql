-- patch-005c: Fix handle_new_user trigger to include tenant_id
-- Run this if registration fails with "Database error creating new user".
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role;
  assigned_tenant_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    assigned_role := (NEW.raw_user_meta_data->>'role')::user_role;
  ELSIF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'technician';
  END IF;

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
    role = EXCLUDED.role,
    tenant_id = EXCLUDED.tenant_id,
    full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
