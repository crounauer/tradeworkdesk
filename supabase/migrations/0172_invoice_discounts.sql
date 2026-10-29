-- Invoice-wide discounts are deducted from the subtotal before VAT.
-- Apply in the Supabase SQL Editor before deploying the matching API/frontend.
-- Existing invoices retain their current totals and default to no discount.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_discount_valid' AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_discount_valid CHECK (
      discount_value >= 0
      AND discount_amount >= 0
      AND discount_amount <= GREATEST(subtotal, 0)
      AND (
        (discount_type IS NULL AND discount_value = 0 AND discount_amount = 0)
        OR (
          discount_type IS NOT NULL
          AND type = 'invoice'
          AND (
            (discount_type = 'percentage' AND discount_value <= 100)
            OR (discount_type = 'fixed' AND discount_value <= GREATEST(subtotal, 0))
          )
        )
      )
    );
  END IF;
END $$;
