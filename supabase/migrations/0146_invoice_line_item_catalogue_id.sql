-- Links invoice/quote line items back to the product or service catalogue entry
-- they came from, matching job_parts.catalogue_item_id / job_services.catalogue_item_id.
-- Without this the "update catalogue price" action is unavailable on quotes and invoices.

ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS catalogue_item_id uuid;
