import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, getTenantFeatures, type AuthenticatedRequest } from "../middlewares/auth";

const CALENDAR_JOB_FIELDS =
  "id, customer_id, property_id, appliance_id, assigned_technician_id, job_type, job_type_id, status, priority, description, scheduled_date, scheduled_end_date, scheduled_time, estimated_duration, arrival_time, departure_time, created_at, updated_at, customers(first_name, last_name), properties(address_line1, latitude, longitude, postcode), profiles(full_name)";

const PROFILE_FIELDS =
  "id, email, full_name, role, phone, tenant_id, is_active, created_at, updated_at";

interface CalendarJobRow {
  id: string;
  customer_id: string;
  property_id: string;
  appliance_id: string | null;
  assigned_technician_id: string | null;
  job_type: string;
  job_type_id: number | null;
  status: string;
  priority: string;
  description: string | null;
  scheduled_date: string;
  scheduled_end_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  arrival_time: string | null;
  departure_time: string | null;
  created_at: string;
  updated_at: string;
  customers?: { first_name: string; last_name: string } | null;
  properties?: { address_line1: string; latitude?: number | null; longitude?: number | null; postcode?: string | null } | null;
  profiles?: { full_name: string } | null;
}

interface CalendarHolidayRow {
  id: string;
  tenant_id: string;
  technician_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  holiday_type: "technician_leave" | "public_holiday" | "bank_holiday";
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

const router: IRouter = Router();

const calendarCache = new Map<string, { data: unknown; ts: number }>();
const CALENDAR_CACHE_TTL_MS = 2 * 60_000; // 2 min — calendar changes more often

function cleanExpiredCalendarCache() {
  const now = Date.now();
  for (const [k, v] of calendarCache) {
    if (now - v.ts > CALENDAR_CACHE_TTL_MS) calendarCache.delete(k);
  }
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function nthWeekdayOfMonth(year: number, monthZeroBased: number, weekday: number, nth: number): Date {
  const first = new Date(Date.UTC(year, monthZeroBased, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + delta + (nth - 1) * 7;
  return new Date(Date.UTC(year, monthZeroBased, day));
}

function lastWeekdayOfMonth(year: number, monthZeroBased: number, weekday: number): Date {
  const lastDay = new Date(Date.UTC(year, monthZeroBased + 1, 0));
  const delta = (lastDay.getUTCDay() - weekday + 7) % 7;
  lastDay.setUTCDate(lastDay.getUTCDate() - delta);
  return lastDay;
}

function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function ukBankHolidaysForYear(year: number): Array<{ name: string; date: string }> {
  const easterSunday = calculateEasterSunday(year);
  const goodFriday = addDays(easterSunday, -2);
  const easterMonday = addDays(easterSunday, 1);

  const jan1 = new Date(Date.UTC(year, 0, 1));
  const christmas = new Date(Date.UTC(year, 11, 25));
  const boxing = new Date(Date.UTC(year, 11, 26));

  const observed = (d: Date): Date => {
    if (d.getUTCDay() === 6) return addDays(d, 2);
    if (d.getUTCDay() === 0) return addDays(d, 1);
    return d;
  };

  // UK substitute handling for Christmas / Boxing when weekends collide
  const christmasObserved = observed(christmas);
  let boxingObserved = observed(boxing);
  if (boxingObserved.getTime() === christmasObserved.getTime()) {
    boxingObserved = addDays(boxingObserved, 1);
  }

  return [
    { name: "New Year's Day", date: toDateOnly(observed(jan1)) },
    { name: "Good Friday", date: toDateOnly(goodFriday) },
    { name: "Easter Monday", date: toDateOnly(easterMonday) },
    { name: "Early May Bank Holiday", date: toDateOnly(nthWeekdayOfMonth(year, 4, 1, 1)) },
    { name: "Spring Bank Holiday", date: toDateOnly(lastWeekdayOfMonth(year, 4, 1)) },
    { name: "Summer Bank Holiday", date: toDateOnly(lastWeekdayOfMonth(year, 7, 1)) },
    { name: "Christmas Day", date: toDateOnly(christmasObserved) },
    { name: "Boxing Day", date: toDateOnly(boxingObserved) },
  ];
}

export function invalidateCalendarCache(tenantId?: string | null) {
  if (!tenantId) { calendarCache.clear(); return; }
  for (const key of calendarCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) calendarCache.delete(key);
  }
}

/**
 * GET /api/calendar
 * Returns jobs for the calendar view covering current month ± buffer.
 * Accepts optional ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD to override range.
 * Also returns all active profiles (for technician workload display).
 */
router.get("/calendar", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const techFilter = req.userRole === "technician" ? req.userId : undefined;

  // Compute default date range (same logic as homepage)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const calendarStart = new Date(monthStart);
  const msDayOfWeek = calendarStart.getDay();
  const msMondayOffset = msDayOfWeek === 0 ? -6 : 1 - msDayOfWeek;
  calendarStart.setDate(calendarStart.getDate() + msMondayOffset);
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + 7);

  const defaultFrom = calendarStart.toISOString().slice(0, 10);
  const defaultTo = calendarEnd.toISOString().slice(0, 10);

  const dateFrom = typeof req.query.date_from === "string" ? req.query.date_from : defaultFrom;
  const dateTo = typeof req.query.date_to === "string" ? req.query.date_to : defaultTo;

  const cacheKey = `${req.tenantId || "none"}:${techFilter || "all"}:${dateFrom}:${dateTo}`;
  const cached = calendarCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CALENDAR_CACHE_TTL_MS) {
    res.set("Cache-Control", "private, max-age=60");
    res.set("X-Cache", "HIT");
    res.json(cached.data);
    return;
  }

  let jobsQ = supabaseAdmin
    .from("jobs")
    .select(CALENDAR_JOB_FIELDS)
    .eq("is_active", true)
    .or(`scheduled_date.gte.${dateFrom},scheduled_end_date.gte.${dateFrom}`)
    .lte("scheduled_date", dateTo)
    .order("scheduled_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (req.tenantId) jobsQ = jobsQ.eq("tenant_id", req.tenantId);
  if (techFilter) jobsQ = jobsQ.eq("assigned_technician_id", techFilter);

  let profilesQ = supabaseAdmin
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("is_active", true)
    .order("full_name");
  if (req.tenantId) profilesQ = profilesQ.eq("tenant_id", req.tenantId);

  let jobTypesQ = req.tenantId
    ? supabaseAdmin.from("job_types").select("id, name").eq("tenant_id", req.tenantId)
    : supabaseAdmin.from("job_types").select("id, name");

  let holidaysQ = supabaseAdmin
    .from("calendar_holidays")
    .select("id, tenant_id, technician_id, name, start_date, end_date, holiday_type, notes, source, created_at, updated_at")
    .eq("tenant_id", req.tenantId)
    .lte("start_date", dateTo)
    .gte("end_date", dateFrom)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(300);

  if (techFilter) {
    holidaysQ = holidaysQ.or(`technician_id.is.null,technician_id.eq.${techFilter}`);
  }

  const [jobsRes, profilesRes, jobTypesRes, holidaysRes, tenantFeatures] = await Promise.all([
    jobsQ,
    profilesQ,
    jobTypesQ,
    holidaysQ,
    req.tenantId ? getTenantFeatures(req.tenantId) : Promise.resolve(null),
  ]);

  const hasGeoMapping = !!(tenantFeatures as Record<string, unknown> | null)?.geo_mapping;
  const typeMap = new Map(((jobTypesRes as { data?: Array<{ id: number; name: string }> }).data || []).map((t) => [t.id, t.name]));

  const jobs = ((jobsRes.data as CalendarJobRow[] || [])).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    job_type_name: j.job_type_id != null ? (typeMap.get(j.job_type_id) ?? null) : null,
    property_latitude: hasGeoMapping ? (j.properties?.latitude ?? null) : null,
    property_longitude: hasGeoMapping ? (j.properties?.longitude ?? null) : null,
    property_postcode: hasGeoMapping ? (j.properties?.postcode ?? null) : null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  }));

  const profileNameById = new Map(((profilesRes.data as Array<{ id: string; full_name: string }> | null) || []).map((p) => [p.id, p.full_name]));
  const holidays = ((holidaysRes.data as CalendarHolidayRow[] || [])).map((h) => ({
    ...h,
    technician_name: h.technician_id ? (profileNameById.get(h.technician_id) ?? null) : null,
  }));

  const responseBody = {
    jobs,
    holidays,
    profiles: profilesRes.data || [],
    date_range: { date_from: dateFrom, date_to: dateTo },
  };

  calendarCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  if (calendarCache.size > 50) cleanExpiredCalendarCache();

  res.set("Cache-Control", "private, max-age=60");
  res.set("X-Cache", "MISS");
  res.json(responseBody);
});

