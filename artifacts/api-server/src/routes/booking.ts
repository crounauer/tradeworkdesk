/**
 * Online Booking API routes
 *
 * Authenticated (tenant staff):
 *   GET    /api/booking/settings             — get booking settings
 *   PUT    /api/booking/settings             — upsert booking settings
 *   GET    /api/booking/services             — list booking services
 *   POST   /api/booking/services             — create service
 *   PATCH  /api/booking/services/:id         — update service
 *   DELETE /api/booking/services/:id         — delete service
 *   GET    /api/booking/bookings             — list bookings (with filters)
 *   GET    /api/booking/bookings/:id         — get single booking
 *   POST   /api/booking/bookings             — create booking (manual / staff)
 *   PATCH  /api/booking/bookings/:id         — update booking
 *   POST   /api/booking/bookings/:id/confirm — confirm a pending booking
 *   POST   /api/booking/bookings/:id/cancel  — cancel a booking
 *   GET    /api/booking/slots                — available slots for a date range
 *   POST   /api/booking/slot-overrides       — block/unblock a date/time
 *   DELETE /api/booking/slot-overrides/:id   — remove override
 *
 * Public (no auth — called from website booking widget):
 *   GET    /api/public/booking/:tenantId/services   — list services
 *   GET    /api/public/booking/:tenantId/slots      — available slots
 *   POST   /api/public/booking/:tenantId            — submit a booking
 */

import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { createHash } from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { sendJobConfirmationEmail, type EmailCompanyDetails, type JobConfirmationDetails } from "../lib/email";
import { notifyUsersForEvent } from "../lib/push-events";
import { getIdealPostcodesKey, idealPostcodesLookup } from "../lib/geocode";
import { hasActiveAddon, getAddonCredits, deductAddonCredit } from "../lib/tenant-limits";
import {
  requireAuth,
  requireTenant,
  requirePlanFeature,
  type AuthenticatedRequest,
} from "../middlewares/auth";

const router: IRouter = Router();
const publicRouter: IRouter = Router();
const db = supabaseAdmin as any;

const bookingSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many booking attempts. Please wait a few minutes and try again." },
  keyGenerator: (req) => `booking-submit:${req.params.tenantId || "unknown"}:${req.ip || "unknown"}`,
});

const bookingSlotsLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many slot requests. Please slow down and try again." },
  keyGenerator: (req) => `booking-slots:${req.params.tenantId || "unknown"}:${req.ip || "unknown"}`,
});

const postcodeLookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many postcode lookups. Please wait a few minutes and try again." },
  keyGenerator: (req) => `booking-postcode:${req.params.tenantId || "unknown"}:${req.ip || "unknown"}`,
});

const idempotencyCache = new Map<string, { payloadHash: string; response: { id: string; status: string; scheduled_start: string }; createdAt: number }>();
const inFlightSlotLocks = new Set<string>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function cleanupPublicBookingCaches(): void {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [k, v] of idempotencyCache) {
    if (v.createdAt < cutoff) idempotencyCache.delete(k);
  }
}

function extractUtcDateAndTime(isoDateTime: string): { date: string; time: string } {
  const d = new Date(isoDateTime);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
}

function buildBookingPayloadHash(payload: {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  scheduled_start: string;
  selected_service_id: string;
  customer_address?: string;
  customer_postcode?: string;
}): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function splitContactName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] || "Customer", lastName: "Online" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function ensureBookingCustomerAndProperty(args: {
  tenantId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerPostcode?: string;
}): Promise<{ customerId: string; propertyId: string }> {
  const {
    tenantId,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    customerPostcode,
  } = args;

  const email = (customerEmail || "").trim().toLowerCase() || null;
  const phone = (customerPhone || "").trim() || null;
  const addressLine1 = (customerAddress || "").trim() || "Online Booking Address";
  const postcode = (customerPostcode || "").trim() || null;

  let customerId: string | null = null;
  if (email) {
    const { data: existingByEmail } = await db.from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .eq("is_active", true)
      .limit(1);
    customerId = (existingByEmail?.[0] as { id: string } | undefined)?.id || null;
  }

  if (!customerId && phone) {
    const { data: existingByPhone } = await db.from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phone", phone)
      .eq("is_active", true)
      .limit(1);
    customerId = (existingByPhone?.[0] as { id: string } | undefined)?.id || null;
  }

  if (!customerId) {
    const { firstName, lastName } = splitContactName(customerName);
    const { data: createdCustomer, error: customerErr } = await db.from("customers").insert({
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address_line1: addressLine1,
      postcode,
      is_active: true,
    }).select("id").single();
    if (customerErr || !createdCustomer?.id) {
      throw new Error(customerErr?.message || "Failed to create customer for booking");
    }
    customerId = createdCustomer.id as string;
  }

  const { data: existingProperty } = await db.from("properties")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .eq("address_line1", addressLine1)
    .eq("is_active", true)
    .limit(1);

  let propertyId = (existingProperty?.[0] as { id: string } | undefined)?.id || null;
  if (!propertyId) {
    const { data: createdProperty, error: propertyErr } = await db.from("properties").insert({
      tenant_id: tenantId,
      customer_id: customerId,
      address_line1: addressLine1,
      postcode,
      is_active: true,
    }).select("id").single();
    if (propertyErr || !createdProperty?.id) {
      throw new Error(propertyErr?.message || "Failed to create property for booking");
    }
    propertyId = createdProperty.id as string;
  }

  return { customerId, propertyId };
}

