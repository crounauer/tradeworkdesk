# Workspace

## Overview

BoilerTech - Boiler service technician management web app. pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Database**: Supabase PostgreSQL (external)
- **Auth**: Supabase Auth (email/password)
- **Storage**: Supabase Storage (service-photos, service-documents, signatures buckets)
- **Validation**: Zod, Orval-generated schemas
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle for API server), Vite (frontend)
- **PDF generation**: jsPDF (client-side) — Oil Service Record PDF + CP12 Gas Safety Certificate PDF + Commissioning Record PDF
- **Signature capture**: react-signature-canvas

## Gas vs Oil Differentiation

The service record form detects the appliance's `fuel_type` from the job's linked appliance. Gas/LPG appliances show a CP12-style Gas Safety Record form; oil appliances show the traditional oil service record form.

**Gas-specific sections** (shown only for gas/lpg):
- CP12 / Gas Safe Details (engineer ID, certificate number, landlord cert)
- Gas Tightness Test (standing/working pressure, meter type, pass/fail)
- Gas Pressure Readings (operating, burner, heat input)
- Combustion extras (CO/CO2 ratio, flue spillage test, ventilation check)
- Gas-specific checks (gas valve, injectors, pilot, ignition, gas pressure)
- Appliance Classification (Safe / NCS / At Risk / Immediately Dangerous)
- Warning Notice panel (conditionally shown when AR or ID selected)

**Oil-specific sections** (shown only for oil):
- Smoke test + smoke number
- Nozzle check/replace + nozzle size fitted
- Electrodes, filters, oil line, fire valve checks

**Common sections** (shown for both):
- Arrival/departure, visual inspection, combustion readings
- Burner, heat exchanger, seals, controls, thermostat, safety devices
- Safety & defects, work summary, follow-up

## Commissioning Records

For `installation` job types, a commissioning record form is available. This captures:
- Gas Safe engineer ID
- Gas supply & pressure readings (standing, working, operating, gas rate)
- Combustion readings (CO, CO2, flue temp)
- Functional tests (ignition, controls, thermostats, pressure relief, expansion vessel, system flush, inhibitor)
- Customer handover (instructions given, name signed)
- Notes

**DB table**: `commissioning_records` (in `supabase/migration.sql`)
**Backend**: `artifacts/api-server/src/routes/commissioning-records.ts` (CRUD + job lookup)
**Frontend**: `artifacts/boiler-app/src/pages/commissioning-record-form.tsx`
**Route**: `/jobs/:jobId/commissioning` (only shown for installation jobs on job-detail page)
**PDF**: `generateCommissioningPdf()` in `artifacts/boiler-app/src/lib/pdf-generator.ts`

## Architecture

