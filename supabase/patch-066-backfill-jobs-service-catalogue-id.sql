-- Phase 4: backfill jobs.service_catalogue_id from the existing job_type linkage
-- Idempotent: safe to run multiple times.

BEGIN;

WITH mapped_services AS (
  SELECT DISTINCT ON (j.id)
    j.id AS job_id,
    sc.id AS service_catalogue_id
  FROM public.jobs j
  JOIN public.job_types jt
    ON jt.id = j.job_type_id
   AND jt.tenant_id::text = j.tenant_id::text
  JOIN public.service_catalogue sc
    ON sc.tenant_id = j.tenant_id
   AND sc.is_active = true
   AND sc.linked_job_type_id = jt.id
  WHERE j.service_catalogue_id IS NULL
    AND j.job_type_id IS NOT NULL
  ORDER BY j.id, sc.updated_at DESC NULLS LAST, sc.created_at DESC NULLS LAST, sc.id ASC
)
UPDATE public.jobs j
SET service_catalogue_id = ms.service_catalogue_id
FROM mapped_services ms
WHERE j.id = ms.job_id;

COMMIT;