async function isRequestedSlotStillAvailable(args: {
  tenantId: string;
  scheduledStartIso: string;
  durationMinutes: number;
}): Promise<boolean> {
  const { tenantId, scheduledStartIso, durationMinutes } = args;
  const date = scheduledStartIso.slice(0, 10);
  const slots = await getAvailableSlots(tenantId, date, date, durationMinutes);
  return slots.some((slot) => slot.start === scheduledStartIso);
}

type BookableService = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number | null;
  price_type: "fixed" | "from" | "free" | "tbc";
  source: "catalogue" | "legacy";
};

type PublicAddressResult = {
  line_1: string;
  line_2: string;
  line_3: string;
  post_town: string;
  county: string;
  postcode: string;
  latitude: number;
  longitude: number;
  display: string;
};

function requireBooking() {
  return requirePlanFeature("job_management");  // booking is part of job management module
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate available slots for a date range given booking settings,
 * existing bookings, and slot overrides.
 */
async function getAvailableSlots(
  tenantId: string,
  fromDate: string,
  toDate: string,
  serviceDurationMinutes = 60
): Promise<{ start: string; end: string }[]> {
  const [settingsResult, bookingsResult, overridesResult, jobsResult] = await Promise.all([
    db.from("booking_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("bookings")
      .select("scheduled_start, scheduled_end")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_start", new Date(fromDate).toISOString())
      .lte("scheduled_start", new Date(toDate + "T23:59:59Z").toISOString()),
    db.from("booking_slot_overrides")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("date", fromDate)
      .lte("date", toDate),
    db.from("jobs")
      .select("scheduled_date, scheduled_time, estimated_duration, status")
      .eq("tenant_id", tenantId)
      .gte("scheduled_date", fromDate)
      .lte("scheduled_date", toDate)
      .not("scheduled_time", "is", null),
  ]);

  const settings = settingsResult.data;
  if (!settings || !settings.is_enabled) return [];

  const workingHours: { day: number; start: string; end: string }[] = settings.working_hours || [];
  const slotDuration: number = settings.slot_duration_minutes || 60;
  const buffer: number = settings.buffer_between_minutes || 15;
  const minAdvanceMs: number = (settings.min_advance_hours || 2) * 60 * 60 * 1000;
  const maxAdvanceDays: number = settings.max_advance_days || 60;

  const existingBookings: { scheduled_start: string; scheduled_end: string }[] = bookingsResult.data || [];
  const existingJobs: { scheduled_date: string; scheduled_time: string | null; estimated_duration: number | null; status: string | null }[] = jobsResult.data || [];
  const overrides: { date: string; start_time: string | null; end_time: string | null; type: string }[] = overridesResult.data || [];

  const slots: { start: string; end: string }[] = [];
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

  const start = new Date(fromDate);
  const end = new Date(toDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d > maxDate) break;
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split("T")[0];

    // Check whole-day block override
    const wholeDayBlock = overrides.find(
      (o) => o.date === dateStr && !o.start_time && o.type === "blocked"
    );
    if (wholeDayBlock) continue;

    // Get working hours for this day
    const wh = workingHours.find((w) => w.day === dayOfWeek);
    if (!wh) continue;

    const [startH, startM] = wh.start.split(":").map(Number);
    const [endH, endM] = wh.end.split(":").map(Number);

    let slotStart = new Date(d);
    slotStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(endH, endM, 0, 0);

    while (slotStart < dayEnd) {
      const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60000);
      if (slotEnd > dayEnd) break;

      // Check min advance
      if (slotStart.getTime() - now.getTime() < minAdvanceMs) {
        slotStart = new Date(slotStart.getTime() + slotDuration * 60000);
        continue;
      }

      // Check time-based block overrides
      const timeBlocked = overrides.some((o) => {
        if (o.date !== dateStr || o.type !== "blocked" || !o.start_time) return false;
        const oStart = new Date(`${dateStr}T${o.start_time}`);
        const oEnd = new Date(`${dateStr}T${o.end_time || o.start_time}`);
        return slotStart < oEnd && slotEnd > oStart;
      });
      if (timeBlocked) {
        slotStart = new Date(slotStart.getTime() + slotDuration * 60000);
        continue;
      }

      // Check existing bookings overlap (with buffer)
      const bookingConflict = existingBookings.some((b) => {
        const bStart = new Date(b.scheduled_start).getTime() - buffer * 60000;
        const bEnd = new Date(b.scheduled_end).getTime() + buffer * 60000;
        return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
      });

      // Also block slots that overlap scheduled jobs from the main calendar.
      const jobConflict = existingJobs.some((j) => {
        if (!j.scheduled_time) return false;
        const status = (j.status || "").toLowerCase();
        if (status === "cancelled" || status === "completed") return false;

        const durationMinutes = Number(j.estimated_duration || serviceDurationMinutes || slotDuration || 60);
        const jStart = new Date(`${j.scheduled_date}T${j.scheduled_time}`).getTime() - buffer * 60000;
        const jEnd = jStart + (durationMinutes + (buffer * 2)) * 60000;
        return slotStart.getTime() < jEnd && slotEnd.getTime() > jStart;
      });

      if (!bookingConflict && !jobConflict) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }

      slotStart = new Date(slotStart.getTime() + slotDuration * 60000);
    }
  }

  return slots;
}

