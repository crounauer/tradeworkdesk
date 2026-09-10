-- Migration 0158: track last reminder sent for an invoice
ALTER TABLE IF EXISTS invoices
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
