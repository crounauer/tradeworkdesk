-- Patch 012: Add thumbnail_storage_path to file_attachments
-- Run this in your Supabase SQL Editor

ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS thumbnail_storage_path TEXT;
