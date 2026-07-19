-- Patch 046: Community MVP (tenant-scoped categories, threads, comments, reports)

CREATE TABLE IF NOT EXISTS community_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES community_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  thread_id UUID NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL DEFAULT 'inappropriate',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_categories_tenant ON community_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_threads_tenant ON community_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_threads_category ON community_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_community_threads_activity ON community_threads(tenant_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_thread ON community_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_tenant ON community_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_reports_tenant_status ON community_post_reports(tenant_id, status);

ALTER TABLE community_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_categories_tenant_select ON community_categories;
CREATE POLICY community_categories_tenant_select ON community_categories
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())::text
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS community_categories_tenant_write ON community_categories;
CREATE POLICY community_categories_tenant_write ON community_categories
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS community_threads_tenant_select ON community_threads;
CREATE POLICY community_threads_tenant_select ON community_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())::text
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS community_threads_tenant_write ON community_threads;
CREATE POLICY community_threads_tenant_write ON community_threads
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS community_posts_tenant_select ON community_posts;
CREATE POLICY community_posts_tenant_select ON community_posts
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())::text
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS community_posts_tenant_insert ON community_posts;
CREATE POLICY community_posts_tenant_insert ON community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician')
      AND author_id = auth.uid()
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS community_posts_tenant_update ON community_posts;
CREATE POLICY community_posts_tenant_update ON community_posts
  FOR UPDATE TO authenticated
  USING (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND (
        author_id = auth.uid()
        OR get_user_role(auth.uid()) IN ('admin', 'office_staff')
      )
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND (
        author_id = auth.uid()
        OR get_user_role(auth.uid()) IN ('admin', 'office_staff')
      )
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS community_reports_tenant_select ON community_post_reports;
CREATE POLICY community_reports_tenant_select ON community_post_reports
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())::text
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS community_reports_tenant_insert ON community_post_reports;
CREATE POLICY community_reports_tenant_insert ON community_post_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      tenant_id = get_user_tenant_id(auth.uid())::text
      AND get_user_role(auth.uid()) IN ('admin', 'office_staff', 'technician')
      AND reported_by = auth.uid()
    )
    OR get_user_role(auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS community_reports_tenant_update ON community_post_reports;
CREATE POLICY community_reports_tenant_update ON community_post_reports
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

CREATE OR REPLACE FUNCTION set_community_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_categories_updated_at ON community_categories;
CREATE TRIGGER trg_community_categories_updated_at
  BEFORE UPDATE ON community_categories
  FOR EACH ROW EXECUTE FUNCTION set_community_updated_at();

DROP TRIGGER IF EXISTS trg_community_threads_updated_at ON community_threads;
CREATE TRIGGER trg_community_threads_updated_at
  BEFORE UPDATE ON community_threads
  FOR EACH ROW EXECUTE FUNCTION set_community_updated_at();

DROP TRIGGER IF EXISTS trg_community_posts_updated_at ON community_posts;
CREATE TRIGGER trg_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION set_community_updated_at();

DROP TRIGGER IF EXISTS trg_community_post_reports_updated_at ON community_post_reports;
CREATE TRIGGER trg_community_post_reports_updated_at
  BEFORE UPDATE ON community_post_reports
  FOR EACH ROW EXECUTE FUNCTION set_community_updated_at();

-- Optional addon registration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'addons') THEN
    INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order)
    SELECT
      'Community',
      'Tenant community threads and comments with moderation controls.',
      ARRAY['community_mvp'],
      2.99,
      29.99,
      false,
      17
    WHERE NOT EXISTS (SELECT 1 FROM addons WHERE name = 'Community');
  END IF;
END $$;
