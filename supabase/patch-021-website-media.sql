-- Website media library: tenant-scoped image uploads for the website builder
create table if not exists website_media (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  website_id    uuid not null references websites(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  public_url    text not null,
  width         integer,
  height        integer,
  file_size     integer,
  mime_type     text not null default 'image/jpeg',
  alt_text      text,
  created_at    timestamptz not null default now()
);

create index if not exists website_media_tenant_idx on website_media(tenant_id);
create index if not exists website_media_website_idx on website_media(website_id);

alter table website_media enable row level security;

create policy "Tenant can manage own media"
  on website_media for all
  using (tenant_id = (select auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
