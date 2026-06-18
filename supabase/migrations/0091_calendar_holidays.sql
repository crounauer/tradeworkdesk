-- Calendar holidays and technician leave blocks
CREATE TABLE IF NOT EXISTS calendar_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  technician_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  holiday_type TEXT NOT NULL CHECK (holiday_type IN ('technician_leave', 'public_holiday', 'bank_holiday')),
  notes TEXT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_holidays_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_holidays_tenant_dates
  ON calendar_holidays (tenant_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_calendar_holidays_tenant_technician_dates
  ON calendar_holidays (tenant_id, technician_id, start_date, end_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_holidays_import_key
  ON calendar_holidays (tenant_id, name, start_date, holiday_type);

ALTER TABLE calendar_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_holidays_tenant_policy ON calendar_holidays;
CREATE POLICY calendar_holidays_tenant_policy ON calendar_holidays
  FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = calendar_holidays.tenant_id
    )
  );
