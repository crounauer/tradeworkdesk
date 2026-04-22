-- Composite indexes for the common jobs list query pattern:
-- WHERE tenant_id = ? AND is_active = true ORDER BY scheduled_date
-- The existing single-column idx_jobs_tenant and idx_jobs_scheduled cannot be
-- combined efficiently. A composite index lets Postgres satisfy both the filter
-- and the sort in one index scan.

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_active_date
  ON jobs(tenant_id, is_active, scheduled_date);

-- With a status filter (most common: status != 'cancelled')
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_active_status_date
  ON jobs(tenant_id, is_active, status, scheduled_date);

-- Technician view: filtered by assigned_technician_id as well
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_tech_active_date
  ON jobs(tenant_id, assigned_technician_id, is_active, scheduled_date);

-- Appliances overdue-service query (homepage): next_service_due lookup
CREATE INDEX IF NOT EXISTS idx_appliances_tenant_active_due
  ON appliances(tenant_id, is_active, next_service_due);
