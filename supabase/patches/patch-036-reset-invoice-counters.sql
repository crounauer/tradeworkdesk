-- Patch 036: Reset invoice and quote number counters back to 1
UPDATE company_settings
SET invoice_next_number = 1,
    quote_next_number   = 1
WHERE singleton_id = 'default';
