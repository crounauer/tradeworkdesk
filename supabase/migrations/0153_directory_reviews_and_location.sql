-- Migration 0153: Public directory location search + customer reviews

-- Persisted geocode for the business's listing postcode, used for distance
-- sorting/filtering on the public /find directory (avoids re-geocoding on
-- every search request).
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS listing_latitude DOUBLE PRECISION;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS listing_longitude DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS directory_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reviewer_name  TEXT NOT NULL,
  reviewer_email TEXT,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  is_approved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directory_reviews_tenant ON directory_reviews(tenant_id, is_approved, created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON directory_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE directory_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "directory_reviews_tenant" ON directory_reviews;
CREATE POLICY "directory_reviews_tenant" ON directory_reviews
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tenant_id = directory_reviews.tenant_id)
  );
