-- Migration 0109: Template import metadata
--
-- Additive columns for the website template import API.

ALTER TABLE website_templates
  ADD COLUMN IF NOT EXISTS template_json JSONB NOT NULL DEFAULT '{}'::jsonb;
