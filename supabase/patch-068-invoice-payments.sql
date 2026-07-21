-- patch-068: invoice payment ledger
-- Supports multiple prepayments/part-payments against draft or sent invoices.

CREATE TABLE IF NOT EXISTS invoice_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id        TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date     DATE NOT NULL,
  payment_method   TEXT,
  payment_reference TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_tenant_id_idx ON invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_date_idx ON invoice_payments(invoice_id, payment_date);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_payments_tenant_isolation" ON invoice_payments;
CREATE POLICY "invoice_payments_tenant_isolation"
  ON invoice_payments
  USING (tenant_id = current_setting('app.tenant_id', true));