-- Migration 0107: Enrich backfilled tenant audit entries
-- Purpose:
--   Improve readability of historical backfill events by attaching actor metadata
--   and richer enquiry details.

-- Fill missing actor_email / actor_role from profiles when actor_id exists.
UPDATE tenant_audit_log l
SET
  actor_email = COALESCE(l.actor_email, p.email),
  actor_role = COALESCE(l.actor_role, p.role::text)
FROM profiles p
WHERE l.actor_id = p.id
  AND (l.actor_email IS NULL OR l.actor_role IS NULL);

-- Enrich backfilled enquiry_created entries with key context fields.
UPDATE tenant_audit_log l
SET detail = COALESCE(l.detail, '{}'::jsonb)
  || jsonb_build_object(
    'contact_name', e.contact_name,
    'contact_phone', e.contact_phone,
    'contact_email', e.contact_email,
    'address_line1', e.address_line1,
    'city', e.city,
    'postcode', e.postcode
  )
FROM enquiries e
WHERE l.event_type = 'enquiry_created'
  AND l.entity_type = 'enquiry'
  AND l.entity_id = e.id::text
  AND COALESCE(l.detail->>'source', '') = 'backfill';
