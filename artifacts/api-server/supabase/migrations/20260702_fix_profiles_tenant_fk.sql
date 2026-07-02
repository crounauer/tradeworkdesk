-- Fix profiles.tenant_id FK behavior for tenant deletes.
--
-- profiles.tenant_id is NOT NULL in production. Older schemas had an FK with
-- ON DELETE SET NULL, which causes tenant deletion to fail.
-- This migration recreates the FK with ON DELETE CASCADE.

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
