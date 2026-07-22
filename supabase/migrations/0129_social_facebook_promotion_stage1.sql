-- Migration 0129: Social Facebook promotion stage 1
-- Adds post typing, website-promotion metadata, UTM fields, and creator tracking.

DO $$ BEGIN
  CREATE TYPE social_post_type AS ENUM ('business', 'website_promotion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS post_type social_post_type;

UPDATE social_posts
SET post_type = 'business'
WHERE post_type IS NULL;

ALTER TABLE social_posts
  ALTER COLUMN post_type SET DEFAULT 'business';

ALTER TABLE social_posts
  ALTER COLUMN post_type SET NOT NULL;

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS website_page_id UUID,
  ADD COLUMN IF NOT EXISTS website_page_url TEXT,
  ADD COLUMN IF NOT EXISTS final_link_url TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

UPDATE social_posts
SET final_link_url = link_url
WHERE final_link_url IS NULL
  AND link_url IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_posts_website_page_id_fkey'
  ) THEN
    ALTER TABLE social_posts
      ADD CONSTRAINT social_posts_website_page_id_fkey
      FOREIGN KEY (website_page_id)
      REFERENCES website_pages(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_posts_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE social_posts
      ADD CONSTRAINT social_posts_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id)
      REFERENCES profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_posts_post_type_idx ON social_posts(post_type);
CREATE INDEX IF NOT EXISTS social_posts_website_page_id_idx ON social_posts(website_page_id);
CREATE INDEX IF NOT EXISTS social_posts_created_by_user_id_idx ON social_posts(created_by_user_id);
