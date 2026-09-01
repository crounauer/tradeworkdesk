-- Migration 0147: Fix customer_portal_users.customer_id foreign key delete action
--
-- Problem:
-- customer_portal_users.customer_id references customers(id) with the default
-- ON DELETE action (NO ACTION/RESTRICT). Deleting a tenant cascades into
-- customers (customers.tenant_id is ON DELETE CASCADE), but if any of those
-- customers have a customer_portal_users row, Postgres blocks the delete with:
--   update or delete on table "customers" violates foreign key constraint
--   "customer_portal_users_customer_id_fkey" on table "customer_portal_users"
--
-- Fix:
-- Recreate the FK on customer_portal_users.customer_id to ON DELETE CASCADE so
-- tenant/customer deletion removes the portal user rows instead of being blocked.

DO $$
DECLARE
  customer_id_attnum smallint;
  fk record;
BEGIN
  IF to_regclass('public.customer_portal_users') IS NULL THEN
    RETURN;
  END IF;

  SELECT attnum INTO customer_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.customer_portal_users'::regclass
    AND attname = 'customer_id'
    AND NOT attisdropped;

  IF customer_id_attnum IS NULL THEN
    RETURN;
  END IF;

  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.customer_portal_users'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[customer_id_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.customer_portal_users DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

ALTER TABLE public.customer_portal_users
  ADD CONSTRAINT customer_portal_users_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;
