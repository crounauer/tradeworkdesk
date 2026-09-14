-- Migration 0161: saved expense category rules (auto-apply keyword -> category on future imports)
CREATE TABLE IF NOT EXISTS expense_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_category_rules_tenant_keyword
  ON expense_category_rules (tenant_id, keyword);

ALTER TABLE expense_category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_category_rules_select" ON expense_category_rules;
CREATE POLICY "expense_category_rules_select" ON expense_category_rules
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS "expense_category_rules_insert" ON expense_category_rules;
CREATE POLICY "expense_category_rules_insert" ON expense_category_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS "expense_category_rules_update" ON expense_category_rules;
CREATE POLICY "expense_category_rules_update" ON expense_category_rules
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );

DROP POLICY IF EXISTS "expense_category_rules_delete" ON expense_category_rules;
CREATE POLICY "expense_category_rules_delete" ON expense_category_rules
  FOR DELETE TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff')
    )
  );
