-- Add is_platform_subdomain flag to website_domains
-- Platform subdomains (e.g. gasboilersuk.tradeworkdesk.co.uk) are auto-provisioned
-- when a website is created and are always active — no DNS verification required.

DO $$ BEGIN
  ALTER TABLE website_domains
    ADD COLUMN is_platform_subdomain BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
