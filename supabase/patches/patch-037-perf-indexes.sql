-- Patch 037: Additional performance indexes

-- Invoices: composite index for the list endpoint (tenant + type + status + issue_date)
-- Covers the common filtered list queries (e.g. all invoices for a tenant, filtered by type or status)
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_type_status
  ON invoices (tenant_id, type, status, issue_date DESC);

-- Invoices: customer lookup (already has individual indexes but composite is faster)
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer
  ON invoices (tenant_id, customer_id);

-- job_email_logs: GIN index on forms_included JSONB to speed up the @> (contains) query
-- used by the invoice email log endpoint
CREATE INDEX IF NOT EXISTS idx_job_email_logs_forms_included
  ON job_email_logs USING GIN (forms_included jsonb_path_ops);

-- service_catalogue: partial index for active items (patch-027 has a plain tenant_id index;
-- this is a DIFFERENT name so the filtered version is actually created)
CREATE INDEX IF NOT EXISTS idx_service_catalogue_tenant_active
  ON service_catalogue (tenant_id)
  WHERE is_active = true;

-- jobs: partial composite covering the jobs-list multi-column sort
-- (scheduled_date + scheduled_time) for active jobs per tenant
-- Tighter than idx_jobs_tenant_active_date (no is_active column needed in partial index)
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_date_time
  ON jobs (tenant_id, scheduled_date, scheduled_time)
  WHERE is_active = true;
