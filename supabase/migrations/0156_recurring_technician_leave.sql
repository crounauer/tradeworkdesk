-- Group concrete leave blocks created from the same recurrence schedule.
ALTER TABLE calendar_holidays
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_holidays_recurrence_group
  ON calendar_holidays (tenant_id, recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;