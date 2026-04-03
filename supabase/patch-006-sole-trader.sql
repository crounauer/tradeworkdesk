-- Patch 006: Sole Trader Mode
-- Adds company_type column to tenants table to distinguish sole traders from companies

DO $$ BEGIN
  ALTER TABLE tenants ADD COLUMN company_type TEXT NOT NULL DEFAULT 'company'
    CHECK (company_type IN ('sole_trader', 'company'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_company_type ON tenants(company_type);
