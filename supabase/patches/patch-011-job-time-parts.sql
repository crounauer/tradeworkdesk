-- Patch 011: Add arrival/departure time tracking to jobs + job_parts table
-- Run this in your Supabase SQL Editor

-- 1. Add time tracking columns to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ;

-- 2. Create job_parts table
CREATE TABLE IF NOT EXISTS job_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  serial_number TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_parts_job ON job_parts(job_id);
CREATE INDEX IF NOT EXISTS idx_job_parts_tenant ON job_parts(tenant_id);

-- 3. RLS policies for job_parts
ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_parts_select" ON job_parts FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = job_parts.job_id AND jobs.assigned_technician_id = auth.uid()
    )
  );

CREATE POLICY "job_parts_insert" ON job_parts FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = job_parts.job_id AND jobs.assigned_technician_id = auth.uid()
    )
  );

CREATE POLICY "job_parts_delete" ON job_parts FOR DELETE TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'office_staff')
    OR EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = job_parts.job_id AND jobs.assigned_technician_id = auth.uid()
    )
  );
