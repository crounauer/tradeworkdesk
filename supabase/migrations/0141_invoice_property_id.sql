-- Allow standalone invoices and quotes to retain the selected customer property.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_property_id_idx ON invoices(property_id);