router.get("/calendar/holidays", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const techFilter = req.userRole === "technician" ? req.userId : undefined;
  const now = new Date();
  const defaultFrom = toDateOnly(new Date(Date.UTC(now.getFullYear(), 0, 1)));
  const defaultTo = toDateOnly(new Date(Date.UTC(now.getFullYear(), 11, 31)));

  const dateFrom = typeof req.query.date_from === "string" ? req.query.date_from : defaultFrom;
  const dateTo = typeof req.query.date_to === "string" ? req.query.date_to : defaultTo;

  let q = supabaseAdmin
    .from("calendar_holidays")
    .select("id, tenant_id, technician_id, name, start_date, end_date, holiday_type, notes, source, created_at, updated_at")
    .eq("tenant_id", req.tenantId)
    .lte("start_date", dateTo)
    .gte("end_date", dateFrom)
    .order("start_date", { ascending: true });

  if (techFilter) {
    q = q.or(`technician_id.is.null,technician_id.eq.${techFilter}`);
  }

  const { data, error } = await q;
  if (error) {
    res.status(500).json({ error: "Failed to load holidays" });
    return;
  }
  res.json(data || []);
});

router.post(
  "/calendar/holidays",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const {
      name,
      start_date,
      end_date,
      technician_id,
      holiday_type,
      notes,
    } = req.body as {
      name?: string;
      start_date?: string;
      end_date?: string;
      technician_id?: string | null;
      holiday_type?: "technician_leave" | "public_holiday" | "bank_holiday";
      notes?: string;
    };

    if (!name?.trim() || !start_date) {
      res.status(400).json({ error: "name and start_date are required" });
      return;
    }

    const type = holiday_type ?? (technician_id ? "technician_leave" : "public_holiday");
    const effectiveEnd = end_date || start_date;

    const { data, error } = await supabaseAdmin
      .from("calendar_holidays")
      .insert({
        tenant_id: req.tenantId,
        technician_id: technician_id || null,
        name: name.trim(),
        start_date,
        end_date: effectiveEnd,
        holiday_type: type,
        notes: notes?.trim() || null,
        source: "manual",
        created_by: req.userId || null,
      })
      .select("id, tenant_id, technician_id, name, start_date, end_date, holiday_type, notes, source, created_at, updated_at")
      .single();

    if (error || !data) {
      res.status(500).json({ error: "Failed to create holiday" });
      return;
    }

    invalidateCalendarCache(req.tenantId);
    res.status(201).json(data);
  },
);

