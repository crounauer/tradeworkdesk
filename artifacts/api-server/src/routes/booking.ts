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
import { sendBookingPendingApprovalEmail, sendJobConfirmationEmail, type EmailCompanyDetails, type JobConfirmationDetails } from "../lib/email";
import { notifyUsersForEvent } from "../lib/push-events";
import { geocodeAddress, getIdealPostcodesKey, idealPostcodesLookup } from "../lib/geocode";
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
const BUSINESS_TIMEZONE = "Europe/London";

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

function parseWeekdayIndex(value: string): number {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("sun")) return 0;
  if (normalized.startsWith("mon")) return 1;
  if (normalized.startsWith("tue")) return 2;
  if (normalized.startsWith("wed")) return 3;
  if (normalized.startsWith("thu")) return 4;
  if (normalized.startsWith("fri")) return 5;
  return 6;
}

function getLocalDateString(date: Date, timeZone = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Unable to format local date string");
  }
  return `${year}-${month}-${day}`;
}

function getLocalWeekdayIndex(date: Date, timeZone = BUSINESS_TIMEZONE): number {
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
  }).format(date);
  return parseWeekdayIndex(weekday);
}

function parseTimezoneOffsetMinutes(offsetLabel: string): number {
  if (offsetLabel === "GMT" || offsetLabel === "UTC") return 0;
  const match = offsetLabel.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * ((hours * 60) + minutes);
}

function getTimezoneOffsetMinutes(date: Date, timeZone = BUSINESS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const label = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  return parseTimezoneOffsetMinutes(label);
}

