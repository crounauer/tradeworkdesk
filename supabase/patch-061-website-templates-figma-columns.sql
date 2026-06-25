-- patch-061: add missing Figma-template columns to website_templates
--
-- The live `website_templates` table was created from an earlier/partial schema
-- and is missing the columns the template upload endpoint
-- (POST /api/template-admin/templates/upload-zip) writes to.
--
-- Run this in the Supabase SQL Editor. All statements are idempotent.

ALTER TABLE website_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE website_templates ADD COLUMN IF NOT EXISTS design_tokens JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE website_templates ADD COLUMN IF NOT EXISTS preview_html_url TEXT;
ALTER TABLE website_templates ADD COLUMN IF NOT EXISTS figma_export_info JSONB;
ALTER TABLE website_templates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
