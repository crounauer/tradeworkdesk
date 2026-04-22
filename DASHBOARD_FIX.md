# Dashboard Missing Data - Root Cause Analysis & Fix

## Issue Summary
The dashboard loads but critical sections are missing data:
- **Missing:** Today's jobs, Upcoming jobs, Recent completed jobs, Overdue services, Job counts/stats
- **Showing:** Empty calendar, Empty profiles list, Buttons work but appear on empty dashboard

## Root Cause

### 1. **No Jobs in Database** (PRIMARY ISSUE)
**Location:** [supabase/seed.sql](supabase/seed.sql#L55-L65)

The jobs table is completely empty because all seed data is commented out:

```sql
-- Lines 55-65 in seed.sql: ALL COMMENTED OUT
-- Sample Jobs (NOTE: assigned_technician_id must reference an actual auth user ID from profiles table)
-- These use placeholder technician UUIDs - replace with real profile IDs after creating auth users
-- To make seed jobs work, first create profiles via Supabase Auth, then uncomment and adjust the technician IDs below.

-- Uncomment the following after creating auth users and profiles:
-- INSERT INTO jobs (id, customer_id, property_id, appliance_id, assigned_technician_id, job_type, status, priority, scheduled_date, scheduled_time, estimated_duration, description) VALUES
--   ('d1000000-0000-0000-0000-000000000001', ...
```

### 2. **No Test User/Technician Profile**
The jobs table requires `assigned_technician_id` to reference a valid profile (auth user). The seed.sql doesn't create any profiles because it would require hardcoded auth user UUIDs that don't exist yet.

### 3. **Missing Seed Data Impact**
| Table | Status | Reason |
|-------|--------|--------|
| customers | ✅ Seeded (~12 records) | No auth users required |
| properties | ✅ Seeded (~13 records) | No auth users required |
| appliances | ✅ Seeded (~14 records) | No auth users required |
| jobs | ❌ Empty | Commented out - needs technician_id |
| profiles | ❌ Empty | No auth users created yet |
| service_records | ❌ Empty | Depends on jobs (commented out) |

## API Trace

### Endpoint Called
**Frontend:** `GET /api/homepage` → [useHomepageData()](artifacts/boiler-app/src/hooks/use-homepage-data.ts)

### Backend Endpoint
**File:** [artifacts/api-server/src/routes/homepage.ts](artifacts/api-server/src/routes/homepage.ts#L75)

**Queries Executed:**
```typescript
// All these queries return empty arrays because no jobs exist:
- buildJobQuery().or(activeToday)  // Today's jobs: []
- buildJobQuery().gt("scheduled_date", today)  // Upcoming jobs: []
- buildJobQuery().eq("status", "completed")  // Recent jobs: []
- buildApplianceQuery().lt("next_service_due", today)  // Overdue: []
```

### Response Structure
The endpoint returns:
```json
{
  "dashboard": {
    "todays_jobs": [],
    "upcoming_jobs": [],
    "overdue_services": [],
    "recent_completed": [],
    "follow_up_required": [],
    "stats": {
      "total_customers": 12,
      "total_jobs_today": 0,      // ← EMPTY
      "overdue_count": 0,          // ← EMPTY
      "completed_this_week": 0     // ← EMPTY
    }
  },
  "calendar_jobs": { "jobs": [] }, // ← EMPTY - Calendar shows no events
  "profiles": [],                   // ← EMPTY - No technicians
  "storage": { ... }
}
```

## The Fix

### Option 1: Quick Local Test Fix (Recommended for Development)

**Run this SQL in Supabase SQL Editor:**

1. Execute [supabase/patch-seed-jobs.sql](supabase/patch-seed-jobs.sql)

This creates:
- ✅ Test technician profile (if not exists)
- ✅ 4 seed jobs (today, upcoming, completed, overdue)
- ✅ Automatically associates with default tenant

**Result:** Dashboard will show calendar with jobs, stats populated, all sections visible

### Option 2: Create Proper Auth User (Production Approach)

1. **Create auth user in Supabase:**
   - Go to Supabase Dashboard → Authentication → Users → Add User
   - Email: `technician@example.com`
   - Password: (generate strong password)
   - Copy the User UUID

2. **Create profile** with that UUID:
   ```sql
   INSERT INTO profiles (id, email, full_name, role, tenant_id)
   VALUES (
     '<YOUR_UUID_HERE>',
     'technician@example.com',
     'John Smith',
     'technician',
     '00000000-0000-0000-0000-000000000001'
   );
   ```

3. **Update seed.sql** with the real UUID:
   - Replace all `'TECHNICIAN_USER_ID'` with your actual UUID
   - Uncomment the jobs INSERT statements

## Verification

After applying the fix, run in Supabase SQL Editor:

```sql
-- Should show jobs now
SELECT COUNT(*) as job_count FROM jobs;

-- Should show test technician
SELECT COUNT(*) as profile_count FROM profiles;

-- Check dashboard data
SELECT 
  (SELECT COUNT(*) FROM jobs WHERE status = 'scheduled') as scheduled_jobs,
  (SELECT COUNT(*) FROM jobs WHERE status = 'completed') as completed_jobs,
  (SELECT COUNT(*) FROM customers) as total_customers;
```

## Files to Update

**Primary File:** [supabase/seed.sql](supabase/seed.sql) - Lines 55-65
- [ ] Uncomment jobs INSERT statements
- [ ] Replace `'TECHNICIAN_USER_ID'` with actual UUID or use patch-seed-jobs.sql

**Supporting File (Already Created):** [supabase/patch-seed-jobs.sql](supabase/patch-seed-jobs.sql)
- Run this to populate test jobs immediately

## Expected Dashboard After Fix

✅ **Calendar** - Shows jobs with color coding, technician assignments
✅ **Stats** - Displays counts: customers, jobs today, completed this week  
✅ **Quick Actions** - "Book Job" and "Add Enquiry" buttons functional
✅ **Empty States** - Only show if user creates no data, not because of missing seed

---

**Status:** Ready for fix application
**Severity:** High - Critical feature (dashboard) is non-functional