- **Authentication**: Supabase Auth with email/password. Frontend uses `@supabase/supabase-js` client. API server verifies JWT tokens via `supabaseAdmin.auth.getUser()`.
- **Authorization**: Role-based (admin, office_staff, technician, super_admin). Roles stored in `profiles` table. Backend middleware `requireRole()` enforces access. Technicians can only access jobs assigned to them (enforced server-side via ownership checks).
- **Multi-tenancy**: All data tables have `tenant_id NOT NULL` FK to `tenants` table. Auth middleware extracts tenant from user profile. All routes scope queries by `tenant_id`. Super_admin bypasses tenant scoping. `requireTenant` middleware blocks requests without tenant context. `tenant_subscriptions` table tracks plan subscriptions per tenant.
- **Platform Admin**: Super_admin users access `/platform/*` routes for tenant/plan/announcement/audit management. Platform pages: Dashboard (with MRR metric + 12-month signup chart), Tenants list, Tenant detail, Plans, Announcements, Audit Log. `/me/tenant` endpoint returns tenant info + subscription for current user.
- **Registration**: Multi-step company signup flow (Step 1: Company/Contact, Step 2: Plan Selection, Step 3: Credentials) with auto-login after registration. Invite-code registration for joining existing companies. `/auth/register` endpoint (alias of `/auth/register-company`).
- **File Storage**: Supabase Storage with 3 buckets: `service-photos`, `service-documents`, `signatures`. Files uploaded via multer, stored in Supabase, signed URLs generated for access.
- **Row Level Security**: Database has RLS policies with tenant predicates on all data tables (select/insert/update/delete scoped to user's tenant_id, super_admin bypasses). API server uses service role key to bypass RLS for backend operations, but enforces authorization checks at the route handler level.
- **FK Ownership Validation**: Write routes validate that referenced foreign keys (customer_id, property_id, appliance_id, assigned_technician_id) belong to the requesting user's tenant before insert/update. Uses `verifyMultipleTenantOwnership()` utility in `artifacts/api-server/src/lib/tenant-validation.ts`.

## Environment Variables

- `SUPABASE_URL` - Supabase project URL (required: backend + frontend)
- `SUPABASE_ANON_KEY` - Supabase anon/public key (required: backend + frontend)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required: backend only)
- `VITE_SUPABASE_URL` - Frontend Supabase URL (auto-set from SUPABASE_URL)
- `VITE_SUPABASE_ANON_KEY` - Frontend Supabase anon key (auto-set from SUPABASE_ANON_KEY)
- `PORT` - Server port (auto-assigned per artifact by Replit)
- `BASE_PATH` - URL base path prefix (auto-assigned per artifact by Replit)
- `INDEXNOW_KEY` - IndexNow API verification key (shared)
- `SOCIAL_ENCRYPTION_KEY` - 32-byte hex string for AES-256-GCM encryption of social account credentials (shared)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Replit AI integrations OpenAI proxy URL (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Replit AI integrations OpenAI proxy key (auto-provisioned)

## Seed Data

Seed data in `supabase/seed.sql` includes 12 customers, 13 properties, and 14 appliances that can be inserted directly. Job/service record/breakdown report seed entries are provided as commented SQL and require substituting real Supabase Auth user UUIDs for the `assigned_technician_id` / `technician_id` columns before running.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── boiler-app/         # React + Vite frontend (previewPath "/")
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── integrations-openai-ai-server/  # OpenAI SDK integration (server-side)
│   └── db/                 # Drizzle ORM schema definitions
├── supabase/
│   ├── migration.sql       # Full database schema (run in Supabase SQL editor)
│   └── seed.sql            # Sample data for testing
└── package.json
```

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. All routes under `/api`.

- Routes: auth, customers, properties, appliances, jobs, service-records, breakdown-reports, commissioning-records, oil-tank-inspections, oil-tank-risk-assessments, combustion-analysis-records, burner-setup-records, fire-valve-test-records, oil-line-vacuum-tests, job-completion-reports, notes, files, signatures, search, reports, dashboard, platform, indexnow, social
- Uses `supabaseAdmin` (service role) for all DB/storage operations
- Auth middleware: `requireAuth` validates JWT + extracts tenantId, `requireRole` checks user role, `requireSuperAdmin` enforces super_admin role, `requireTenant` ensures tenant context
- Resource-level authorization: technicians restricted to assigned jobs across all job-related endpoints (detail, service records, breakdown reports, files, signatures, notes)
- File uploads: multer with memory storage, 10MB limit; server-side image compression via sharp (max 1920px, JPEG quality 80) with 300px thumbnail generation
- Job comments: PATCH/DELETE note routes with author-only edit, author+admin delete
- Centralized error handling middleware

### `artifacts/boiler-app` (`@workspace/boiler-app`)

React + Vite frontend with Tailwind CSS and shadcn/ui components.

- Auth: Supabase client-side auth with `useAuth` hook
- Fetch interceptor: automatically attaches Supabase JWT to `/api/` requests
- Pages: Login, Register (self-service company sign-up + invite code), Dashboard, Customers, Customer Detail, Properties, Property Detail, Appliances, Appliance Detail, Jobs, Job Detail, Service Record Form, Breakdown Report Form, Commissioning Record Form, Oil Tank Inspection Form, Oil Tank Risk Assessment Form, Combustion Analysis Form, Burner Setup Form, Fire Valve Test Form, Oil Line Vacuum Test Form, Job Completion Report Form, Job Files, Job Signatures, Search, Reports, Admin Social Media, Platform Dashboard, Platform Tenants, Platform Tenant Detail, Platform Plans, Platform Announcements, Platform Audit Log
- Routing: wouter with protected routes; root `/` shows marketing home for guests, dashboard for authenticated
- Marketing site: SEO-optimised landing pages at `/features`, `/pricing`, `/about`, `/contact`; 3 trade keyword pages (`/gas-engineer-software`, `/boiler-service-management-software`, `/job-management-software-heating-engineers`); blog at `/blog` with 5 seed posts; legal pages at `/privacy-policy` and `/terms-of-service`. Uses `MarketingLayout` (nav + footer) and `SEOHead` component with JSON-LD structured data.
- Blog: Static data layer in `src/data/blog-posts.ts`. Posts rendered via `src/pages/marketing/blog-post.tsx`.
- IndexNow: Super_admin can submit all marketing URLs to search engines via `POST /api/indexnow/submit`. Button on Platform Dashboard.
- Social Media: Admin page at `/admin/social` with Posts, Suggestions, and Accounts tabs. AI-generated post suggestions, image generation, bulk scheduling, and platform dispatch (X/Twitter, Facebook, Instagram). Background scheduler runs every 60s to publish scheduled posts.
- API calls: Generated React Query hooks from `@workspace/api-client-react`
- PDF export: client-side PDF generation for service records via jsPDF
- Signature capture: react-signature-canvas for customer/technician signatures

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas. Used by api-server for request/response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks. Used by boiler-app for API calls. Also exports `customFetch` for manual API calls (e.g., file uploads).

### `lib/db` (`@workspace/db`)

Drizzle ORM schema definitions matching the Supabase database tables. Exports typed table definitions and inferred TypeScript types for all entities.

## Database

The database schema is in `supabase/migration.sql`. It must be run manually in the Supabase SQL editor. Tables: profiles, customers, properties, appliances, jobs, service_records, commissioning_records, breakdown_reports, oil_tank_inspections, oil_tank_risk_assessments, combustion_analysis_records, burner_setup_records, fire_valve_test_records, oil_line_vacuum_tests, job_completion_reports, job_notes, file_attachments, signatures, lookup_options, plans, tenants, tenant_subscriptions, platform_announcements, platform_audit_log, job_parts. All data tables have `tenant_id NOT NULL`. Includes tenant-aware RLS policies and storage bucket setup. Sample data available in `supabase/seed.sql`. Platform migration in `supabase/patch-005-platform-admin.sql` (must be run in Supabase SQL Editor). Job time tracking patch in `supabase/patches/patch-011-job-time-parts.sql` (adds arrival_time/departure_time to jobs + job_parts table). Thumbnail support patch in `supabase/patches/patch-012-thumbnail-storage-path.sql` (adds thumbnail_storage_path to file_attachments). Multi-date time entries patch in `supabase/patches/patch-013-job-time-entries.sql` (creates job_time_entries table for multiple time-attended records per job, replacing single arrival/departure on jobs table).

Schema enums: user_role (admin/office_staff/technician/super_admin), tenant_status (trial/active/suspended/cancelled), job_status, job_type (service/breakdown/installation/inspection/follow_up), priority_level, property_type, occupancy_type, fuel_type, boiler_type, system_type.

## Codegen Notes

After regenerating API client via Orval, two manual fixups are required in `lib/api-zod/src/generated/api.ts`:
1. Replace all `zod.date()` with `zod.coerce.date()` (Supabase returns ISO strings, not Date objects)
2. Replace `zod.instanceof(File)` with `zod.any()` (File type unavailable in Node.js)

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client hooks and Zod schemas
