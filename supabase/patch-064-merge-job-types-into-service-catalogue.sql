-- Merge job_types into service_catalogue using name + duration.
-- Idempotent: safe to run multiple times.
--
-- Behavior:
-- 1) Picks one canonical job_type per tenant+name (case-insensitive).
-- 2) Updates matching service_catalogue rows' booking_duration_minutes.
-- 3) Inserts missing services with name + booking_duration_minutes.
--
-- Notes:
-- - job_types.tenant_id may be TEXT in older schemas, so this script only uses
--   rows where tenant_id looks like a UUID and casts it.
-- - Existing service prices are not changed.

begin;

with canonical_job_types as (
  select
    jt.id as job_type_id,
    jt.tenant_id::uuid as tenant_id,
    btrim(jt.name) as name,
    coalesce(nullif(jt.default_duration_minutes, 0), 60) as booking_duration_minutes,
    row_number() over (
      partition by jt.tenant_id::uuid, lower(btrim(jt.name))
      order by
        coalesce(jt.is_active, true) desc,
        coalesce(jt.is_default, false) desc,
        coalesce(jt.sort_order, 2147483647) asc,
        jt.created_at asc,
        jt.id asc
    ) as rn
  from public.job_types jt
  inner join public.tenants t
    on t.id = jt.tenant_id::uuid
  where
    btrim(coalesce(jt.name, '')) <> ''
    and jt.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
),
source_rows as (
  select
    tenant_id,
    name,
    booking_duration_minutes
  from canonical_job_types
  where rn = 1
),
updated as (
  update public.service_catalogue sc
  set
    booking_duration_minutes = src.booking_duration_minutes,
    updated_at = now()
  from source_rows src
  where
    sc.tenant_id = src.tenant_id
    and lower(sc.name) = lower(src.name)
  returning sc.id
),
inserted as (
  insert into public.service_catalogue (
    tenant_id,
    name,
    booking_duration_minutes,
    is_active
  )
  select
    src.tenant_id,
    src.name,
    src.booking_duration_minutes,
    true
  from source_rows src
  where not exists (
    select 1
    from public.service_catalogue sc
    where
      sc.tenant_id = src.tenant_id
      and lower(sc.name) = lower(src.name)
  )
  returning id
)
select
  (select count(*) from source_rows) as source_job_types,
  (select count(*) from updated) as updated_services,
  (select count(*) from inserted) as inserted_services;

commit;
