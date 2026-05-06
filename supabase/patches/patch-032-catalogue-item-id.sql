-- Patch 032: Link job_parts and job_services back to their catalogue source
-- Enables updating the catalogue default_price when editing a job part/service price

ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS catalogue_item_id UUID REFERENCES product_catalogue(id) ON DELETE SET NULL;
ALTER TABLE job_services ADD COLUMN IF NOT EXISTS catalogue_item_id UUID REFERENCES service_catalogue(id) ON DELETE SET NULL;
