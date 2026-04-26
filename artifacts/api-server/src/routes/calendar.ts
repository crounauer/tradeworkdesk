import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, getTenantFeatures, type AuthenticatedRequest } from "../middlewares/auth";

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

const router: IRouter = Router();

const calendarCache = new Map<string, { data: unknown; ts: number }>();
const CALENDAR_CACHE_TTL_MS = 2 * 60_000; // 2 min — calendar changes more often

function cleanExpiredCalendarCache() {
  const now = Date.now();
  for (const [k, v] of calendarCache) {
    if (now - v.ts > CALENDAR_CACHE_TTL_MS) calendarCache.delete(k);
  }
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

  const [jobsRes, profilesRes, jobTypesRes, tenantFeatures] = await Promise.all([
    jobsQ,
    profilesQ,
    jobTypesQ,
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

  const responseBody = {
    jobs,
    profiles: profilesRes.data || [],
    date_range: { date_from: dateFrom, date_to: dateTo },
  };

  calendarCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  if (calendarCache.size > 50) cleanExpiredCalendarCache();

  res.set("Cache-Control", "private, max-age=60");
  res.set("X-Cache", "MISS");
  res.json(responseBody);
});

export default router;
