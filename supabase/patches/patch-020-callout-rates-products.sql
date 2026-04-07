-- Patch 020: Callout rates tiers and product catalogue
-- Run this in your Supabase SQL Editor

-- 1. Create callout_rates table
CREATE TABLE IF NOT EXISTS callout_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  day_type TEXT NOT NULL DEFAULT 'weekday',
  time_from TIME DEFAULT NULL,
  time_to TIME DEFAULT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callout_rates_tenant ON callout_rates(tenant_id);

ALTER TABLE callout_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "callout_rates_select" ON callout_rates FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "callout_rates_insert" ON callout_rates FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

CREATE POLICY "callout_rates_update" ON callout_rates FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

CREATE POLICY "callout_rates_delete" ON callout_rates FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

-- 2. Create product_catalogue table
CREATE TABLE IF NOT EXISTS product_catalogue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_price NUMERIC(10,2) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalogue_tenant ON product_catalogue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_catalogue_name ON product_catalogue(tenant_id, name);

ALTER TABLE product_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_catalogue_select" ON product_catalogue FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "product_catalogue_insert" ON product_catalogue FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
  );

CREATE POLICY "product_catalogue_update" ON product_catalogue FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
  );

CREATE POLICY "product_catalogue_delete" ON product_catalogue FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
  );

-- 3. Add callout_rate_id to jobs for manual override
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS callout_rate_id UUID REFERENCES callout_rates(id) ON DELETE SET NULL;
