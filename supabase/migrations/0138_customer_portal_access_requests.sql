-- Migration 0138: customer portal access requests

CREATE TABLE IF NOT EXISTS customer_portal_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  requested_email TEXT NOT NULL,
  requested_postcode TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source TEXT NOT NULL DEFAULT 'portal_login',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_portal_access_requests_tenant_status
  ON customer_portal_access_requests (tenant_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_portal_access_requests_customer_status
  ON customer_portal_access_requests (customer_id, status, requested_at DESC);

ALTER TABLE customer_portal_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_portal_access_requests_select ON customer_portal_access_requests;
CREATE POLICY customer_portal_access_requests_select ON customer_portal_access_requests
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS customer_portal_access_requests_insert ON customer_portal_access_requests;
CREATE POLICY customer_portal_access_requests_insert ON customer_portal_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS customer_portal_access_requests_update ON customer_portal_access_requests;
CREATE POLICY customer_portal_access_requests_update ON customer_portal_access_requests
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );