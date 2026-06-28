alter table public.website_template_blocks
  add column if not exists sort_order integer;

update public.website_template_blocks
set sort_order = coalesce(sort_order, block_order, 0)
where sort_order is null;

alter table public.website_template_blocks
  alter column sort_order set default 0;

alter table public.website_template_blocks
  drop constraint if exists unique_page_block_order;

alter table public.website_template_blocks
  add constraint unique_page_block_order
  unique (page_id, sort_order);

comment on column public.website_template_blocks.sort_order is
  'Display order for blocks within a template page. Kept for compatibility with existing template schema.';

comment on column public.website_template_blocks.block_order is
  'Importer block order. Mirrors sort_order for imported template packages.';
