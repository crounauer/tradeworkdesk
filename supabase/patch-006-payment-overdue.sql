-- patch-006: Add payment_overdue status to tenant_status enum
-- Safe to run on any environment; IF NOT EXISTS guards against duplicate.
-- COMMIT forces the new enum value to be visible before any subsequent
-- statements use it (ALTER TYPE ADD VALUE requires its own transaction).
ALTER TYPE tenant_status ADD VALUE IF NOT EXISTS 'payment_overdue' AFTER 'suspended';
COMMIT;
