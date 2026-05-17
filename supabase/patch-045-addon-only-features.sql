-- patch-045: Remove addon-only feature keys from plan features JSON
-- uk_address_lookup and sms_messaging are controlled exclusively via
-- tenant_addons. If they exist in a plan's features JSON they will
-- always appear enabled regardless of addon state.

UPDATE plans
SET features = features - 'uk_address_lookup' - 'sms_messaging'
WHERE features ? 'uk_address_lookup' OR features ? 'sms_messaging';
