# Overview

BoilerTech is a pnpm workspace monorepo using TypeScript, designed to be a comprehensive web application for managing boiler service technicians. It aims to streamline operations for boiler service companies by providing tools for job management, technician scheduling, service record generation, and invoicing.

The project vision is to offer a robust, multi-tenant platform that caters to various business sizes in the boiler service industry, from small independent technicians to larger companies. Key capabilities include:

- **Job Management**: Scheduling, assigning, and tracking boiler service jobs.
- **Digital Forms**: Generating various service records (Gas Safety, Oil Service, Commissioning) in PDF format.
- **Customer and Appliance Management**: Maintaining detailed records of customers, properties, and appliances.
- **Invoicing & Reporting**: Generating invoices and various operational reports.
- **Platform Administration**: Tools for super-admins to manage tenants, plans, and system-wide announcements.
- **Social Media Integration**: AI-powered social media post suggestions and scheduling for marketing efforts.

BoilerTech seeks to be the go-to solution for efficient, paperless, and intelligent management of boiler service operations.

# User Preferences

I want iterative development and detailed explanations of changes. I prefer that you ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo**: pnpm workspaces for managing multiple packages.
- **Frontend**: React with Vite, Tailwind CSS, and shadcn/ui for a modern and responsive user interface.
- **Backend**: Express 5 for a robust and scalable API server.
- **TypeScript**: Used across the entire monorepo for type safety and improved developer experience.
- **Database Interaction**: Drizzle ORM for schema definitions and Supabase's PostgreSQL database.
- **API Generation**: Orval for generating API clients and Zod schemas from an OpenAPI specification, ensuring type-safe API interactions.
- **PDF Generation**: Client-side PDF generation using jsPDF for various service records.
- **Image Handling**: `sharp` for server-side image compression and thumbnail generation for file uploads.

## UI/UX Decisions
- **Design System**: Tailwind CSS and shadcn/ui provide a consistent and modern aesthetic.
- **Layouts**: Dedicated layouts for marketing pages and authenticated application pages.
- **SEO**: Marketing pages are SEO-optimized with structured data and a dedicated IndexNow integration.

## Feature Specifications
- **Gas vs. Oil Differentiation**: Service record forms dynamically adapt based on the appliance's fuel type, displaying specific sections for gas/LPG (CP12, gas tightness, pressure readings) or oil (smoke test, nozzle checks).
- **Commissioning Records**: Dedicated forms for `installation` job types to capture specific commissioning details, generating corresponding PDFs.
- **Invoice Export**: Supports various formats including CSV, QuickBooks IIF, Xero CSV, and Sage CSV for completed/invoiced jobs, with pricing configuration in company settings.
- **Plan Feature Gating**: A tiered system using `features` JSONB in plans to control access to specific functionalities (e.g., job management, invoicing, social media, specific form types). This is enforced via backend middleware and frontend conditional rendering.
- **Social Media Management**: Admin page for AI-generated post suggestions, image generation, bulk scheduling, and dispatch to platforms like X/Twitter, Facebook, Instagram.

## System Design Choices
- **Authentication**: Supabase Auth with email/password, JWT verification on the API server. Optional TOTP-based two-factor authentication (2FA) via Supabase MFA APIs — users can enroll/unenroll from the "My Account" page, and the login flow enforces MFA challenge when enabled. QR codes generated client-side using the `qrcode` library.
- **Authorization**: Role-based access control (admin, office_staff, technician, super_admin) enforced by backend middleware. Technicians have ownership checks to restrict access to their assigned jobs.
- **Multi-tenancy**: All data tables are scoped by `tenant_id`, ensuring data isolation. Super_admins can bypass tenant scoping. Registration includes a multi-step company signup and invite-code options.
- **Platform Admin**: Dedicated routes and pages for `super_admin` users to manage tenants, plans, announcements, and audit logs.
- **File Storage**: Supabase Storage with dedicated buckets for service photos, documents, and signatures. Files uploaded via `multer` and signed URLs for access.
- **Row Level Security (RLS)**: Database RLS policies with tenant predicates on all data tables, providing an additional layer of security. The API server uses a service role key but enforces authorization at the application level.
- **Foreign Key Ownership Validation**: Write operations validate that all referenced foreign keys belong to the requesting user's tenant.

# External Dependencies

- **Supabase**:
    - **PostgreSQL**: Primary database.
    - **Auth**: User authentication and management.
    - **Storage**: File storage for service photos, documents, and signatures.
- **OpenAI**: Integrated via Replit AI integrations for AI-generated social media post suggestions.
- **IndexNow API**: For submitting marketing page URLs to search engines.
- **X/Twitter, Facebook, Instagram APIs**: For social media post dispatch (conceptual integration for the social media feature).