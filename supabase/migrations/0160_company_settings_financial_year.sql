-- Migration 0160: configurable financial year start (defaults to UK tax year 6 Apr)
ALTER TABLE IF EXISTS company_settings
  ADD COLUMN IF NOT EXISTS financial_year_start_month SMALLINT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS financial_year_start_day SMALLINT NOT NULL DEFAULT 6;

DO $$ BEGIN
  ALTER TABLE company_settings ADD CONSTRAINT company_settings_fy_start_month_check CHECK (financial_year_start_month BETWEEN 1 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE company_settings ADD CONSTRAINT company_settings_fy_start_day_check CHECK (financial_year_start_day BETWEEN 1 AND 31);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
