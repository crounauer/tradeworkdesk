-- Migration 0120: Customer appointment confirmation links

CREATE TABLE IF NOT EXISTS public.job_confirmation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sent_to_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'change_requested')),
  responded_at TIMESTAMPTZ,
  responded_via TEXT,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_confirmation_responses_job_id
  ON public.job_confirmation_responses(job_id, status);

CREATE INDEX IF NOT EXISTS idx_job_confirmation_responses_tenant_id
  ON public.job_confirmation_responses(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_confirmation_responses_customer_id
  ON public.job_confirmation_responses(customer_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.job_confirmation_responses;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.job_confirmation_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.job_confirmation_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_confirmation_responses_tenant" ON public.job_confirmation_responses;
CREATE POLICY "job_confirmation_responses_tenant" ON public.job_confirmation_responses
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = job_confirmation_responses.tenant_id
    )
  );

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS customer_confirmation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (customer_confirmation_status IN ('pending', 'confirmed', 'change_requested'));

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS customer_change_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_customer_confirmation_status
  ON public.jobs(tenant_id, customer_confirmation_status, scheduled_date);
