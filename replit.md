# Overview

BoilerTech is a pnpm workspace monorepo using TypeScript, designed as a web application for managing boiler service technicians. Its primary purpose is to streamline the operations of boiler service companies by providing tools for job management, technician scheduling, service record keeping, and customer interaction. The platform aims to serve as a comprehensive solution for managing gas and oil appliance services, installations, and various inspections.

TradeWorkDesk - Boiler service technician management web app. pnpm workspace monorepo using TypeScript. The project offers a robust platform for technicians to access job details, complete digital forms (e.g., Gas Safety Certificates, Oil Service Records, Commissioning Records), and capture signatures on-site. For administrative staff, it provides tools for customer management, property tracking, appliance details, and report generation. The business vision is to become the leading software solution for heating engineers, enabling them to operate more efficiently, ensure compliance, and enhance customer satisfaction.

Key capabilities include:
- Differentiated service record forms for gas/LPG and oil appliances.
- Commissioning record forms for installation job types.
- Multi-tenant architecture for managing multiple companies.
- Role-based authorization for different user types (admin, office staff, technician, super admin).
- Integration with Supabase for authentication, database, and file storage.
- Client-side PDF generation for various certificates and reports.
- Invoice export functionalities in multiple formats.
- Pluggable accounting integrations framework (Zoho Invoice first, architecture ready for Xero, QuickBooks, Sage, FreeAgent). Admin connects via OAuth in Company Settings, then sends invoices from job detail with one click.
- Social media integration for marketing and post scheduling.
- A comprehensive platform administration panel for managing tenants, plans, and announcements.
- A public-facing marketing site with SEO-optimized content and a blog.
- Customer CSV import with field mapping, duplicate detection, and preview.

# User Preferences

I prefer concise and straightforward explanations. When implementing new features or making changes, please prioritize an iterative development approach, making small, testable changes. Before making any major architectural decisions or significant code overhauls, please ask for my approval. Ensure all database changes are clearly documented and, where applicable, provided as migration scripts.

# System Architecture

The BoilerTech application is built as a pnpm workspace monorepo.

**Frontend (boiler-app):**
- **Technology Stack:** React, Vite, Tailwind CSS, shadcn/ui.
- **UI/UX:** Uses `shadcn/ui` for a modern, accessible component library. Tailwind CSS ensures a consistent and responsive design. The frontend includes a marketing site with SEO-optimized landing pages and a blog, utilizing a `MarketingLayout` and `SEOHead` component with JSON-LD structured data.
- **Authentication:** Supabase client-side authentication with a `useAuth` hook.
- **Routing:** `wouter` for client-side routing, with protected routes ensuring authorization.
- **API Communication:** Uses generated React Query hooks from `@workspace/api-client-react` for efficient data fetching and caching. A fetch interceptor automatically attaches Supabase JWTs to API requests using `onAuthStateChange` event-driven token caching (no redundant `getSession()` calls on each request). Critical queries (`me-init`, `dashboard`) are prefetched as soon as the auth session is resolved.
- **PDF Generation:** Client-side PDF generation for service records, CP12 certificates, and commissioning records using `jsPDF`.
- **Signature Capture:** Integrated `react-signature-canvas` for digital signature collection.
- **Invoice Export:** Frontend components for viewing invoice summaries and triggering exports in various formats (CSV, QuickBooks IIF, Xero CSV, Sage CSV).
- **Plan Feature Gating:** Uses a `usePlanFeatures()` hook to dynamically enable/disable UI elements and pages based on the user's subscription plan, displaying an `UpgradePrompt` when features are restricted.
- **Social Media:** An admin page (`/admin/social`) for managing social media posts, including AI-generated suggestions, image generation, bulk scheduling, and dispatch to platforms like X/Twitter and Facebook.

**Backend (api-server):**
- **Technology Stack:** Express 5.
- **API Design:** All routes are under `/api`.
- **Authentication:** Verifies JWT tokens via `supabaseAdmin.auth.getUser()` with a token-level cache (10s TTL, max 500 entries) to reduce Supabase auth round-trips.
- **Authorization:** Implements role-based access control (`requireRole()`, `requireSuperAdmin()`) and resource-level authorization (technicians restricted to assigned jobs).
- **Init Endpoint:** `/api/me/init` combines profile, plan features, tenant info, and enquiry count into a single request with all queries running in parallel. Server-side cache (60s TTL, per-user). Frontend `useInitData()` hook replaces separate fetches for `usePlanFeatures`, `useIsSoleTrader`, and enquiry count.
- **Homepage Endpoint:** `/api/homepage` combines dashboard stats, calendar jobs (month-spanning date range), and profiles into a single request. All 13 DB queries run in a flat `Promise.all` (no nested). Server-side cache (60s TTL, per-tenant+role). Frontend `useHomepageData()` hook fetches once and passes prefetched data to `ScheduleCalendar` via props, eliminating 3 separate API calls on dashboard load. Calendar falls back to its own `useListJobs` when navigating outside the prefetched date range.
- **Multi-tenancy:** All data tables include a `tenant_id` foreign key. Middleware (`requireTenant`) scopes all queries by the user's `tenant_id`. Super admins bypass tenant scoping.
- **File Storage:** Handles file uploads via `multer`, stores them in Supabase Storage buckets (`service-photos`, `service-documents`, `signatures`), and generates signed URLs for access. Server-side image compression and thumbnail generation are performed using `sharp`.
- **Data Validation:** Uses Zod schemas (generated from OpenAPI spec) for request and response validation.
- **Error Handling:** Centralized error handling middleware.
- **Invoice Export:** Backend logic for generating invoice data in various formats and protecting against CSV formula injection.
- **Plan Feature Gating:** `requirePlanFeature(featureName)` middleware gates API routes based on the tenant's subscription plan.

