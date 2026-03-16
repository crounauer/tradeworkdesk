-- patch-006: Add payment_overdue status to tenant_status enum
-- Safe to run on any environment; guards against already-added value.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'payment_overdue'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tenant_status')
  ) THEN
    ALTER TYPE tenant_status ADD VALUE 'payment_overdue' AFTER 'suspended';
  END IF;
END
$$;

COMMIT;
