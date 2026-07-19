-- Patch 045: Shopping Lists
-- Tenant-scoped shared shopping lists generated from invoice product lines and job parts.

CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'partially_purchased', 'complete', 'archived')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_estimate NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'needed' CHECK (status IN ('needed', 'ordered', 'purchased', 'unavailable')),
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('invoice_line_item', 'job_part', 'manual')),
  source_id UUID,
  source_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_tenant ON shopping_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_status ON shopping_lists(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_tenant ON shopping_list_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_status ON shopping_list_items(tenant_id, status);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopping_lists_tenant_select ON shopping_lists;
CREATE POLICY shopping_lists_tenant_select ON shopping_lists
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())::text
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS shopping_lists_tenant_insert ON shopping_lists;
CREATE POLICY shopping_lists_tenant_insert ON shopping_lists
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS shopping_lists_tenant_update ON shopping_lists;
CREATE POLICY shopping_lists_tenant_update ON shopping_lists
  FOR UPDATE TO authenticated
  USING (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS shopping_lists_tenant_delete ON shopping_lists;
CREATE POLICY shopping_lists_tenant_delete ON shopping_lists
  FOR DELETE TO authenticated
  USING (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS shopping_list_items_tenant_select ON shopping_list_items;
CREATE POLICY shopping_list_items_tenant_select ON shopping_list_items
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())::text
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS shopping_list_items_tenant_insert ON shopping_list_items;
CREATE POLICY shopping_list_items_tenant_insert ON shopping_list_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS shopping_list_items_tenant_update ON shopping_list_items;
CREATE POLICY shopping_list_items_tenant_update ON shopping_list_items
  FOR UPDATE TO authenticated
  USING (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS shopping_list_items_tenant_delete ON shopping_list_items;
CREATE POLICY shopping_list_items_tenant_delete ON shopping_list_items
  FOR DELETE TO authenticated
  USING (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

CREATE OR REPLACE FUNCTION set_shopping_lists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_lists_updated_at ON shopping_lists;
CREATE TRIGGER trg_shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION set_shopping_lists_updated_at();

CREATE OR REPLACE FUNCTION set_shopping_list_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_list_items_updated_at ON shopping_list_items;
CREATE TRIGGER trg_shopping_list_items_updated_at
  BEFORE UPDATE ON shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION set_shopping_list_items_updated_at();

-- Optional addon registration (safe no-op if addons table missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'addons') THEN
    INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order)
    SELECT
      'Shopping Lists',
      'Generate and manage shopping lists from invoice products and job parts.',
      ARRAY['shopping_lists'],
      4.99,
      49.99,
      false,
      16
    WHERE NOT EXISTS (SELECT 1 FROM addons WHERE name = 'Shopping Lists');
  END IF;
END $$;
