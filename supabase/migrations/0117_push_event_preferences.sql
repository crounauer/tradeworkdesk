CREATE TABLE IF NOT EXISTS tenant_user_push_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_due_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  appointment_overdue_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  assignment_changes_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  blocking_status_changes_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  customer_communications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payment_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sla_breach_risk_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_lifecycle_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  operational_exceptions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  system_reliability_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_push_prefs_tenant_user
  ON tenant_user_push_preferences (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS push_notification_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_push_dispatch_tenant_created
  ON push_notification_dispatch_log (tenant_id, created_at DESC);
