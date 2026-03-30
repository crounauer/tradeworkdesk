# Overview

BoilerTech is a pnpm workspace monorepo using TypeScript, designed as a web application for managing boiler service technicians. Its primary purpose is to streamline the operations of boiler service companies by providing tools for job management, service record generation (including gas safety certificates and oil service records), breakdown reporting, commissioning records, and various other inspection forms. The platform aims to improve efficiency for technicians and office staff through features like multi-tenancy, role-based authorization, and client-side PDF generation for essential documents.

The project differentiates between gas and oil appliances, offering specific forms and checks based on the appliance's fuel type. It also includes a comprehensive platform administration section for managing tenants, plans, announcements, and audit logs, making it suitable for a SaaS model. A key ambition is to offer a robust and flexible solution for boiler service companies, ranging from small businesses to larger enterprises, with tiered feature gating based on subscription plans.

# User Preferences

I prefer iterative development and welcome questions for clarification. Please ask before making major architectural changes or decisions that might impact the overall system design or core functionalities.

# System Architecture

## Core Technologies

The project is built as a pnpm workspace monorepo using Node.js 24 and TypeScript 5.9. The frontend is developed with React, Vite, Tailwind CSS, and shadcn/ui, while the backend API uses Express 5.

## Data and API Management

- **Database**: Supabase PostgreSQL is used as the primary database, with Supabase Auth for user authentication (email/password).
- **API Definition**: OpenAPI specifications are used for API definition, with Orval generating API clients (React Query hooks) and Zod schemas for request/response validation.
- **File Storage**: Supabase Storage handles file uploads for service photos, documents, and signatures across three dedicated buckets. Signed URLs are generated for secure access.
- **ORM**: Drizzle ORM is used for database schema definitions in the backend.

## Authentication and Authorization

- **Authentication**: Supabase Auth handles user authentication. The frontend uses `@supabase/supabase-js`, and the API server verifies JWT tokens via `supabaseAdmin.auth.getUser()`.
- **Authorization**: Role-based authorization is implemented with roles (admin, office_staff, technician, super_admin) stored in the `profiles` table. Backend middleware enforces access control, including ownership checks for technicians to access only assigned jobs.
- **Row Level Security (RLS)**: PostgreSQL RLS policies with tenant predicates are applied to all data tables, scoping operations to the user's `tenant_id`. The API server uses a service role key to bypass RLS for backend operations but enforces authorization at the route handler level.

## Multi-tenancy

The system is designed for multi-tenancy, with all data tables including a `tenant_id NOT NULL` foreign key to the `tenants` table. Auth middleware extracts the tenant from the user profile, and all routes scope queries by `tenant_id`. A `requireTenant` middleware blocks requests without tenant context. `tenant_subscriptions` tracks plan subscriptions per tenant. Super_admin users can bypass tenant scoping for platform-level management.

## UI/UX and Feature Specifications

- **Frontend Framework**: React with Vite, styled using Tailwind CSS and shadcn/ui components.
- **Client-side PDF Generation**: `jsPDF` is used for client-side generation of Oil Service Records, CP12 Gas Safety Certificates, and Commissioning Record PDFs.
- **Signature Capture**: `react-signature-canvas` facilitates capturing customer and technician signatures.
- **Marketing Site**: Includes SEO-optimized landing pages, a blog, and legal pages, utilizing a `MarketingLayout` and `SEOHead` component with JSON-LD structured data.
- **Invoice Export**: Supports CSV, QuickBooks IIF, Xero CSV, and Sage CSV formats for completed/invoiced jobs.
- **Plan Feature Gating**: A tiered plan system (e.g., Forms Only, Starter, Professional, Enterprise) gates features based on a `features` JSONB column in the `plans` table. Backend middleware `requirePlanFeature()` and frontend `usePlanFeatures()` hook enforce access and display upgrade prompts.
- **Enquiry Tracking**: Record incoming enquiries from multiple sources (phone, email, text, Facebook, WhatsApp, Messenger, website, referral). Enquiries have statuses (new, contacted, quoted, converted, lost) and can be converted to jobs with customer/property creation. Feature-gated behind `job_management` plan feature. Includes activity notes timeline and dashboard widget for open enquiry count.
- **Platform Admin**: Super_admin users have access to `/platform/*` routes for managing tenants, plans, announcements, and audit logs, including a dashboard with MRR metrics.
- **Image Handling**: File uploads via multer with memory storage and a 10MB limit. Server-side image compression (max 1920px, JPEG quality 80) and 300px thumbnail generation using `sharp`.

## Specific Form Implementations

- **Gas vs. Oil Differentiation**: Service record forms dynamically adjust based on the appliance's `fuel_type`, showing specific sections for Gas/LPG (CP12, gas tightness, pressure readings, combustion extras) or Oil (smoke test, nozzle checks).
- **Commissioning Records**: Available for `installation` job types, capturing Gas Safe engineer ID, gas supply readings, combustion readings, functional tests, and customer handover details.
- **Social Media Integration**: An admin page allows for AI-generated post suggestions, image generation, bulk scheduling, and dispatch to platforms like X/Twitter and Facebook.

# External Dependencies

- **Supabase**:
  - **PostgreSQL**: Primary database.
  - **Auth**: User authentication and management.
  - **Storage**: File storage for service photos, documents, and signatures.
- **Orval**: API client and Zod schema generation from OpenAPI spec.
- **jsPDF**: Client-side PDF generation.
- **react-signature-canvas**: For capturing digital signatures.
- **sharp**: Server-side image processing (compression, resizing, thumbnail generation).
- **OpenAI**: Integrated via Replit AI integrations for AI-generated social media post suggestions.
- **QuickBooks IIF, Xero, Sage**: Supported formats for invoice export.
- **IndexNow**: API for submitting marketing URLs to search engines.
- **X/Twitter, Facebook, Instagram**: Platforms for social media post dispatch.