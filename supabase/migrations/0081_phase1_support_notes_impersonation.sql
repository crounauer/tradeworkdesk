-- Migration 0081: Phase 1 - Platform admin support notes and impersonation log
-- Adds:
--   - tenant_support_notes: internal notes per business for platform admin use
--   - Extends platform_audit_log with impersonation event tracking

-- ─── 1. Tenant support notes ──────────────────────────────────────────────────
-- Internal notes written by super admins when supporting a tenant.
-- Never visible to the tenant.

CREATE TABLE IF NOT EXISTS tenant_support_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_email TEXT,
  body         TEXT NOT NULL,
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_notes_tenant
  ON tenant_support_notes(tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON tenant_support_notes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tenant_support_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tenant_support_notes ENABLE ROW LEVEL SECURITY;

-- Only super_admins can access support notes
DROP POLICY IF EXISTS "support_notes_super_admin" ON tenant_support_notes;
CREATE POLICY "support_notes_super_admin" ON tenant_support_notes
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

-- ─── 2. Impersonation sessions table ─────────────────────────────────────────
-- Tracks when a super admin impersonates a tenant account.
-- Used for audit trail and to revoke active impersonation sessions.

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email   TEXT NOT NULL,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason        TEXT,
  token_hash    TEXT NOT NULL UNIQUE, -- SHA-256 of the short-lived token
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  used_at       TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_actor
  ON impersonation_sessions(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_tenant
  ON impersonation_sessions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_token
  ON impersonation_sessions(token_hash);

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impersonation_super_admin" ON impersonation_sessions;
CREATE POLICY "impersonation_super_admin" ON impersonation_sessions
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');
