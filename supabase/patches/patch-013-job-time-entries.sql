-- Patch 013: Job time entries table for multi-date time tracking
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS job_time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  arrival_time TIMESTAMPTZ NOT NULL,
  departure_time TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_time_entries_job ON job_time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_tenant ON job_time_entries(tenant_id);

ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_time_entries_select" ON job_time_entries FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
      OR EXISTS (
        SELECT 1 FROM jobs WHERE jobs.id = job_time_entries.job_id AND jobs.assigned_technician_id = auth.uid()
      )
    )
  );

CREATE POLICY "job_time_entries_insert" ON job_time_entries FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
      OR EXISTS (
        SELECT 1 FROM jobs WHERE jobs.id = job_time_entries.job_id AND jobs.assigned_technician_id = auth.uid()
      )
    )
  );

CREATE POLICY "job_time_entries_delete" ON job_time_entries FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
      OR EXISTS (
        SELECT 1 FROM jobs WHERE jobs.id = job_time_entries.job_id AND jobs.assigned_technician_id = auth.uid()
      )
    )
  );

CREATE POLICY "job_time_entries_super_admin" ON job_time_entries FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
