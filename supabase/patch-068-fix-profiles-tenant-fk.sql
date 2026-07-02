-- Patch 068: Fix profiles.tenant_id foreign key delete action
--
-- Problem:
-- profiles.tenant_id is NOT NULL in production, but older patches created the FK as
-- ON DELETE SET NULL. Deleting a tenant then fails with:
--   null value in column "tenant_id" of relation "profiles" violates not-null constraint
--
-- Fix:
-- Recreate the FK on profiles.tenant_id to ON DELETE CASCADE so tenant deletion
-- removes tenant-scoped profile rows instead of trying to null them.

DO $$
DECLARE
  tenant_id_attnum smallint;
  fk record;
BEGIN
  SELECT attnum INTO tenant_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass
    AND attname = 'tenant_id'
    AND NOT attisdropped;

  IF tenant_id_attnum IS NULL THEN
    RAISE EXCEPTION 'Column public.profiles.tenant_id does not exist';
  END IF;

  -- Drop any existing FK attached to profiles.tenant_id (name may vary by environment).
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[tenant_id_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id)
  ON DELETE CASCADE;
