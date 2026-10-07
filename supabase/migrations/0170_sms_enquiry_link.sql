-- Link enquiry texts without copying them when the enquiry becomes a job.
ALTER TABLE sms_messages
  ADD COLUMN IF NOT EXISTS enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant_enquiry_created
  ON sms_messages (tenant_id, enquiry_id, created_at DESC)
  WHERE enquiry_id IS NOT NULL;
