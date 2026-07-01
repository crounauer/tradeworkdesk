-- Final phase 4 cleanup: drop the retired job_types table after the service catalogue migration
-- and runtime cutover are complete.
--
-- Preconditions:
-- - jobs.service_catalogue_id has been backfilled
-- - no code paths still query or seed public.job_types
-- - tenant admin flows use service_catalogue directly

BEGIN;

DROP TABLE IF EXISTS public.job_types;

COMMIT;
