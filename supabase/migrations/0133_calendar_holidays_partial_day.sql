ALTER TABLE calendar_holidays
  ADD COLUMN IF NOT EXISTS start_time TIME NULL,
  ADD COLUMN IF NOT EXISTS end_time TIME NULL;

ALTER TABLE calendar_holidays
  DROP CONSTRAINT IF EXISTS calendar_holidays_time_pair_valid;

ALTER TABLE calendar_holidays
  ADD CONSTRAINT calendar_holidays_time_pair_valid
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL)
  );

ALTER TABLE calendar_holidays
  DROP CONSTRAINT IF EXISTS calendar_holidays_time_order_valid;

ALTER TABLE calendar_holidays
  ADD CONSTRAINT calendar_holidays_time_order_valid
  CHECK (
    start_time IS NULL
    OR start_date < end_date
    OR end_time > start_time
  );
