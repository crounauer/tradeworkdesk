-- Run this in Supabase SQL Editor to diagnose the registration failure
-- It is fully read-only and safe to run.

-- 1. Current handle_new_user function body
SELECT prosrc AS trigger_function_body
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 2. Does profiles have tenant_id? Is it NOT NULL?
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('id', 'tenant_id', 'role')
ORDER BY column_name;

-- 3. Does the tenants table exist with the seed row?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'tenants'
) AS tenants_table_exists;

SELECT id, company_name, status
FROM tenants
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 4. Does the plans table exist with the seed row?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'plans'
) AS plans_table_exists;

-- 5. What values does user_role enum have?
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'user_role'
ORDER BY enumsortorder;
