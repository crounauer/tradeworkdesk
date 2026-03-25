-- Patch 015: Add pricing fields for invoice export
-- Run this in your Supabase SQL Editor

-- 1. Add unit_price to job_parts
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT NULL;

-- 2. Add pricing/invoicing fields to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC(10,2) DEFAULT 0;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS call_out_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(5,2) DEFAULT 20.00;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS default_payment_terms_days INTEGER DEFAULT 30;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'GBP';

-- 3. Add update policy for job_parts (needed for PATCH on unit_price)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_parts_update' AND tablename = 'job_parts'
  ) THEN
    CREATE POLICY "job_parts_update" ON job_parts FOR UPDATE TO authenticated
      USING (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (
          get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
          OR EXISTS (
            SELECT 1 FROM jobs WHERE jobs.id = job_parts.job_id AND jobs.assigned_technician_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (
          get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
          OR EXISTS (
            SELECT 1 FROM jobs WHERE jobs.id = job_parts.job_id AND jobs.assigned_technician_id = auth.uid()
          )
        )
      );
  END IF;
END $$;
