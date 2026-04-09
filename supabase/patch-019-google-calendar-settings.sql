ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_client_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_client_secret TEXT DEFAULT NULL;
