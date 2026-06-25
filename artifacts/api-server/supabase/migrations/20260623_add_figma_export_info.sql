-- Add figma_export_info column to website_templates table
ALTER TABLE website_templates
ADD COLUMN IF NOT EXISTS figma_export_info JSONB DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_website_templates_figma_export_info ON website_templates USING GIN(figma_export_info);

-- Add comment for documentation
COMMENT ON COLUMN website_templates.figma_export_info IS 'Stores Figma export metadata including uploaded_images array with public URLs';
