-- Performance indexes for homepage/dashboard/calendar queries
-- Run on Supabase SQL editor

-- Jobs: Most common filters are tenant_id + is_active + scheduled_date + status
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_active_date ON jobs (tenant_id, is_active, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON jobs (tenant_id, status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_technician_date ON jobs (tenant_id, assigned_technician_id, scheduled_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_end_date ON jobs (scheduled_end_date) WHERE scheduled_end_date IS NOT NULL AND is_active = true;

-- Customers: count queries filter on tenant_id + is_active
CREATE INDEX IF NOT EXISTS idx_customers_tenant_active ON customers (tenant_id) WHERE is_active = true;

-- Appliances: overdue service queries
CREATE INDEX IF NOT EXISTS idx_appliances_tenant_service_due ON appliances (tenant_id, next_service_due) WHERE is_active = true AND next_service_due IS NOT NULL;

-- Profiles: list queries filter on tenant_id + is_active
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_active ON profiles (tenant_id) WHERE is_active = true;

-- Enquiries: count queries on status
CREATE INDEX IF NOT EXISTS idx_enquiries_tenant_status ON enquiries (tenant_id, status);
