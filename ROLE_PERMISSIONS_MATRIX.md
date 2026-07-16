# Role Permissions Matrix

Last updated: 2026-07-16

This matrix summarizes effective permissions for tenant roles in TradeWorkDesk, with emphasis on multi-engineer setups and booking/company configuration.

## Roles

- Technician
- Office Staff
- Admin
- Super Admin

## Company Setup / Admin Configuration

| Area | Technician | Office Staff | Admin | Super Admin |
|---|---|---|---|---|
| View company settings | Yes (read) | Yes | Yes | Yes |
| Edit company settings (`/api/admin/company-settings`) | No | No | Yes | Yes |
| Manage service catalogue (`/api/admin/service-catalogue`) | No | No | Yes | Yes |
| Manage admin users/invites | No | No (except where explicitly allowed in UI) | Yes | Yes |

Notes:
- Company settings write APIs are role-gated to Admin (Super Admin always allowed by middleware).
- Some pages may be reachable in UI, but API is the source of truth for enforcement.

## Booking (Internal Staff Endpoints)

| Endpoint Group | Technician | Office Staff | Admin | Super Admin |
|---|---|---|---|---|
| Booking settings (`GET/PUT /api/booking/settings`) | No | Yes | Yes | Yes |
| Booking services (`GET/POST/PATCH/DELETE /api/booking/services`) | No | Yes | Yes | Yes |
| Slot overrides (`POST/DELETE /api/booking/slot-overrides`) | No | Yes | Yes | Yes |
| Booking list/detail (`GET /api/booking/bookings*`) | No | Yes | Yes | Yes |
| Booking operations (`POST/PATCH/DELETE /api/booking/bookings*`, confirm/cancel/reopen/convert) | No | Yes | Yes | Yes |
| Staff slot lookup (`GET /api/booking/slots`) | Yes* | Yes | Yes | Yes |

\* `GET /api/booking/slots` remains authenticated+tenant+feature gated, and is read-only.

## Booking (Public Website Endpoints)

| Endpoint Group | Public User |
|---|---|
| Public bookable services (`GET /api/public/booking/:tenantId/services`) | Allowed |
| Public slot lookup (`GET /api/public/booking/:tenantId/slots`) | Allowed |
| Public booking submit (`POST /api/public/booking/:tenantId`) | Allowed (rate-limited) |

## Operational Data Visibility

| Data | Technician | Office Staff | Admin | Super Admin |
|---|---|---|---|---|
| Jobs list/details | Assigned jobs only | Tenant-wide | Tenant-wide | Tenant-wide / support mode |
| Dashboard/Homepage job feed | Assigned jobs only | Tenant-wide | Tenant-wide | Tenant-wide / support mode |
| Invoices APIs | No | Yes | Yes | Yes |

## Multi-Engineer Dashboard UX

For tenant admins/office staff, dashboard and schedule support all-engineer and per-engineer views.

- Home dashboard: team snapshot + scope filter + persisted engineer scope.
- Schedule: day/week engineer lanes and drag/drop assignment workflows.

## Source of Truth (Implementation)

- API role middleware: `artifacts/api-server/src/middlewares/auth.ts`
- Company settings routes: `artifacts/api-server/src/routes/admin.ts`
- Booking routes: `artifacts/api-server/src/routes/booking.ts`
- Job visibility checks: `artifacts/api-server/src/routes/jobs.ts`, `artifacts/api-server/src/lib/verify-job-access.ts`
- Dashboard/homepage filters: `artifacts/api-server/src/routes/dashboard.ts`, `artifacts/api-server/src/routes/homepage.ts`
