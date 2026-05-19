-- patch-052: Add Google Business Profile to social media platforms
-- google_business uses the Business Profile API (OAuth2 refresh token flow).
-- Stored in social_accounts the same way as other platforms:
--   page_id               → Google Account resource name  (e.g. "accounts/123456")
--   instagram_business_id → Location resource ID         (e.g. "locations/789012")
--   credentials           → { clientId, clientSecret, refreshToken }

ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'google_business';
