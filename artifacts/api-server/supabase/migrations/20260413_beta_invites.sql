CREATE TABLE IF NOT EXISTS beta_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(32) NOT NULL UNIQUE,
  email text,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_invites_code ON beta_invites(code);
CREATE INDEX IF NOT EXISTS idx_beta_invites_active ON beta_invites(is_active) WHERE is_active = true;
