-- Review requests should be scheduled after an invoice is sent, not when the
-- first visit is marked complete.

ALTER TABLE review_request_settings
  DROP CONSTRAINT IF EXISTS review_request_settings_trigger_on_check;

ALTER TABLE review_request_settings
  ADD CONSTRAINT review_request_settings_trigger_on_check
  CHECK (trigger_on IN ('job_completed', 'invoice_sent', 'invoice_paid', 'manual'));

ALTER TABLE review_requests
  DROP CONSTRAINT IF EXISTS review_requests_trigger_type_check;

ALTER TABLE review_requests
  ADD CONSTRAINT review_requests_trigger_type_check
  CHECK (trigger_type IN ('job_completed', 'invoice_sent', 'invoice_paid', 'manual'));

UPDATE review_request_settings
SET trigger_on = 'invoice_sent', updated_at = NOW()
WHERE trigger_on = 'job_completed';