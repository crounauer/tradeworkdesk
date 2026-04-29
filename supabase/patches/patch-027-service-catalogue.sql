-- Patch 027: Service Catalogue and Job Services
-- Adds a service catalogue (like product catalogue but for fixed-price services)
-- and a job_services table so technicians can record services performed on a job.

-- Service catalogue table (mirrors product_catalogue)
CREATE TABLE IF NOT EXISTS service_catalogue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_price NUMERIC(10,2) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_catalogue_tenant ON service_catalogue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_catalogue_name ON service_catalogue(tenant_id, name);

-- RLS for service_catalogue
ALTER TABLE service_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_catalogue_select" ON service_catalogue
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "service_catalogue_insert" ON service_catalogue
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office_staff', 'super_admin')
    )
  );

CREATE POLICY "service_catalogue_update" ON service_catalogue
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office_staff', 'super_admin')
    )
  );

CREATE POLICY "service_catalogue_delete" ON service_catalogue
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office_staff', 'super_admin')
    )
  );

-- Job services table (mirrors job_parts but without serial_number)
CREATE TABLE IF NOT EXISTS job_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) DEFAULT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_services_job ON job_services(job_id);
CREATE INDEX IF NOT EXISTS idx_job_services_tenant ON job_services(tenant_id);

-- RLS for job_services
ALTER TABLE job_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_services_select" ON job_services
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "job_services_insert" ON job_services
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "job_services_update" ON job_services
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "job_services_delete" ON job_services
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Register the Service Catalogue as a purchasable addon
INSERT INTO addons (name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order)
SELECT
  'Service Catalogue',
  'Pre-define recurring services such as boiler services and gas safety checks with fixed prices. Quickly add services to jobs for accurate invoicing and reporting.',
  ARRAY['service_catalogue'],
  4.99,
  49.99,
  false,
  13
WHERE NOT EXISTS (
  SELECT 1 FROM addons WHERE name = 'Service Catalogue'
);
