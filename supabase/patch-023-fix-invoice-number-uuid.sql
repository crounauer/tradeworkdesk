-- Fix: next_invoice_number function uses TEXT for tenant_id but column is UUID
-- Cast p_tenant_id to uuid in all comparisons to avoid "operator does not exist: uuid = text"

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
    WHERE tenant_id = p_tenant_id::uuid
      AND singleton_id = 'default';

    IF NOT FOUND THEN
      v_prefix := 'QUO';
      v_next   := 1;
    END IF;

    UPDATE company_settings
    SET quote_next_number = v_next + 1
    WHERE tenant_id = p_tenant_id::uuid
      AND singleton_id = 'default';
  ELSE
    SELECT
      COALESCE(invoice_number_prefix, 'INV'),
      COALESCE(invoice_next_number, 1)
    INTO v_prefix, v_next
    FROM company_settings
    WHERE tenant_id = p_tenant_id::uuid
      AND singleton_id = 'default';

    IF NOT FOUND THEN
      v_prefix := 'INV';
      v_next   := 1;
    END IF;

    UPDATE company_settings
    SET invoice_next_number = v_next + 1
    WHERE tenant_id = p_tenant_id::uuid
      AND singleton_id = 'default';
  END IF;

  -- Format: PREFIX-0001
  v_result := v_prefix || '-' || LPAD(v_next::TEXT, 4, '0');
  RETURN v_result;
END;
$$;