router.post(
  "/calendar/holidays/import-bank",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const year = Number((req.body as { year?: number }).year || new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      res.status(400).json({ error: "year must be between 2020 and 2100" });
      return;
    }

    const holidays = ukBankHolidaysForYear(year);
    const rows = holidays.map((h) => ({
      tenant_id: req.tenantId,
      technician_id: null,
      name: h.name,
      start_date: h.date,
      end_date: h.date,
      holiday_type: "bank_holiday",
      notes: null,
      source: "uk_bank_holiday_import",
      created_by: req.userId || null,
    }));

    const { data, error } = await supabaseAdmin
      .from("calendar_holidays")
      .upsert(rows, { onConflict: "tenant_id,name,start_date,holiday_type" })
      .select("id, tenant_id, technician_id, name, start_date, end_date, holiday_type, notes, source, created_at, updated_at");

    if (error) {
      res.status(500).json({ error: "Failed to import bank holidays" });
      return;
    }

    invalidateCalendarCache(req.tenantId);
    res.json({ imported: data?.length ?? 0, holidays: data || [] });
  },
);

router.delete(
  "/calendar/holidays/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { error } = await supabaseAdmin
      .from("calendar_holidays")
      .delete()
      .eq("id", req.params.id)
      .eq("tenant_id", req.tenantId);

    if (error) {
      res.status(500).json({ error: "Failed to delete holiday" });
      return;
    }

    invalidateCalendarCache(req.tenantId);
    res.sendStatus(204);
  },
);

export default router;
