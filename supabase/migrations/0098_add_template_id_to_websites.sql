-- Migration 0098: Add template_id column to websites table
-- This enables tracking which template each website uses

-- Add the template_id column if it doesn't exist
ALTER TABLE IF EXISTS public.websites
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES website_templates(id) ON DELETE SET NULL;

-- Add index for template_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_websites_template_id ON websites(template_id);
