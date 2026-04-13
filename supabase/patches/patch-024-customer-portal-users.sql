CREATE TABLE IF NOT EXISTS customer_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  tenant_id text NOT NULL,
  invite_token text NOT NULL UNIQUE,
  invite_email text,
  invite_expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_portal_users_auth_user_id ON customer_portal_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_users_customer_id ON customer_portal_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_users_tenant_id ON customer_portal_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_users_invite_token ON customer_portal_users(invite_token);
