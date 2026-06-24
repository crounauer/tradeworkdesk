-- Migration 0106: Backfill tenant audit history from existing data
-- Purpose:
--   Populate tenant_audit_log with baseline historical events so Reporting > Audit Trail
--   is useful immediately for tenants with pre-existing records.

-- Backfill customer_created events (one per customer)
INSERT INTO tenant_audit_log (
  tenant_id,
  actor_id,
  actor_email,
  actor_role,
  event_type,
  entity_type,
  entity_id,
  detail,
  created_at
)
SELECT
  c.tenant_id,
  NULL,
  NULL,
  NULL,
  'customer_created',
  'customer',
  c.id::text,
  jsonb_build_object(
    'source', 'backfill',
    'first_name', c.first_name,
    'last_name', c.last_name,
    'is_active', c.is_active
  ),
  c.created_at
FROM customers c
WHERE c.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_audit_log l
    WHERE l.tenant_id = c.tenant_id
      AND l.event_type = 'customer_created'
      AND l.entity_type = 'customer'
      AND l.entity_id = c.id::text
  );

-- Backfill enquiry_created events (one per enquiry)
INSERT INTO tenant_audit_log (
  tenant_id,
  actor_id,
  actor_email,
  actor_role,
  event_type,
  entity_type,
  entity_id,
  detail,
  created_at
)
SELECT
  e.tenant_id,
  e.created_by,
  NULL,
  NULL,
  'enquiry_created',
  'enquiry',
  e.id::text,
  jsonb_build_object(
    'source', 'backfill',
    'linked_customer_id', e.linked_customer_id,
    'status', e.status,
    'priority', e.priority
  ),
  e.created_at
FROM enquiries e
WHERE e.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_audit_log l
    WHERE l.tenant_id = e.tenant_id
      AND l.event_type = 'enquiry_created'
      AND l.entity_type = 'enquiry'
      AND l.entity_id = e.id::text
  );
