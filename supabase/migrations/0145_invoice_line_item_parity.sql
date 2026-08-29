-- Invoice line item parity with job parts / services / time entries.
-- Adds the fields the job page records so quotes and invoices can present and
-- round-trip the same parts / services / time format.

ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS serial_number   text,
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'fitted',
  ADD COLUMN IF NOT EXISTS arrival_time    timestamptz,
  ADD COLUMN IF NOT EXISTS departure_time  timestamptz,
  ADD COLUMN IF NOT EXISTS hourly_rate     numeric(12,2),
  ADD COLUMN IF NOT EXISTS callout_fee     numeric(12,2),
  ADD COLUMN IF NOT EXISTS callout_rate_id uuid,
  ADD COLUMN IF NOT EXISTS notes           text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_status_check'
  ) THEN
    ALTER TABLE invoice_line_items
      ADD CONSTRAINT invoice_line_items_status_check
      CHECK (status IN ('fitted', 'to_order'));
  END IF;
END $$;
