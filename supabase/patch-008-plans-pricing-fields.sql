-- Patch 008: Add per-user pricing fields and popular flag to plans table
-- Run this in your Supabase SQL Editor on any existing database.
-- All statements are idempotent (safe to run more than once).

-- ─── 1. New columns ─────────────────────────────────────────────────────────────

ALTER TABLE plans ADD COLUMN IF NOT EXISTS per_user_price INTEGER; -- whole GBP, e.g. 12 = £12/user/month
ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_note TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT false;
