-- Step 1: Add is_legacy column
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Mark old tiered plans as legacy (by name for portability, plus known IDs as fallback)
UPDATE plans SET is_legacy = true
WHERE name IN ('Starter', 'Professional', 'Enterprise', 'Forms Only')
   OR id IN (
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000003',
     '5ba5a760-8205-44a8-865a-9ea8d8de5a15'
   );

-- Step 3: Create the new Base Plan (idempotent — skip if a non-legacy plan named 'Base Plan' already exists)
INSERT INTO plans (name, description, monthly_price, annual_price, max_users, max_jobs_per_month, features, is_active, is_legacy, sort_order)
SELECT 'Base Plan', 'Core platform access with digital forms', 8.50, 85, 1, 50, '{}'::jsonb, true, false, 0
WHERE NOT EXISTS (
  SELECT 1 FROM plans WHERE name = 'Base Plan' AND is_legacy = false
);

-- Step 4: Ensure Base Plan has correct pricing and limits
UPDATE plans SET
  monthly_price = 8.50,
  annual_price = 85,
  max_users = 1,
  max_jobs_per_month = 50,
  description = 'Core platform access with digital forms',
  is_active = true,
  is_legacy = false,
  sort_order = 0
WHERE name = 'Base Plan' AND is_legacy = false;

-- Step 5: Deactivate old plans so they don't appear in the UI
UPDATE plans SET is_active = false WHERE is_legacy = true;

-- Step 6: Move all tenants to the Base Plan with trial status
UPDATE tenants SET
  plan_id = (SELECT id FROM plans WHERE name = 'Base Plan' AND is_legacy = false LIMIT 1),
  status = 'trial';

-- Step 7: Subscribe all tenants to all active add-ons (upsert with quantity enforcement)
INSERT INTO tenant_addons (tenant_id, addon_id, is_active, quantity, activated_at)
SELECT t.id, a.id, true, 1, NOW()
FROM tenants t
CROSS JOIN addons a
WHERE a.is_active = true
ON CONFLICT (tenant_id, addon_id) DO UPDATE SET is_active = true, quantity = 1;