function parseHourMinute(value: string): { hour: number; minute: number } {
  const [hourRaw = "0", minuteRaw = "0"] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function localDateTimeToUtc(dateStr: string, timeStr: string, timeZone = BUSINESS_TIMEZONE): Date {
  const { hour, minute } = parseHourMinute(timeStr);
  const baselineUtc = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);
  const offset = getTimezoneOffsetMinutes(baselineUtc, timeZone);
  return new Date(baselineUtc.getTime() - (offset * 60000));
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
  propertyLatitude?: number | null;
  propertyLongitude?: number | null;
}): Promise<{ customerId: string; propertyId: string }> {
  const {
    tenantId,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    customerPostcode,
    propertyLatitude,
    propertyLongitude,
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

  if (!customerId && customerName.trim() && postcode) {
    const { firstName, lastName } = splitContactName(customerName);
    const { data: existingByNameAndPostcode } = await db.from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("first_name", firstName)
      .eq("last_name", lastName)
      .eq("postcode", postcode)
      .eq("is_active", true)
      .limit(1);
    customerId = (existingByNameAndPostcode?.[0] as { id: string } | undefined)?.id || null;
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
    .select("id, latitude, longitude")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .eq("address_line1", addressLine1)
    .eq("is_active", true)
    .limit(1);

  const existing = (existingProperty?.[0] as { id: string; latitude?: number | null; longitude?: number | null } | undefined) || null;
  let propertyId = existing?.id || null;
  if (propertyId && Number.isFinite(propertyLatitude ?? NaN) && Number.isFinite(propertyLongitude ?? NaN) && (!existing?.latitude || !existing?.longitude)) {
    await db.from("properties")
      .update({ latitude: propertyLatitude, longitude: propertyLongitude })
      .eq("id", propertyId)
      .eq("tenant_id", tenantId);
  }

  if (!propertyId) {
    const { data: createdProperty, error: propertyErr } = await db.from("properties").insert({
      tenant_id: tenantId,
      customer_id: customerId,
      address_line1: addressLine1,
      postcode,
      latitude: Number.isFinite(propertyLatitude ?? NaN) ? propertyLatitude : null,
      longitude: Number.isFinite(propertyLongitude ?? NaN) ? propertyLongitude : null,
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

function normalizePostcode(value: string | null | undefined): string {
  return (value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function calculateDistanceMiles(origin: { latitude: number; longitude: number }, target: { latitude: number; longitude: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(target.latitude - origin.latitude);
  const dLon = toRad(target.longitude - origin.longitude);
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(target.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function vetBookingCoverage(args: {
  tenantId: string;
  customerPostcode?: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  const { tenantId, customerPostcode } = args;

  const { data: company } = await db.from("company_settings")
    .select("postcode, coverage_radius_miles, service_area")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle() as { data: { postcode: string | null; coverage_radius_miles: number | null; service_area: string | null } | null };

  const radius = Number(company?.coverage_radius_miles ?? 0);
  if (!Number.isFinite(radius) || radius <= 0) {
    // Coverage radius not configured: allow booking flow unchanged.
    return { allowed: true };
  }

  const originPostcode = normalizePostcode(company?.postcode || "");
  if (!originPostcode) {
    return { allowed: false, reason: "Online booking radius check is enabled but business postcode is missing in Company Settings." };
  }

  const targetPostcode = normalizePostcode(customerPostcode);
  if (!targetPostcode) {
    return { allowed: false, reason: "Please enter a valid postcode so we can confirm your address is within our service area." };
  }

  const [origin, target] = await Promise.all([
    geocodeAddress(originPostcode),
    geocodeAddress(targetPostcode),
  ]);

  if (!origin || !target) {
    return { allowed: false, reason: "We could not verify this postcode right now. Please try again shortly." };
  }

  const distanceMiles = calculateDistanceMiles(origin, target);
  if (distanceMiles > radius) {
    return {
      allowed: false,
      reason: `This address is outside our service area (${distanceMiles.toFixed(1)} miles away, limit ${radius} miles).`,
    };
  }

  return { allowed: true };
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
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = getLocalWeekdayIndex(new Date(`${dateStr}T12:00:00.000Z`));

    // Check whole-day block override
    const wholeDayBlock = overrides.find(
      (o) => o.date === dateStr && !o.start_time && o.type === "blocked"
    );
    if (wholeDayBlock) continue;

    // Get working hours for this day
    const wh = workingHours.find((w) => w.day === dayOfWeek);
    if (!wh) continue;

    let slotStart = localDateTimeToUtc(dateStr, wh.start);
    const dayEnd = localDateTimeToUtc(dateStr, wh.end);

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
        const oStart = localDateTimeToUtc(dateStr, o.start_time);
        const oEnd = localDateTimeToUtc(dateStr, o.end_time || o.start_time);
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
        const jStart = localDateTimeToUtc(j.scheduled_date, j.scheduled_time).getTime() - buffer * 60000;
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

const BOOKING_GEO_TOKEN = "[BOOKING_GEO]";

function appendBookingGeoMetadata(
  notes: string | null | undefined,
  latitude?: number | null,
  longitude?: number | null,
): string | null {
  const base = (notes || "").trim();
  if (!Number.isFinite(latitude ?? NaN) || !Number.isFinite(longitude ?? NaN)) {
    return base || null;
  }
  const marker = `${BOOKING_GEO_TOKEN}${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  return [base, marker].filter(Boolean).join("\n");
}

function extractBookingGeoMetadata(notes: string | null | undefined): { latitude: number | null; longitude: number | null } {
  const raw = (notes || "").trim();
  const match = raw.match(/\[BOOKING_GEO\]([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/);
  if (!match) return { latitude: null, longitude: null };
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function stripBookingGeoMetadata(notes: string | null | undefined): string | null {
  const raw = (notes || "").trim();
  const cleaned = raw.replace(/\n?\[BOOKING_GEO\][^\n]+/g, "").trim();
  return cleaned || null;
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
  const { status, from, to, source, limit = "50" } = req.query as Record<string, string>;
  let q = db.from("bookings").select("*, booking_services(name, duration_minutes), service_catalogue(name, booking_duration_minutes)")
    .eq("tenant_id", req.tenantId)
    .order("scheduled_start", { ascending: false })
    .limit(parseInt(limit));
  if (status) q = q.eq("status", status);
  if (source) q = q.eq("source", source);
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

const convertBookingToJobHandler = (options?: { requireJobId?: boolean }) => async (req: AuthenticatedRequest, res: Response) => {
  const nowIso = new Date().toISOString();
  const requestedJobIdRaw = (req.body as { job_id?: unknown } | undefined)?.job_id;
  const requestedJobId = typeof requestedJobIdRaw === "string" && requestedJobIdRaw.trim()
    ? requestedJobIdRaw.trim()
    : null;

  if (options?.requireJobId && !requestedJobId) {
    return res.status(400).json({ error: "job_id is required to convert a booking" });
  }

  const bookingUpdatePayload: Record<string, unknown> = {
    status: "confirmed",
    confirmed_at: nowIso,
    confirmed_by: req.userId,
  };
  if (requestedJobId) bookingUpdatePayload.job_id = requestedJobId;

  const { data: booking, error } = await db.from("bookings")
    .update(bookingUpdatePayload)
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
    const pendingNotes = stripBookingGeoMetadata(bookingRecord.notes);
    const pendingDescription = buildOnlineBookingDescription(pendingNotes);
    let confirmationDescription = stripOnlineBookingDescriptionPrefix(pendingDescription);
    const geo = extractBookingGeoMetadata(bookingRecord.notes);

    if (!jobId) {
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
          description: [serviceLabel, pendingNotes].filter(Boolean).join("\n") || null,
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

    if (jobId) {
      try {
        const { customerId, propertyId } = await ensureBookingCustomerAndProperty({
          tenantId: req.tenantId!,
          customerName: bookingRecord.customer_name || "Customer",
          customerEmail: bookingRecord.customer_email || undefined,
          customerPhone: bookingRecord.customer_phone || undefined,
          customerAddress: bookingRecord.customer_address || undefined,
          customerPostcode: bookingRecord.customer_postcode || undefined,
          propertyLatitude: geo.latitude,
          propertyLongitude: geo.longitude,
        });

        await db.from("jobs").update({
          customer_id: customerId,
          property_id: propertyId,
        }).eq("id", jobId).eq("tenant_id", req.tenantId);
      } catch (linkErr) {
        console.error("[booking] confirm customer/property link failed:", linkErr);
      }
    }
  } catch (autoErr) {
    console.error("[booking] booking confirm processing failed:", autoErr);
  }

  res.json(booking);
};

router.post("/booking/bookings/:id/confirm", requireAuth, requireTenant, requireBooking(), convertBookingToJobHandler());
router.post("/booking/bookings/:id/convert-to-job", requireAuth, requireTenant, requireBooking(), convertBookingToJobHandler({ requireJobId: true }));

router.post("/booking/bookings/:id/cancel", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = (req.body ?? {}) as { reason?: string };
  const { data, error } = await db.from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason ?? null })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/booking/bookings/:id/cancel", requireAuth, requireTenant, requireBooking(), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = (req.body ?? {}) as { reason?: string };
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

publicRouter.post("/public/booking/:tenantId/coverage-check", bookingSlotsLimiter, async (req: Request, res: Response) => {
  const { customer_postcode } = req.body as { customer_postcode?: string };

  try {
    const coverageCheck = await vetBookingCoverage({
      tenantId: req.params.tenantId,
      customerPostcode: customer_postcode,
    });

    if (!coverageCheck.allowed) {
      return res.status(422).json({
        allowed: false,
        error: coverageCheck.reason || "This address is outside our service area.",
      });
    }

    return res.json({ allowed: true });
  } catch (err) {
    console.error("[booking] coverage-check failed:", err);
    return res.status(500).json({
      allowed: false,
      error: "Unable to verify service coverage right now. Please try again.",
    });
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

  const {
    customer_name,
    customer_email,
    customer_phone,
    scheduled_start,
    booking_service_id,
    service_catalogue_id,
    notes,
    customer_address,
    customer_postcode,
  } = req.body as Record<string, string>;
  const customerLatitudeRaw = Number((req.body as Record<string, unknown>).customer_latitude);
  const customerLongitudeRaw = Number((req.body as Record<string, unknown>).customer_longitude);
  const customerLatitude = Number.isFinite(customerLatitudeRaw) ? customerLatitudeRaw : null;
  const customerLongitude = Number.isFinite(customerLongitudeRaw) ? customerLongitudeRaw : null;
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

  const coverageCheck = await vetBookingCoverage({
    tenantId: req.params.tenantId,
    customerPostcode: customer_postcode,
  });
  if (!coverageCheck.allowed) {
    return res.status(422).json({ error: coverageCheck.reason || "This address is outside our service area." });
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
    const normalizedStartDate = new Date(normalizedScheduledStart);
    const bookingDate = getLocalDateString(normalizedStartDate);
    const dayOfWeek = getLocalWeekdayIndex(normalizedStartDate);
    const workingHours = Array.isArray((settings as { working_hours?: unknown[] }).working_hours)
      ? (settings as { working_hours: Array<{ day: number; start: string; end: string }> }).working_hours
      : [];
    const dayHours = workingHours.find((w) => Number(w.day) === dayOfWeek);
    if (!dayHours) {
      return res.status(409).json({ error: "Selected time is outside working hours. Please choose another slot." });
    }
    const workDayStart = localDateTimeToUtc(bookingDate, dayHours.start);
    const workDayEnd = localDateTimeToUtc(bookingDate, dayHours.end);
    if (Number.isNaN(workDayStart.getTime()) || Number.isNaN(workDayEnd.getTime())) {
      return res.status(500).json({ error: "Working hours configuration is invalid" });
    }
    if (normalizedStartDate < workDayStart || scheduledEnd > workDayEnd) {
      return res.status(409).json({ error: "Selected time exceeds working hours for this service duration. Please choose another slot." });
    }

    const bookingStatus = "pending";
    const storedNotes = appendBookingGeoMetadata(notes, customerLatitude, customerLongitude);
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
      notes: storedNotes,
      status: bookingStatus,
      source: "website",
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    const createdJobRef: string | null = null;

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
          description: buildOnlineBookingDescription(stripBookingGeoMetadata(storedNotes)) || "Subject to confirmation",
        };
        await sendBookingPendingApprovalEmail(
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
      body: `${customer_name} submitted an online booking for ${selectedService?.name || "a service"}. Review and confirm before conversion to job.`,
      url: "/booking/review",
      eventKey: `online_booking:${data.id}`,
      targetRoles: ["admin", "office_staff", "super_admin"],
      data: { bookingId: data.id },
    }).catch((err) => console.error("[push-events] online_booking failed:", err));

    void notifyUsersForEvent({
      tenantId: req.params.tenantId,
      eventType: "operational_exceptions",
      title: "Online Booking Received - TBC",
      body: `A new online booking from ${customer_name} requires tenant admin confirmation (TBC).`,
      url: "/booking/review",
      eventKey: `online_booking_tbc:${data.id}`,
      targetRoles: ["admin", "super_admin"],
      data: { bookingId: data.id },
    }).catch((err) => console.error("[push-events] online_booking_tbc failed:", err));

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
