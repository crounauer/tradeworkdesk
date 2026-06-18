-- Patch 025: Enable auto_create_enquiry on existing website contact forms
-- This ensures forms created before this patch also generate enquiries automatically.

UPDATE website_forms
SET auto_create_enquiry = true
WHERE form_type IN ('contact', 'quote', 'callback', 'emergency')
  AND auto_create_enquiry = false;
