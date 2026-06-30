ALTER TABLE calendar_holidays
  DROP CONSTRAINT IF EXISTS calendar_holidays_holiday_type_check;

ALTER TABLE calendar_holidays
  ADD CONSTRAINT calendar_holidays_holiday_type_check
  CHECK (
    holiday_type IN (
      'technician_leave',
      'technician_away',
      'technician_sick',
      'public_holiday',
      'bank_holiday'
    )
  );
