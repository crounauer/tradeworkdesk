-- Patch 035: Add works_order field to invoices for describing the work carried out
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS works_order TEXT;
