-- Migration 0169: enquiry_email_replies
-- Stores inbound customer email replies captured via the Resend inbound webhook.
-- Only populated when INBOUND_REPLY_DOMAIN is configured (reply-to threading);
-- the table existing is harmless when the feature is off.

CREATE TABLE IF NOT EXISTS enquiry_email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enquiry_id UUID REFERENCES enquiries(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  provider_message_id TEXT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_email_replies_enquiry
  ON enquiry_email_replies (enquiry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enquiry_email_replies_tenant
  ON enquiry_email_replies (tenant_id, created_at DESC);

ALTER TABLE enquiry_email_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enquiry_email_replies_select" ON enquiry_email_replies;
CREATE POLICY "enquiry_email_replies_select" ON enquiry_email_replies
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );
