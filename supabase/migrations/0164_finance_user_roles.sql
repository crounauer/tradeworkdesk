-- Migration 0164: finance user roles
-- Adds tenant roles for finance-focused users without changing workspace membership.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'bookkeeper';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accountant';

UPDATE tenants
SET company_type = 'company'
WHERE company_type = 'sole_trader';

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses
	FOR SELECT TO authenticated
	USING (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses
	FOR INSERT TO authenticated
	WITH CHECK (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses
	FOR UPDATE TO authenticated
	USING (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses
	FOR DELETE TO authenticated
	USING (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);

DROP POLICY IF EXISTS "expense_category_rules_select" ON expense_category_rules;
CREATE POLICY "expense_category_rules_select" ON expense_category_rules
	FOR SELECT TO authenticated
	USING (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);

DROP POLICY IF EXISTS "expense_category_rules_insert" ON expense_category_rules;
CREATE POLICY "expense_category_rules_insert" ON expense_category_rules
	FOR INSERT TO authenticated
	WITH CHECK (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);

DROP POLICY IF EXISTS "expense_category_rules_update" ON expense_category_rules;
CREATE POLICY "expense_category_rules_update" ON expense_category_rules
	FOR UPDATE TO authenticated
	USING (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);

DROP POLICY IF EXISTS "expense_category_rules_delete" ON expense_category_rules;
CREATE POLICY "expense_category_rules_delete" ON expense_category_rules
	FOR DELETE TO authenticated
	USING (
		get_user_role(auth.uid()) = 'super_admin'
		OR (
			tenant_id = get_user_tenant_id(auth.uid())
			AND get_user_role(auth.uid())::text IN ('admin', 'office_staff', 'bookkeeper', 'accountant')
		)
	);
