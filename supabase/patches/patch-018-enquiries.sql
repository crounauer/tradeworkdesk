-- Patch 018: Enquiry tracking tables
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  source TEXT NOT NULL DEFAULT 'phone' CHECK (source IN ('phone','email','text','facebook','whatsapp','messenger','website','referral','other')),
  description TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','converted','lost')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  linked_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  linked_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_tenant ON enquiries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_source ON enquiries(source);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON enquiries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS enquiry_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enquiry_id UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_notes_enquiry ON enquiry_notes(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_notes_tenant ON enquiry_notes(tenant_id);

-- RLS
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enquiries_select" ON enquiries FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "enquiries_insert" ON enquiries FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
  );

CREATE POLICY "enquiries_update" ON enquiries FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
  );

CREATE POLICY "enquiries_delete" ON enquiries FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

CREATE POLICY "enquiries_super_admin" ON enquiries FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "enquiry_notes_select" ON enquiry_notes FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "enquiry_notes_insert" ON enquiry_notes FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
  );

CREATE POLICY "enquiry_notes_delete" ON enquiry_notes FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

CREATE POLICY "enquiry_notes_super_admin" ON enquiry_notes FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
