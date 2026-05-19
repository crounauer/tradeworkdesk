-- patch-053: Link jobs back to their source quote
-- When a job is created from an accepted quote, from_quote_id records the origin.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS from_quote_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_from_quote ON jobs(from_quote_id);
