-- Patch 026: Job schedule history table for tracking rescheduling
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS job_schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id),
  previous_date DATE,
  previous_time TIME,
  new_date DATE,
  new_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_schedule_history_job ON job_schedule_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_schedule_history_tenant ON job_schedule_history(tenant_id);

ALTER TABLE job_schedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_schedule_history_select" ON job_schedule_history FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
      OR EXISTS (
        SELECT 1 FROM jobs WHERE jobs.id = job_schedule_history.job_id AND jobs.assigned_technician_id = auth.uid()
      )
    )
  );

CREATE POLICY "job_schedule_history_insert" ON job_schedule_history FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      get_user_role(auth.uid()) IN ('admin', 'office_staff', 'super_admin')
      OR EXISTS (
        SELECT 1 FROM jobs WHERE jobs.id = job_schedule_history.job_id AND jobs.assigned_technician_id = auth.uid()
      )
    )
  );

CREATE POLICY "job_schedule_history_super_admin" ON job_schedule_history FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'super_admin');
