-- Allow invoices to be created without a job (e.g. standalone quotes/invoices from dashboard)
ALTER TABLE invoices ALTER COLUMN job_id DROP NOT NULL;
