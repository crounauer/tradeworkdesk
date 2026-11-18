CREATE TABLE IF NOT EXISTS public.customer_merge_locks (
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  merge_id uuid NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, customer_id)
);

ALTER TABLE public.customer_merge_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_merge_locks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.customer_merge_locks TO service_role;
