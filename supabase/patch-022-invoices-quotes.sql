-- patch-022: Invoices & Quotes
-- Adds invoice/quote DB tables plus invoicing settings on company_settings

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE invoice_type AS ENUM ('invoice', 'quote');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled',
    'accepted',
    'declined',
    'converted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_item_type AS ENUM (
    'labour',
    'callout',
    'product',
    'service',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- INVOICES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               TEXT NOT NULL,
  job_id                  UUID NOT NULL REFERENCES jobs(id),
  customer_id             UUID NOT NULL REFERENCES customers(id),
  type                    invoice_type NOT NULL DEFAULT 'invoice',
  status                  invoice_status NOT NULL DEFAULT 'draft',
  invoice_number          TEXT NOT NULL,
  issue_date              DATE NOT NULL,
  due_date                DATE,          -- invoice: payment due date
  expiry_date             DATE,          -- quote: valid until date
  notes                   TEXT,          -- internal notes
  customer_notes          TEXT,          -- shown on document
  subtotal                NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate                NUMERIC(5,2) NOT NULL DEFAULT 20,
  vat_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'GBP',
  -- Payment tracking (invoice only)
  paid_amount             NUMERIC(12,2),
  payment_date            DATE,
  payment_method          TEXT,          -- cash, card, bank_transfer, cheque, other
  payment_reference       TEXT,
  -- Lifecycle timestamps
  sent_at                 TIMESTAMPTZ,
  accepted_at             TIMESTAMPTZ,   -- quote accepted
  declined_at             TIMESTAMPTZ,   -- quote declined
  -- Quote→Invoice conversion
  converted_to_invoice_id UUID REFERENCES invoices(id),
  -- PDF storage
  pdf_storage_path        TEXT,
  -- Audit
  created_by              UUID REFERENCES profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx        ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS invoices_job_id_idx           ON invoices(job_id);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx      ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx           ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_type_idx             ON invoices(type);
CREATE INDEX IF NOT EXISTS invoices_issue_date_idx       ON invoices(issue_date);

-- ============================================================
-- INVOICE LINE ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  item_type    invoice_item_type NOT NULL DEFAULT 'other',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id_idx ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_line_items_tenant_id_idx  ON invoice_line_items(tenant_id);

-- ============================================================
-- COMPANY SETTINGS: add invoicing columns
-- ============================================================

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS invoices_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invoice_number_prefix     TEXT NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS quote_number_prefix       TEXT NOT NULL DEFAULT 'QUO',
  ADD COLUMN IF NOT EXISTS invoice_next_number       INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quote_next_number         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quote_validity_days       INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS invoice_footer_text       TEXT,
  ADD COLUMN IF NOT EXISTS invoice_bank_details      TEXT;

-- ============================================================
-- ATOMIC NUMBER GENERATOR
-- Returns the next formatted invoice/quote number and
-- atomically increments the counter. Uses advisory lock to
-- prevent concurrent duplicates.
-- ============================================================

CREATE OR REPLACE FUNCTION next_invoice_number(
  p_tenant_id TEXT,
  p_type      TEXT  -- 'invoice' or 'quote'
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_next   INTEGER;
  v_result TEXT;
  v_lock   BIGINT;
BEGIN
  -- Use advisory lock keyed by hash of tenant_id + type to prevent races
  v_lock := hashtext(p_tenant_id || ':' || p_type);
  PERFORM pg_advisory_xact_lock(v_lock);

  IF p_type = 'quote' THEN
    SELECT
      COALESCE(quote_number_prefix, 'QUO'),
      COALESCE(quote_next_number, 1)
    INTO v_prefix, v_next
    FROM company_settings
    WHERE tenant_id = p_tenant_id
      AND singleton_id = 'default';

    IF NOT FOUND THEN
      v_prefix := 'QUO';
      v_next   := 1;
    END IF;

    UPDATE company_settings
    SET quote_next_number = v_next + 1
    WHERE tenant_id = p_tenant_id
      AND singleton_id = 'default';
  ELSE
    SELECT
      COALESCE(invoice_number_prefix, 'INV'),
      COALESCE(invoice_next_number, 1)
    INTO v_prefix, v_next
    FROM company_settings
    WHERE tenant_id = p_tenant_id
      AND singleton_id = 'default';

    IF NOT FOUND THEN
      v_prefix := 'INV';
      v_next   := 1;
    END IF;

    UPDATE company_settings
    SET invoice_next_number = v_next + 1
    WHERE tenant_id = p_tenant_id
      AND singleton_id = 'default';
  END IF;

  -- Format: PREFIX-0001
  v_result := v_prefix || '-' || LPAD(v_next::TEXT, 4, '0');
  RETURN v_result;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Invoices: tenant-scoped via service role (API server uses service role key,
-- so RLS is supplementary/advisory — mirrors the pattern used for other tables)
DROP POLICY IF EXISTS "invoices_tenant_isolation" ON invoices;
CREATE POLICY "invoices_tenant_isolation"
  ON invoices
  USING (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS "invoice_line_items_tenant_isolation" ON invoice_line_items;
CREATE POLICY "invoice_line_items_tenant_isolation"
  ON invoice_line_items
  USING (tenant_id = current_setting('app.tenant_id', true));

-- updated_at trigger for invoices
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_updated_at_trigger ON invoices;
CREATE TRIGGER invoices_updated_at_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoices_updated_at();
