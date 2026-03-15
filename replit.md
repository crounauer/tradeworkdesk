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

## Architecture

- **Authentication**: Supabase Auth with email/password. Frontend uses `@supabase/supabase-js` client. API server verifies JWT tokens via `supabaseAdmin.auth.getUser()`.
- **Authorization**: Role-based (admin, office_staff, technician). Roles stored in `profiles` table. Backend middleware `requireRole()` enforces access.
- **File Storage**: Supabase Storage with 3 buckets: `service-photos`, `service-documents`, `signatures`. Files uploaded via multer, stored in Supabase, signed URLs generated for access.
- **Row Level Security**: Database has RLS policies. API server uses service role key to bypass RLS for backend operations.

## Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `VITE_SUPABASE_URL` - Frontend Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Frontend Supabase anon key

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
│   └── db/                 # Drizzle ORM schema (not used - using Supabase directly)
├── supabase/
│   └── migration.sql       # Full database schema (run in Supabase SQL editor)
└── package.json
```

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. All routes under `/api`.

- Routes: auth, customers, properties, appliances, jobs, service-records, breakdown-reports, notes, files, signatures, search, reports, dashboard
- Uses `supabaseAdmin` (service role) for all DB/storage operations
- Auth middleware: `requireAuth` validates JWT, `requireRole` checks user role
- File uploads: multer with memory storage, 10MB limit

### `artifacts/boiler-app` (`@workspace/boiler-app`)

React + Vite frontend with Tailwind CSS and shadcn/ui components.

- Auth: Supabase client-side auth with `useAuth` hook
- Fetch interceptor: automatically attaches Supabase JWT to `/api/` requests
- Pages: Login, Dashboard, Customers, Customer Detail, Properties, Appliances, Jobs, Job Detail, Service Record Form, Search, Reports
- Routing: wouter with protected routes
- API calls: Generated React Query hooks from `@workspace/api-client-react`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas. Used by api-server for request/response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks. Used by boiler-app for API calls.

## Database

The database schema is in `supabase/migration.sql`. It must be run manually in the Supabase SQL editor. Tables: profiles, customers, properties, appliances, jobs, service_records, breakdown_reports, job_notes, file_attachments, signatures. Includes RLS policies and storage bucket setup.

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client hooks and Zod schemas
