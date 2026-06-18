-- patch-058-support-tickets.sql
-- Tenant support tickets with threaded messages and image attachments.

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requester_name TEXT,
  requester_email TEXT,
  requester_phone TEXT,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'support_issue',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_tickets_category_check CHECK (category IN ('support_issue', 'bug_report', 'feature_request', 'billing', 'other')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_created_at ON support_tickets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated_at ON support_tickets (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT,
  author_email TEXT,
  author_role TEXT NOT NULL,
  body TEXT NOT NULL,
  status_after TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_ticket_messages_author_role_check CHECK (author_role IN ('tenant', 'super_admin')),
  CONSTRAINT support_ticket_messages_status_after_check CHECK (status_after IS NULL OR status_after IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created_at ON support_ticket_messages (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket_id ON support_ticket_attachments (ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_message_id ON support_ticket_attachments (message_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-ticket-attachments', 'support-ticket-attachments', true)
ON CONFLICT DO NOTHING;