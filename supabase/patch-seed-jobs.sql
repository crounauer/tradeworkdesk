-- patch-seed-jobs.sql
-- Seeds the jobs table with test data for dashboard testing
-- First ensures customers/properties/appliances have correct tenant_id

-- Step 1: Update tenant_id for existing seed data
UPDATE customers SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
WHERE tenant_id IS NULL AND id::text LIKE 'a1000000%';

UPDATE properties SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
WHERE tenant_id IS NULL AND id::text LIKE 'b1000000%';

UPDATE appliances SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
WHERE tenant_id IS NULL AND id::text LIKE 'c1000000%';

-- Step 2: Seed the jobs table with test data
INSERT INTO jobs (
  id, tenant_id, customer_id, property_id, appliance_id, 
  assigned_technician_id, job_type, job_type_id, status, priority, 
  scheduled_date, scheduled_time, estimated_duration, 
  description, is_active, created_at, updated_at
) VALUES

-- Today's jobs (to show on dashboard)
  ('d1000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'b1000000-0000-0000-0000-000000000001'::uuid,
   'c1000000-0000-0000-0000-000000000001'::uuid,
   NULL,
   'service', 1, 'scheduled', 'medium',
   CURRENT_DATE, '09:00', 60, 
   'Annual service - Greenstar 8000 Life', true, NOW(), NOW()),

-- Upcoming jobs  
  ('d1000000-0000-0000-0000-000000000002'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   'a1000000-0000-0000-0000-000000000002'::uuid,
   'b1000000-0000-0000-0000-000000000002'::uuid,
   'c1000000-0000-0000-0000-000000000002'::uuid,
   NULL,
   'service', 1, 'scheduled', 'medium',
   CURRENT_DATE + INTERVAL '2 days', '10:30', 90,
   'Annual service - ecoTEC Plus 630', true, NOW(), NOW()),

-- Completed jobs (to show recent completed)
  ('d1000000-0000-0000-0000-000000000003'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   'a1000000-0000-0000-0000-000000000003'::uuid,
   'b1000000-0000-0000-0000-000000000004'::uuid,
   'c1000000-0000-0000-0000-000000000004'::uuid,
   NULL,
   'breakdown', 2, 'completed', 'high',
   CURRENT_DATE - INTERVAL '3 days', '08:00', 120,
   'Breakdown repair - no heating', true, NOW(), NOW()),

-- Overdue services (to show overdue appliances)
  ('d1000000-0000-0000-0000-000000000004'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   'a1000000-0000-0000-0000-000000000005'::uuid,
   'b1000000-0000-0000-0000-000000000006'::uuid,
   'c1000000-0000-0000-0000-000000000006'::uuid,
   NULL,
   'service', 1, 'scheduled', 'low',
   CURRENT_DATE + INTERVAL '5 days', '14:00', 120,
   'Annual service - CDi Classic 36', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Step 2: Verify the data was seeded
SELECT 'Jobs seeded successfully!' as status;
SELECT COUNT(*) as total_jobs FROM jobs WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;
SELECT COUNT(*) as jobs_today FROM jobs 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
AND scheduled_date = CURRENT_DATE;
