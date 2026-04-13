# Overview

BoilerTech is a pnpm workspace monorepo using TypeScript, designed as a web application for managing boiler service technicians. Its primary purpose is to streamline the operations of boiler service companies by providing tools for job management, technician scheduling, service record keeping, and customer interaction. The platform aims to serve as a comprehensive solution for managing gas and oil appliance services, installations, and various inspections. The business vision is to become the leading software solution for heating engineers, enabling them to operate more efficiently, ensure compliance, and enhance customer satisfaction.

Key capabilities include: differentiated service record forms, commissioning records, multi-tenant architecture with role-based authorization, client-side PDF generation, invoice export, pluggable accounting integrations, Google Calendar sync, social media integration, a platform administration panel, a public-facing marketing site, customer CSV import, configurable job number prefixes, and a customer login portal.

# User Preferences

I prefer concise and straightforward explanations. When implementing new features or making changes, please prioritize an iterative development approach, making small, testable changes. Before making any major architectural decisions or significant code overhauls, please ask for my approval. Ensure all database changes are clearly documented and, where applicable, provided as migration scripts.

# System Architecture

The BoilerTech application is built as a pnpm workspace monorepo.

**Frontend (boiler-app):**
- **Technology Stack:** React, Vite, Tailwind CSS, shadcn/ui.
- **UI/UX:** Modern, accessible design using `shadcn/ui` and Tailwind CSS. Includes a marketing site with SEO-optimized content and a blog.
- **Authentication:** Supabase client-side authentication.
- **Routing:** `wouter` for client-side routing with protected routes.
- **API Communication:** Generated React Query hooks for data fetching, with a fetch interceptor for Supabase JWTs. Critical initial data is prefetched.
- **PDF Generation:** Client-side generation of service records and certificates using `jsPDF`.
- **Signature Capture:** Digital signature collection via `react-signature-canvas`.
- **Invoice Export:** Frontend components for viewing and exporting invoices in multiple formats.
- **Plan Feature Gating:** Dynamically enables/disables UI elements based on the user's subscription plan.
- **Social Media:** Admin interface for managing, scheduling, and dispatching AI-generated social media posts.
- **Offline Support (PWA):** Full offline job creation, updates, notes, and status changes using IndexedDB mutation queue with Background Sync API (fallback polling for unsupported browsers). Recently viewed job details cached for offline access. Duplicate mutation deduplication, actionable sync error guidance, and auto-sync on reconnection.

**Backend (api-server):**
- **Technology Stack:** Express 5.
- **Authentication:** Verifies JWT tokens via `supabaseAdmin.auth.getUser()` with token caching.
- **Authorization:** Role-based access control and resource-level authorization.
- **Init/Homepage Endpoints:** Optimized single endpoints to fetch combined initial data and dashboard statistics with server-side caching.
- **Multi-tenancy:** All data is scoped by `tenant_id` with middleware enforcement. `requireTenant` also enforces tenant status — blocks API access for expired trials, suspended, and cancelled accounts (with 60s cached tenant status lookup). Exempt routes: `/me/init`, `/billing`, `/account`.
- **File Storage:** Handles file uploads to Supabase Storage, including server-side image compression and thumbnail generation with `sharp`.
- **Data Validation:** Uses Zod schemas for request and response validation.
- **Plan Feature Gating:** Middleware `requirePlanFeature()` gates API routes based on subscription plans.

**Database (Supabase PostgreSQL):**
- **Schema:** Defined in `supabase/migration.sql` with `tenant_id` in all data tables.
- **Row Level Security (RLS):** Implemented for data isolation.
- **Foreign Key Ownership Validation:** Ensures referenced foreign keys belong to the requesting user's tenant.
- **Drizzle ORM:** Schema definitions for reference; runtime queries use the Supabase client.

**Monorepo Structure:** Organizes frontend, backend, API specifications, generated client code, ORM schemas, and Supabase migrations.

**Feature Specifications:**
- **Dynamic Forms:** Service record forms adapt based on appliance fuel type (gas/oil). Commissioning records for installations.
- **Platform Admin:** Super_admin management of tenants, plans, announcements, and audit logs.
- **Registration:** Multi-step company signup and invite-code registration. Gated behind a beta invite code system during private beta.
- **Beta Invite System:** Super admins can generate, manage, and track beta invite codes from `/platform/beta-invites`. Codes support max uses, optional email locking, expiry dates, and batch generation. Registration requires a valid beta code. Invite consumption is atomic (race-condition safe).
- **Sole Trader / Company Lifecycle:** Supports switching between sole trader and company modes, affecting pricing, team management, and job assignment.
- **Callout Rate Tiers:** Configurable callout rates based on time windows, with auto-resolution and manual overrides.
- **Product Catalogue:** Searchable product catalogue for parts and materials.
- **Invoice Export:** Supports CSV, QuickBooks IIF, Xero CSV, and Sage CSV formats.
- **Plan Feature Gating:** Base plan plus selectable add-ons, with features derived from a union of plan and add-on capabilities. A "Free" plan (£0, 1 user, 5 jobs/month, job_management + scheduling only) exists as a permanent freemium tier. Trial period is 30 days. When a trial expires, users can subscribe to a paid plan or continue on the free tier via `POST /api/me/switch-to-free`.
- **Email to Customer:** Allows sending completed forms and photos as email attachments, with dynamic email content.
- **Company Document URLs:** Optional `rates_url` and `trading_terms_url` for customer-facing emails.
- **Customer Login Portal:** A separate frontend for customers to view their properties, appliances, service history, and download reports.
- **Enquiry Photos:** Photo uploads for enquiries with compression and thumbnail generation.
- **Geo Mapping:** Properties have optional `latitude`/`longitude`, with geocoding of addresses and an interactive map view for jobs.

# External Dependencies

- **Supabase:** PostgreSQL Database, Auth, and Storage.
- **Orval:** API codegen tool.
- **jsPDF:** Client-side PDF generation.
- **react-signature-canvas:** Digital signature capture.
- **sharp:** Server-side image processing.
- **multer:** File upload handling.
- **OpenAI:** AI-generated content suggestions (social media feature).
- **X (formerly Twitter), Facebook, Instagram:** Social media integrations.
- **Leaflet / react-leaflet:** Interactive map rendering.
- **Nominatim / Mapbox:** Geocoding services.