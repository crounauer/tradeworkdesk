-- patch-070: Template conversion system (Figma ZIP + URL → Template Package)
-- Supports workflow: Upload ZIP + URL → Convert → Review → Approve → Publish

CREATE TABLE IF NOT EXISTS template_conversions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Conversion metadata
  status                VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, processing, failed
  
  -- Input
  figma_url             TEXT NOT NULL,
  figma_zip_url         TEXT,  -- Stored Supabase URL of uploaded ZIP
  
  -- Template info (from conversion)
  template_name         VARCHAR(255) NOT NULL,
  template_slug         VARCHAR(255) NOT NULL,
  template_description  TEXT,
  industries            TEXT[] DEFAULT '{}',
  
  -- Conversion result (when status != pending)
  converted_package_url TEXT,  -- URL to generated template package ZIP
  block_mapping_report  JSONB,  -- Pages + detected blocks
  design_tokens         JSONB,  -- Extracted from Figma
  error_message         TEXT,
  
  -- Metadata
  created_by            UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  processed_at          TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  approved_by           UUID REFERENCES profiles(id),
  
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_template_conversions_status ON template_conversions(status);
CREATE INDEX IF NOT EXISTS idx_template_conversions_created_by ON template_conversions(created_by);
CREATE INDEX IF NOT EXISTS idx_template_conversions_slug ON template_conversions(template_slug);

ALTER TABLE template_conversions ENABLE ROW LEVEL SECURITY;

-- Policies: superadmin only
DROP POLICY IF EXISTS "conversions_view" ON template_conversions;
CREATE POLICY "conversions_view" ON template_conversions
  FOR SELECT
  USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "conversions_manage" ON template_conversions;
CREATE POLICY "conversions_manage" ON template_conversions
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "conversions_manage_update" ON template_conversions;
CREATE POLICY "conversions_manage_update" ON template_conversions
  FOR UPDATE
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
