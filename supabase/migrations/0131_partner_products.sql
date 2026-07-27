CREATE TABLE IF NOT EXISTS partner_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  partner_name TEXT,
  description_short TEXT NOT NULL,
  description_long TEXT,
  cta_label TEXT NOT NULL DEFAULT 'Learn more',
  partner_url TEXT NOT NULL,
  logo_url TEXT,
  disclosure_text TEXT NOT NULL DEFAULT 'We may earn a commission if you buy through this link.',
  commission_model TEXT NOT NULL DEFAULT 'affiliate',
  audience_tags TEXT[] NOT NULL DEFAULT '{}',
  placement_keys TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_products_dates_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS partner_product_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_product_id UUID NOT NULL REFERENCES partner_products(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  placement_key TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_partner_products_active_priority
  ON partner_products(is_active, priority);

CREATE INDEX IF NOT EXISTS idx_partner_products_category
  ON partner_products(category);

CREATE INDEX IF NOT EXISTS idx_partner_products_placement_keys
  ON partner_products USING GIN (placement_keys);

CREATE INDEX IF NOT EXISTS idx_partner_products_audience_tags
  ON partner_products USING GIN (audience_tags);

CREATE INDEX IF NOT EXISTS idx_partner_product_clicks_product_clicked_at
  ON partner_product_clicks(partner_product_id, clicked_at DESC);

ALTER TABLE partner_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_product_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_products_service_role_all ON partner_products;
CREATE POLICY partner_products_service_role_all
  ON partner_products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS partner_product_clicks_service_role_all ON partner_product_clicks;
CREATE POLICY partner_product_clicks_service_role_all
  ON partner_product_clicks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_partner_products_updated_at
  BEFORE UPDATE ON partner_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();