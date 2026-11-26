ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS tenant_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.properties
SET tenant_contacts = jsonb_build_array(
  jsonb_strip_nulls(jsonb_build_object(
    'name', NULLIF(BTRIM(tenant_name), ''),
    'email', NULLIF(BTRIM(tenant_email), ''),
    'phone', NULLIF(BTRIM(tenant_phone), '')
  ))
)
WHERE tenant_contacts = '[]'::jsonb
  AND (
    NULLIF(BTRIM(tenant_name), '') IS NOT NULL
    OR NULLIF(BTRIM(tenant_email), '') IS NOT NULL
    OR NULLIF(BTRIM(tenant_phone), '') IS NOT NULL
  );