function mapCatalogueService(row: {
  id: string;
  name: string;
  default_price: number | null;
  booking_duration_minutes: number | null;
}): BookableService {
  const price = row.default_price == null ? null : Number(row.default_price);
  return {
    id: row.id,
    name: row.name,
    duration_minutes: Number(row.booking_duration_minutes || 60),
    price,
    price_type: price == null ? "tbc" : (price === 0 ? "free" : "fixed"),
    source: "catalogue",
  };
}

async function resolveServiceForBooking(tenantId: string, serviceId: string): Promise<BookableService | null> {
  try {
    const { data: catalogue } = await db.from("service_catalogue")
      .select("id, name, default_price, booking_duration_minutes")
      .eq("tenant_id", tenantId)
      .eq("id", serviceId)
      .eq("is_active", true)
      .maybeSingle();
    if (catalogue) return mapCatalogueService(catalogue as { id: string; name: string; default_price: number | null; booking_duration_minutes: number | null; });
  } catch {
    // Fall back to legacy booking services if the catalogue booking fields are not yet available.
  }

  const { data: legacy } = await db.from("booking_services")
    .select("id, name, description, duration_minutes, price, price_type")
    .eq("tenant_id", tenantId)
    .eq("id", serviceId)
    .eq("is_active", true)
    .maybeSingle();
  if (!legacy) return null;
  return {
    ...(legacy as { id: string; name: string; description: string | null; duration_minutes: number; price: number | null; price_type: "fixed" | "from" | "free" | "tbc"; }),
    source: "legacy",
  };
}

async function getPublicBookableServices(tenantId: string): Promise<BookableService[]> {
  try {
    const { data: catalogue, error: catalogueError } = await db.from("service_catalogue")
      .select("id, name, default_price, booking_duration_minutes")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("online_booking_enabled", true)
      .order("name");

    if (catalogueError) throw catalogueError;
    if ((catalogue || []).length > 0) return (catalogue || []).map((row: any) => mapCatalogueService(row));
  } catch {
    // If the catalogue booking fields haven't been applied yet, fall through to legacy booking services.
  }

  const { data: legacy, error: legacyError } = await db.from("booking_services")
    .select("id, name, description, duration_minutes, price, price_type")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order").order("created_at");

  if (legacyError) throw new Error(legacyError.message);
  return ((legacy || []) as Array<{ id: string; name: string; description: string | null; duration_minutes: number; price: number | null; price_type: "fixed" | "from" | "free" | "tbc"; }>).map((row) => ({
    ...row,
    source: "legacy",
  }));
}

function buildOnlineBookingDescription(notes: string | null | undefined): string | null {
  const lines = ["Subject to confirmation"];
  if (notes && notes.trim()) lines.push(notes.trim());
  return lines.join("\n");
}

function stripOnlineBookingDescriptionPrefix(description: string | null | undefined): string | null {
  if (!description) return null;
  return description.replace(/^Subject to confirmation\n?/i, "").trim() || null;
}

