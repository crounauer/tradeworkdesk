-- patch-073: Separate superadmin (platform marketing) social data from tenant social data

-- Platform social accounts (superadmin-only workspace)
CREATE TABLE IF NOT EXISTS platform_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform social_platform NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  page_id TEXT,
  page_name TEXT,
  instagram_business_id TEXT,
  profile_name TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  connection_method TEXT,
  token_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_social_accounts_platform_page_unique
  ON platform_social_accounts (platform, page_id)
  WHERE page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS platform_social_accounts_platform_idx
  ON platform_social_accounts (platform);

DROP TRIGGER IF EXISTS set_updated_at ON platform_social_accounts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON platform_social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Platform social posts (superadmin-only workspace)
CREATE TABLE IF NOT EXISTS platform_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  account_id UUID REFERENCES platform_social_accounts(id) ON DELETE SET NULL,
  platform social_platform NOT NULL,
  content TEXT NOT NULL,
  link_url TEXT,
  image_url TEXT,
  video_url TEXT,
  post_type TEXT DEFAULT 'business',
  website_page_id TEXT,
  website_page_url TEXT,
  final_link_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  scheduled_for TIMESTAMPTZ,
  status social_post_status NOT NULL DEFAULT 'draft',
  post_id TEXT,
  post_url TEXT,
  error TEXT,
  entity_type social_entity_type,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_social_posts_status_idx
  ON platform_social_posts (status);

CREATE INDEX IF NOT EXISTS platform_social_posts_scheduled_idx
  ON platform_social_posts (scheduled_for)
  WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS set_updated_at ON platform_social_posts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON platform_social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Platform OAuth state for Facebook (superadmin-only workspace)
CREATE TABLE IF NOT EXISTS platform_facebook_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state_hash TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/admin/social?tab=accounts',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_facebook_oauth_states_state_hash_unique
  ON platform_facebook_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS platform_facebook_oauth_states_expires_idx
  ON platform_facebook_oauth_states (expires_at);

-- RLS: superadmin only
ALTER TABLE platform_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_facebook_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_social_accounts_super_admin ON platform_social_accounts;
CREATE POLICY platform_social_accounts_super_admin ON platform_social_accounts
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS platform_social_posts_super_admin ON platform_social_posts;
CREATE POLICY platform_social_posts_super_admin ON platform_social_posts
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS platform_facebook_oauth_states_super_admin ON platform_facebook_oauth_states;
CREATE POLICY platform_facebook_oauth_states_super_admin ON platform_facebook_oauth_states
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
