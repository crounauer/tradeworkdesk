-- patch-034: Add 'completed' to follow_ups status check constraint
ALTER TABLE follow_ups
  DROP CONSTRAINT IF EXISTS follow_ups_status_check;

ALTER TABLE follow_ups
  ADD CONSTRAINT follow_ups_status_check
  CHECK (status IN ('awaiting_parts', 'parts_arrived', 'booked', 'cancelled', 'completed'));
