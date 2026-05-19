-- patch-053: Link jobs back to their source quote
-- When a job is created from an accepted quote, from_quote_id records the origin.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS from_quote_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_from_quote ON jobs(from_quote_id);

-- Data fix: reset QUO-0001 so it no longer shows as converted
UPDATE invoices
SET status = 'accepted',
    converted_to_invoice_id = NULL,
    updated_at = NOW()
WHERE invoice_number = 'QUO-0001'
  AND type = 'quote';

