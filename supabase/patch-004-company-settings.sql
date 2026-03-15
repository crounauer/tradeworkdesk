-- Patch 004: Company Settings
-- Run this in your Supabase SQL Editor for existing databases

-- Company settings table (singleton row pattern)
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  singleton_id TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  trading_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'United Kingdom',
  phone TEXT,
  email TEXT,
  website TEXT,
  gas_safe_number TEXT,
  oftec_number TEXT,
  vat_number TEXT,
  company_number TEXT,
  logo_url TEXT,
  logo_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_settings_singleton UNIQUE (singleton_id)
);

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at'
    AND tgrelid = 'company_settings'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON company_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Row Level Security
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read company settings (needed for PDFs, headers etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'company_settings_select'
  ) THEN
    CREATE POLICY "company_settings_select" ON company_settings
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Only admins can insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'company_settings_insert'
  ) THEN
    CREATE POLICY "company_settings_insert" ON company_settings
      FOR INSERT TO authenticated
      WITH CHECK (get_user_role(auth.uid()) = 'admin');
  END IF;
END $$;

-- Only admins can update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'company_settings_update'
  ) THEN
    CREATE POLICY "company_settings_update" ON company_settings
      FOR UPDATE TO authenticated
      USING (get_user_role(auth.uid()) = 'admin');
  END IF;
END $$;

-- Public bucket for company logos (accessible for PDF generation)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT DO NOTHING;

-- Allow admin/office to upload logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'company_logos_upload'
  ) THEN
    CREATE POLICY "company_logos_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'company-logos' AND get_user_role(auth.uid()) = 'admin');
  END IF;
END $$;

-- All authenticated users can view the logo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'company_logos_read'
  ) THEN
    CREATE POLICY "company_logos_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'company-logos');
  END IF;
END $$;

-- Admins can delete/replace logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'company_logos_delete'
  ) THEN
    CREATE POLICY "company_logos_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'company-logos' AND get_user_role(auth.uid()) = 'admin');
  END IF;
END $$;
