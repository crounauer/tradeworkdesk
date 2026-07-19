-- Patch 047: Shopping list technician update toggle
-- Controls whether technicians can update shopping list items.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS technicians_can_update_shopping_list_items BOOLEAN NOT NULL DEFAULT TRUE;