**Database (Supabase PostgreSQL):**
- **Schema:** Defined in `supabase/migration.sql`, with all data tables having `tenant_id NOT NULL`.
- **Row Level Security (RLS):** Implemented with tenant predicates for all data tables, ensuring data isolation. The API server uses a service role key to bypass RLS for backend operations but enforces authorization at the route handler level.
- **Foreign Key Ownership Validation:** Write routes validate that referenced foreign keys belong to the requesting user's tenant.
- **Drizzle ORM:** Schema definitions remain in `lib/db` for reference but the API server no longer imports from `@workspace/db`. All runtime queries use the Supabase client.

**Monorepo Structure:**
- **`artifacts/api-server`**: Express API server.
- **`artifacts/boiler-app`**: React + Vite frontend.
- **`lib/api-spec`**: OpenAPI spec and Orval codegen configuration.
- **`lib/api-client-react`**: Generated React Query hooks for frontend API calls.
- **`lib/api-zod`**: Generated Zod schemas for validation.
- **`lib/db`**: Drizzle ORM schema definitions (reference only; not imported at runtime by api-server).
- **`supabase/`**: Database migration and seed scripts.

**Feature Specifications:**
- **Gas vs Oil Differentiation:** Service record forms dynamically adjust sections based on the appliance's `fuel_type`, showing CP12-style forms for gas/LPG and traditional oil service forms for oil appliances.
- **Commissioning Records:** Available for `installation` job types, capturing gas supply, combustion readings, functional tests, and customer handover details.
- **Platform Admin:** Super_admin users can manage tenants, plans, announcements, and view audit logs through dedicated `/platform/*` routes.
- **Registration:** Supports multi-step company signup and invite-code registration.
- **Sole Trader / Company Lifecycle:** Tenants have a `company_type` field (`sole_trader` or `company`). Sole traders get simplified pricing and auto-assign jobs. Admins can upgrade to company mode (enabling team management, invite codes, job assignment) or downgrade back. Bulk job reassignment tool available at `/admin/reassign-jobs`. `can_be_assigned_jobs` flag on profiles controls who appears in technician dropdowns. `max_users` plan limit enforced on invite code creation/consumption. Migration: `supabase/patch-017-sole-trader-upgrade.sql`.
- **Callout Rate Tiers:** `callout_rates` table supports multiple callout fee tiers (weekday, weekend, after-hours, any day) with optional time windows. The system auto-resolves the correct rate based on the first time entry's day/time. Jobs can also have a manual `callout_rate_id` override. Admin UI in Company Settings. Migration: `supabase/patches/patch-020-callout-rates-products.sql`.
- **Product Catalogue:** `product_catalogue` table for pre-defined parts and materials. Searchable via `/api/products/search`. Technicians see a dropdown when adding parts to a job. Admin CRUD in Company Settings. Migration: same as above.
- **Invoice Export:** Supports CSV, QuickBooks IIF, Xero CSV, and Sage CSV formats for completed/invoiced jobs.
- **Plan Feature Gating:** Tiered plans (Forms Only, Starter, Professional, Enterprise) with a `features` JSONB column control access to various functionalities.
- **Email to Customer:** The "Email Customer" modal on job detail allows sending completed forms and/or photos as email attachments. Photos are fetched from Supabase storage and attached as binary attachments. Forms are rendered as PDF attachments. The email body dynamically adapts to show forms-only, photos-only, or mixed content.
- **Company Document URLs:** Company settings include optional `rates_url` and `trading_terms_url` fields. When populated, clickable "View Our Rates" and "View Our Trading Terms" buttons appear in all customer-facing emails (job confirmations and forms/photos emails).
- **Enquiry Photos:** Enquiry detail page supports photo uploads (standalone or attached to activity notes). Uses the existing Sharp compression/thumbnail pipeline. Multi-file upload via `/api/files/upload-multiple`. Photos linked to notes via optional `note_id` column on `file_attachments` (requires `patch-019-enquiry-photos.sql`).
- **Geo Mapping:** Properties have optional `latitude`/`longitude` columns. A `/api/geocode` endpoint (Nominatim by default, Mapbox if `GEOCODE_API_KEY` is set) converts addresses to coordinates. The jobs page has a Map/List tab toggle showing an interactive Leaflet/OpenStreetMap map with status-colored pins, navigation links, and a day-route view with polyline. Property edit/create forms include a "Lookup exact location" button with map preview. All geo features are gated behind the `geo_mapping` plan feature flag.

# External Dependencies

- **Supabase:**
    - **PostgreSQL Database:** Primary data store.
    - **Auth:** User authentication and management (email/password).
    - **Storage:** File storage for `service-photos`, `service-documents`, and `signatures` buckets.
- **Orval:** API codegen tool, used to generate client-side hooks and Zod schemas from an OpenAPI spec.
- **jsPDF:** Client-side PDF generation library.
- **react-signature-canvas:** React component for capturing digital signatures.
- **sharp:** Server-side image processing library for compression and thumbnail generation.
- **multer:** Node.js middleware for handling `multipart/form-data`, primarily for file uploads.
- **OpenAI (via Replit AI integrations):** Used for AI-generated post suggestions in the social media feature.
- **X (formerly Twitter), Facebook, Instagram:** Integrated for social media post dispatch.
- **Leaflet / react-leaflet:** Interactive map rendering with OpenStreetMap tiles for the geo mapping feature.
- **Nominatim / Mapbox:** Geocoding services for address-to-coordinate lookups (Nominatim free default, Mapbox via `GEOCODE_API_KEY`).