async function loadBookingEmailCompanyDetails(tenantId: string): Promise<{ companyName: string; details: EmailCompanyDetails }> {
  const [{ data: companySettings }, { data: tenant }] = await Promise.all([
    db.from("company_settings")
      .select("name, trading_name, logo_url, address_line1, address_line2, city, county, postcode, phone, email, notification_emails, website, gas_safe_number, oftec_number, vat_number, rates_url, trading_terms_url")
      .eq("tenant_id", tenantId)
      .eq("singleton_id", "default")
      .maybeSingle(),
    db.from("tenants")
      .select("company_name")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  const cs = companySettings as Record<string, unknown> | null;
  const companyName = (cs?.name as string) || (cs?.trading_name as string) || (tenant?.company_name as string) || "Your Service Provider";

  return {
    companyName,
    details: {
      name: (cs?.name as string | null) || (tenant?.company_name as string | null) || null,
      trading_name: (cs?.trading_name as string | null) || null,
      logo_url: (cs?.logo_url as string | null) || null,
      address_line1: (cs?.address_line1 as string | null) || null,
      address_line2: (cs?.address_line2 as string | null) || null,
      city: (cs?.city as string | null) || null,
      county: (cs?.county as string | null) || null,
      postcode: (cs?.postcode as string | null) || null,
      phone: (cs?.phone as string | null) || null,
      email: (cs?.email as string | null) || null,
      notification_emails: (cs?.notification_emails as string[] | null) || null,
      website: (cs?.website as string | null) || null,
      gas_safe_number: (cs?.gas_safe_number as string | null) || null,
      oftec_number: (cs?.oftec_number as string | null) || null,
      vat_number: (cs?.vat_number as string | null) || null,
      rates_url: (cs?.rates_url as string | null) || null,
      trading_terms_url: (cs?.trading_terms_url as string | null) || null,
    },
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get("/booking/settings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_settings").select("*").eq("tenant_id", req.tenantId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? {});
});

router.put("/booking/settings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("booking_settings").upsert(
    { ...fields, tenant_id: req.tenantId },
    { onConflict: "tenant_id" }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Services ─────────────────────────────────────────────────────────────────

router.get("/booking/services", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_services").select("*")
    .eq("tenant_id", req.tenantId).order("sort_order").order("created_at");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post("/booking/services", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_services").insert(
    { ...req.body, tenant_id: req.tenantId }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/booking/services/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, ...fields } = req.body;
  const { data, error } = await db.from("booking_services")
    .update(fields).eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.delete("/booking/services/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await db.from("booking_services")
    .delete().eq("id", req.params.id).eq("tenant_id", req.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// ─── Bookings ─────────────────────────────────────────────────────────────────

router.get("/booking/bookings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { status, from, to, limit = "50" } = req.query as Record<string, string>;
  let q = db.from("bookings").select("*, booking_services(name, duration_minutes), service_catalogue(name, booking_duration_minutes)")
    .eq("tenant_id", req.tenantId)
    .order("scheduled_start", { ascending: false })
    .limit(parseInt(limit));
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("scheduled_start", new Date(from).toISOString());
  if (to) q = q.lte("scheduled_start", new Date(to + "T23:59:59Z").toISOString());
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get("/booking/bookings/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("bookings")
    .select("*, booking_services(name, duration_minutes, price), service_catalogue(name, booking_duration_minutes, default_price)")
    .eq("id", req.params.id).eq("tenant_id", req.tenantId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/booking/bookings", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("bookings").insert(
    { ...req.body, tenant_id: req.tenantId, source: "manual" }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/booking/bookings/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, ...fields } = req.body;
  const { data, error } = await db.from("bookings")
    .update(fields).eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/booking/bookings/:id/confirm", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const nowIso = new Date().toISOString();

  const { data: booking, error } = await db.from("bookings")
    .update({ status: "confirmed", confirmed_at: nowIso, confirmed_by: req.userId })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!booking) return res.status(404).json({ error: "Not found" });

  const bookingRecord = booking as {
    id: string;
    job_id?: string | null;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    customer_postcode: string | null;
    notes: string | null;
    scheduled_start: string;
  };

  try {
    const [{ data: settings }, serviceRes] = await Promise.all([
      db.from("booking_settings")
        .select("auto_create_job, default_job_type_id, confirmation_email_enabled")
        .eq("tenant_id", req.tenantId)
        .maybeSingle(),
      db.from("bookings")
        .select("booking_services(name, duration_minutes), service_catalogue(name, booking_duration_minutes)")
        .eq("id", req.params.id)
        .eq("tenant_id", req.tenantId)
        .maybeSingle(),
    ]);

    const serviceLabel = (serviceRes.data as { booking_services?: { name?: string | null } | null; service_catalogue?: { name?: string | null } | null } | null)?.service_catalogue?.name
      || (serviceRes.data as { booking_services?: { name?: string | null } | null; service_catalogue?: { name?: string | null } | null } | null)?.booking_services?.name
      || "Online Booking";

    let jobId = bookingRecord.job_id || null;
    let jobRef: string | null = null;
    const scheduledDate = bookingRecord.scheduled_start ? new Date(bookingRecord.scheduled_start).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const scheduledTime = bookingRecord.scheduled_start ? new Date(bookingRecord.scheduled_start).toTimeString().slice(0, 5) : null;
    const pendingDescription = buildOnlineBookingDescription(bookingRecord.notes);
    let confirmationDescription = stripOnlineBookingDescriptionPrefix(pendingDescription);

    if (!jobId && settings?.auto_create_job) {
      const { data: job } = await db.from("jobs").insert({
        tenant_id: req.tenantId,
        title: `${serviceLabel} — ${bookingRecord.customer_name || "Customer"}`,
        description: pendingDescription,
        notes: pendingDescription,
        status: "scheduled",
        job_type_id: settings.default_job_type_id || null,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        created_by: req.userId,
      }).select("id, job_ref").single();

      jobId = (job as { id?: string | null; job_ref?: string | null } | null)?.id || null;
      jobRef = (job as { id?: string | null; job_ref?: string | null } | null)?.job_ref || null;

      if (jobId) {
        await db.from("bookings").update({ job_id: jobId }).eq("id", req.params.id).eq("tenant_id", req.tenantId);

        const { data: enquiry } = await db.from("enquiries").insert({
          tenant_id: req.tenantId,
          contact_name: bookingRecord.customer_name,
          contact_email: bookingRecord.customer_email || null,
          contact_phone: bookingRecord.customer_phone || null,
          address: [bookingRecord.customer_address, bookingRecord.customer_postcode].filter(Boolean).join(", ") || null,
          source: "website",
          description: [serviceLabel, bookingRecord.notes].filter(Boolean).join("\n") || null,
          status: "converted",
          notes: `Auto-created from confirmed online booking (ID: ${req.params.id})`,
          linked_job_id: jobId,
        }).select("id").single();

        if (enquiry?.id) {
          await db.from("bookings").update({ enquiry_id: enquiry.id }).eq("id", req.params.id);
        }
      }
    } else if (jobId) {
      const { data: existingJob } = await db.from("jobs")
        .select("job_ref, scheduled_date, scheduled_time, description")
        .eq("id", jobId)
        .eq("tenant_id", req.tenantId)
        .maybeSingle();

      jobRef = (existingJob as { job_ref?: string | null } | null)?.job_ref || null;
      confirmationDescription = stripOnlineBookingDescriptionPrefix((existingJob as { description?: string | null } | null)?.description || pendingDescription);
    }

    if (settings?.confirmation_email_enabled !== false && bookingRecord.customer_email) {
      const { companyName, details } = await loadBookingEmailCompanyDetails(req.tenantId!);
      const confirmationDetails: JobConfirmationDetails = {
        jobRef: jobRef || `BOOK-${req.params.id.slice(0, 8).toUpperCase()}`,
        jobType: serviceLabel,
        scheduledDate,
        scheduledTime,
        propertyAddress: [bookingRecord.customer_address, bookingRecord.customer_postcode].filter(Boolean).join(", ") || "Customer address",
        description: confirmationDescription,
      };

      try {
        await sendJobConfirmationEmail(
          bookingRecord.customer_email,
          bookingRecord.customer_name || "Customer",
          companyName,
          confirmationDetails,
          details,
        );

        await db.from("bookings")
          .update({ confirmation_sent_at: nowIso })
          .eq("id", req.params.id)
          .eq("tenant_id", req.tenantId);
      } catch (mailErr) {
        console.error("[booking] confirmation email failed:", mailErr);
      }
    }
  } catch (autoErr) {
    console.error("[booking] booking confirm processing failed:", autoErr);
  }

  res.json(booking);
});

router.post("/booking/bookings/:id/cancel", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const { data, error } = await db.from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason ?? null })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/booking/bookings/:id/cancel", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const { data, error } = await db.from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason ?? null })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// ─── Slots ────────────────────────────────────────────────────────────────────

router.get("/booking/slots", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { from, to, service_id, service_catalogue_id, duration_minutes } = req.query as Record<string, string>;
  if (!from || !to) return res.status(400).json({ error: "from and to are required" });

  let duration = 60;
  const selectedServiceId = service_catalogue_id || service_id;
  if (selectedServiceId) {
    const svc = await resolveServiceForBooking(req.tenantId!, selectedServiceId);
    if (svc) duration = svc.duration_minutes;
    else if (duration_minutes) {
      const parsedDuration = Number(duration_minutes);
      if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
        duration = Math.round(parsedDuration);
      }
    }
  } else if (duration_minutes) {
    const parsedDuration = Number(duration_minutes);
    if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
      duration = Math.round(parsedDuration);
    }
  }

  const slots = await getAvailableSlots(req.tenantId!, from, to, duration);
  res.json(slots);
});

router.post("/booking/slot-overrides", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("booking_slot_overrides").insert(
    { ...req.body, tenant_id: req.tenantId }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete("/booking/slot-overrides/:id", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await db.from("booking_slot_overrides")
    .delete().eq("id", req.params.id).eq("tenant_id", req.tenantId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// ─── Public booking routes (no auth) ─────────────────────────────────────────

publicRouter.get("/public/booking/:tenantId/services", async (req: Request, res: Response) => {
  try {
    res.json(await getPublicBookableServices(req.params.tenantId));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

publicRouter.post("/public/booking/:tenantId/postcode-lookup", postcodeLookupLimiter, async (req: Request, res: Response) => {
  const { postcode } = req.body as { postcode?: string };
  if (!postcode || typeof postcode !== "string") {
    res.status(400).json({ error: "Postcode is required" });
    return;
  }

  const addonActive = await hasActiveAddon(req.params.tenantId, "uk_address_lookup");
  if (!addonActive) {
    res.status(402).json({ error: "UK Address Lookup add-on required. Contact your administrator to activate this feature." });
    return;
  }

  const creditInfo = await getAddonCredits(req.params.tenantId, "uk_address_lookup");
  if (creditInfo !== null && creditInfo.credits_remaining <= 0) {
    res.status(402).json({
      error: "No Address Lookup credits remaining. Purchase more credits on the Billing page.",
      credits_remaining: 0,
      bundle_size: creditInfo.bundle_size,
      bundle_price: creditInfo.bundle_price,
    });
    return;
  }

  try {
    const apiKey = await getIdealPostcodesKey();
    if (!apiKey) {
      res.status(404).json({ error: "Address lookup not configured" });
      return;
    }

    const addresses = await idealPostcodesLookup(postcode.trim(), apiKey);
    if (addresses.length === 0) {
      res.status(404).json({ error: "No addresses found for this postcode" });
      return;
    }

    const results = addresses.map((a) => ({
      line_1: a.line_1,
      line_2: a.line_2,
      line_3: a.line_3,
      post_town: a.post_town,
      county: a.county,
      postcode: a.postcode,
      latitude: a.latitude,
      longitude: a.longitude,
      display: [a.line_1, a.line_2, a.line_3].filter(Boolean).join(", "),
    }));

    res.json({
      addresses: results,
      credits_remaining: creditInfo ? creditInfo.credits_remaining - 1 : null,
      bundle_size: creditInfo?.bundle_size ?? null,
    });

    await deductAddonCredit(req.params.tenantId, "uk_address_lookup");
  } catch (err) {
    console.error("[booking] postcode lookup failed:", err);
    res.status(500).json({ error: "Postcode lookup failed" });
  }
});

publicRouter.get("/public/booking/:tenantId/slots", bookingSlotsLimiter, async (req: Request, res: Response) => {
  const { from, to, service_id, service_catalogue_id, duration_minutes } = req.query as Record<string, string>;
  if (!from || !to) return res.status(400).json({ error: "from and to are required" });

  let duration = 60;
  const selectedServiceId = service_catalogue_id || service_id;
  if (selectedServiceId) {
    const svc = await resolveServiceForBooking(req.params.tenantId, selectedServiceId);
    if (svc) duration = svc.duration_minutes;
    else if (duration_minutes) {
      const parsedDuration = Number(duration_minutes);
      if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
        duration = Math.round(parsedDuration);
      }
    }
  } else if (duration_minutes) {
    const parsedDuration = Number(duration_minutes);
    if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
      duration = Math.round(parsedDuration);
    }
  }

  const slots = await getAvailableSlots(req.params.tenantId, from, to, duration);
  res.json(slots);
});

publicRouter.post("/public/booking/:tenantId", bookingSubmitLimiter, async (req: Request, res: Response) => {
  cleanupPublicBookingCaches();

  // Validate settings exist and booking is enabled
  const { data: settings } = await db.from("booking_settings")
    .select("is_enabled, auto_confirm, auto_create_job, default_job_type_id, working_hours, confirmation_email_enabled").eq("tenant_id", req.params.tenantId).maybeSingle();
  if (!settings?.is_enabled) {
    return res.status(403).json({ error: "Online booking is not enabled" });
  }

  const { customer_name, customer_email, customer_phone, scheduled_start, booking_service_id, service_catalogue_id, notes, customer_address, customer_postcode } = req.body as Record<string, string>;
  if (!customer_name || !customer_email || !scheduled_start) {
    return res.status(400).json({ error: "customer_name, customer_email and scheduled_start are required" });
  }

  // Simple honeypot field for bots. Real clients should never send this.
  if (typeof (req.body as Record<string, unknown>)?.website_url === "string" && ((req.body as Record<string, unknown>).website_url as string).trim()) {
    return res.status(400).json({ error: "Invalid booking payload" });
  }

  const scheduledStart = new Date(scheduled_start);
  if (Number.isNaN(scheduledStart.getTime())) {
    return res.status(400).json({ error: "scheduled_start must be a valid ISO datetime" });
  }

  const selectedServiceId = service_catalogue_id || booking_service_id;
  if (!selectedServiceId) {
    return res.status(400).json({ error: "A valid service must be selected" });
  }

  // Calculate end time from service duration
  let duration = 60;
  const selectedService = selectedServiceId ? await resolveServiceForBooking(req.params.tenantId, selectedServiceId) : null;
  if (selectedService) {
    duration = selectedService.duration_minutes;
  } else if (selectedServiceId) {
    return res.status(400).json({ error: "Selected service is not available for online booking" });
  }

  const normalizedScheduledStart = scheduledStart.toISOString();
  const slotStillAvailable = await isRequestedSlotStillAvailable({
    tenantId: req.params.tenantId,
    scheduledStartIso: normalizedScheduledStart,
    durationMinutes: duration,
  });
  if (!slotStillAvailable) {
    return res.status(409).json({ error: "That slot is no longer available. Please choose another time." });
  }

  const lockKey = `${req.params.tenantId}:${selectedService.id}:${normalizedScheduledStart}`;
  if (inFlightSlotLocks.has(lockKey)) {
    return res.status(409).json({ error: "This slot is currently being booked. Please retry in a moment." });
  }
  inFlightSlotLocks.add(lockKey);

  try {
    const idempotencyKeyHeader = (req.header("x-idempotency-key") || req.header("X-Idempotency-Key") || "").trim();
    const idemKey = idempotencyKeyHeader ? `${req.params.tenantId}:${idempotencyKeyHeader}` : null;
    const payloadHash = buildBookingPayloadHash({
      customer_name,
      customer_email,
      customer_phone,
      scheduled_start: normalizedScheduledStart,
      selected_service_id: selectedServiceId,
      customer_address,
      customer_postcode,
    });

    if (idempotencyKeyHeader) {
      const existing = idempotencyCache.get(idemKey!);
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          return res.status(409).json({ error: "Idempotency key was already used with a different booking payload" });
        }
        return res.status(201).json(existing.response);
      }
    }

    const scheduledEnd = new Date(normalizedScheduledStart);
    scheduledEnd.setUTCMinutes(scheduledEnd.getUTCMinutes() + duration);

    // Hard guard: ensure selected slot stays inside configured working hours for that day.
    const bookingDate = normalizedScheduledStart.slice(0, 10);
    const dayOfWeek = new Date(`${bookingDate}T00:00:00.000Z`).getUTCDay();
    const workingHours = Array.isArray((settings as { working_hours?: unknown[] }).working_hours)
      ? (settings as { working_hours: Array<{ day: number; start: string; end: string }> }).working_hours
      : [];
    const dayHours = workingHours.find((w) => Number(w.day) === dayOfWeek);
    if (!dayHours) {
      return res.status(409).json({ error: "Selected time is outside working hours. Please choose another slot." });
    }
    const workDayStart = new Date(`${bookingDate}T${dayHours.start}:00.000Z`);
    const workDayEnd = new Date(`${bookingDate}T${dayHours.end}:00.000Z`);
    if (Number.isNaN(workDayStart.getTime()) || Number.isNaN(workDayEnd.getTime())) {
      return res.status(500).json({ error: "Working hours configuration is invalid" });
    }
    const normalizedStartDate = new Date(normalizedScheduledStart);
    if (normalizedStartDate < workDayStart || scheduledEnd > workDayEnd) {
      return res.status(409).json({ error: "Selected time exceeds working hours for this service duration. Please choose another slot." });
    }

    const bookingStatus = settings.auto_confirm ? "confirmed" : "pending";
    const { data, error } = await db.from("bookings").insert({
      tenant_id: req.params.tenantId,
      booking_service_id: selectedService?.source === "legacy" ? selectedService.id : null,
      service_catalogue_id: selectedService?.source === "catalogue" ? selectedService.id : null,
      scheduled_start: normalizedScheduledStart,
      scheduled_end: scheduledEnd.toISOString(),
      customer_name,
      customer_email,
      customer_phone: customer_phone || null,
      customer_address: customer_address || null,
      customer_postcode: customer_postcode || null,
      notes: notes || null,
      status: bookingStatus,
      source: "website",
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    let createdJobRef: string | null = null;
    if (settings.auto_create_job) {
      const utcSchedule = extractUtcDateAndTime(normalizedScheduledStart);
      const title = `${selectedService?.name || "Online Booking"} — ${customer_name}`;
      const description = buildOnlineBookingDescription(notes);

      const { customerId, propertyId } = await ensureBookingCustomerAndProperty({
        tenantId: req.params.tenantId,
        customerName: customer_name,
        customerEmail: customer_email,
        customerPhone: customer_phone,
        customerAddress: customer_address,
        customerPostcode: customer_postcode,
      });

      const { data: job, error: jobError } = await db.from("jobs").insert({
        tenant_id: req.params.tenantId,
        customer_id: customerId,
        property_id: propertyId,
        title,
        description,
        notes: description,
        status: "scheduled",
        job_type: "service",
        job_type_id: settings.default_job_type_id || null,
        priority: "medium",
        scheduled_date: utcSchedule.date,
        scheduled_time: utcSchedule.time,
        estimated_duration: duration,
        created_by: null,
      }).select("id, job_ref").single();

      if (jobError) {
        console.error("[booking] failed to create calendar job:", jobError.message);
        void notifyUsersForEvent({
          tenantId: req.params.tenantId,
          eventType: "operational_exceptions",
          title: "Online Booking Created Without Job",
          body: `Booking ${data.id} was created but calendar job creation failed: ${jobError.message}`,
          url: "/bookings",
          eventKey: `online_booking_job_create_failed:${data.id}`,
          targetRoles: ["admin", "office_staff"],
          data: { bookingId: data.id },
        }).catch((err) => console.error("[push-events] online_booking_job_create_failed failed:", err));
      } else if (job?.id) {
        createdJobRef = (job as { id?: string; job_ref?: string | null }).job_ref || null;
        await db.from("bookings").update({ job_id: job.id }).eq("id", data.id).eq("tenant_id", req.params.tenantId);
      }
    }

    if ((settings as { confirmation_email_enabled?: boolean }).confirmation_email_enabled !== false && customer_email) {
      try {
        const { companyName, details } = await loadBookingEmailCompanyDetails(req.params.tenantId);
        const utcSchedule = extractUtcDateAndTime(normalizedScheduledStart);
        const confirmationDetails: JobConfirmationDetails = {
          jobRef: createdJobRef || `BOOK-${String(data.id).slice(0, 8).toUpperCase()}`,
          jobType: selectedService?.name || "Online Booking",
          scheduledDate: utcSchedule.date,
          scheduledTime: utcSchedule.time,
          propertyAddress: [customer_address, customer_postcode].filter(Boolean).join(", ") || "Customer address",
          description: settings.auto_confirm
            ? (notes || null)
            : (buildOnlineBookingDescription(notes) || "Subject to confirmation"),
        };
        await sendJobConfirmationEmail(
          customer_email,
          customer_name || "Customer",
          companyName,
          confirmationDetails,
          details,
        );

        await db.from("bookings")
          .update({ confirmation_sent_at: new Date().toISOString() })
          .eq("id", data.id)
          .eq("tenant_id", req.params.tenantId);
      } catch (mailErr) {
        console.error("[booking] submit confirmation email failed:", mailErr);
      }
    }

    void notifyUsersForEvent({
      tenantId: req.params.tenantId,
      eventType: "customer_communications",
      title: "New Online Booking",
      body: `${customer_name} submitted an online booking for ${selectedService?.name || "a service"}.`,
      url: "/bookings",
      eventKey: `online_booking:${data.id}`,
      targetRoles: ["admin", "office_staff", "super_admin"],
      data: { bookingId: data.id },
    }).catch((err) => console.error("[push-events] online_booking failed:", err));

    const responseBody = { id: data.id, status: data.status, scheduled_start: data.scheduled_start };
    if (idemKey) {
      idempotencyCache.set(idemKey, { payloadHash, response: responseBody, createdAt: Date.now() });
    }

    res.status(201).json(responseBody);
  } finally {
    inFlightSlotLocks.delete(lockKey);
  }
});

export { router as bookingRouter, publicRouter as bookingPublicRouter };
