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

-- service_catalogue: index for the per-tenant lookup
CREATE INDEX IF NOT EXISTS idx_service_catalogue_tenant
  ON service_catalogue (tenant_id)
  WHERE is_active = true;
