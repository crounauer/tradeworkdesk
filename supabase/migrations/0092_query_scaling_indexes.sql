-- Migration 0092: Query scaling indexes
-- Purpose: improve high-frequency dashboard and analytics query paths as tenant/user volume grows.

-- Website analytics: supports
--   WHERE website_id = ? ORDER BY created_at DESC LIMIT ...
CREATE INDEX IF NOT EXISTS idx_form_submissions_website_created
  ON website_form_submissions (website_id, created_at DESC);

-- Website analytics: supports
--   WHERE website_id = ? AND status = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_form_submissions_website_status_created
  ON website_form_submissions (website_id, status, created_at DESC);

-- Website analytics/forms management: supports
--   WHERE website_id = ? [AND is_active = true]
CREATE INDEX IF NOT EXISTS idx_website_forms_website_active
  ON website_forms (website_id, is_active);

-- Website analytics lead-source feed: supports
--   WHERE tenant_id = ? AND source IN (...) ORDER BY created_at DESC LIMIT ...
CREATE INDEX IF NOT EXISTS idx_enquiries_tenant_source_created
  ON enquiries (tenant_id, source, created_at DESC);

-- Platform audit log filtered feed: supports
--   WHERE event_type = ? ORDER BY created_at DESC LIMIT/OFFSET ...
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_event_created
  ON platform_audit_log (event_type, created_at DESC);

-- Dashboard recent completed jobs card: supports
--   WHERE tenant_id = ? AND is_active = true AND status = 'completed'
--   ORDER BY updated_at DESC LIMIT ...
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_completed_updated
  ON jobs (tenant_id, updated_at DESC)
  WHERE is_active = true AND status = 'completed';

-- Dashboard active-span jobs (scheduled_end_date overlap logic): supports
--   WHERE tenant_id = ? AND is_active = true AND scheduled_end_date >= ?
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_scheduled_end_active
  ON jobs (tenant_id, scheduled_end_date)
  WHERE is_active = true AND scheduled_end_date IS NOT NULL;
