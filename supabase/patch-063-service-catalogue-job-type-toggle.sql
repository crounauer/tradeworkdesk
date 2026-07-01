-- Add service catalogue display controls for job creation dropdown integration.
-- Safe to run multiple times.

alter table if exists public.service_catalogue
  add column if not exists show_in_job_type_dropdown boolean not null default false;

alter table if exists public.service_catalogue
  add column if not exists linked_job_type_id integer;

create index if not exists idx_service_catalogue_show_in_job_type_dropdown
  on public.service_catalogue (tenant_id, show_in_job_type_dropdown, is_active);

create index if not exists idx_service_catalogue_linked_job_type_id
  on public.service_catalogue (linked_job_type_id);
