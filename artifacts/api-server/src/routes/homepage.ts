import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, getTenantFeatures, type AuthenticatedRequest } from "../middlewares/auth";
import { GetDashboardResponse } from "@workspace/api-zod";

const DASHBOARD_JOB_FIELDS = "id, customer_id, property_id, appliance_id, assigned_technician_id, job_type, job_type_id, status, priority, scheduled_date, scheduled_end_date, scheduled_time, estimated_duration, description, notes, is_active, created_at, updated_at, customers(first_name, last_name), properties(address_line1), profiles(full_name)";

const CALENDAR_JOB_FIELDS = "id, customer_id, property_id, appliance_id, assigned_technician_id, job_type, job_type_id, status, priority, description, scheduled_date, scheduled_end_date, scheduled_time, estimated_duration, arrival_time, departure_time, created_at, updated_at, customers(first_name, last_name), properties(address_line1, latitude, longitude, postcode), profiles(full_name)";

const PROFILE_FIELDS = "id, email, full_name, role, phone, tenant_id, is_active, created_at, updated_at";

interface DashboardJobRow {
  id: string;
  customer_id: string;
  property_id: string;
  status: string;
  job_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  description: string | null;
  assigned_technician_id: string | null;
  customers?: { first_name: string; last_name: string } | null;
  properties?: { address_line1: string } | null;
  profiles?: { full_name: string } | null;
  [key: string]: unknown;
}

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

interface OverdueApplianceRow {
  id: string;
  manufacturer: string;
  model: string;
  serial_number: string | null;
  next_service_due: string;
  properties?: {
    id: string;
    address_line1: string;
    customer_id: string;
    customers?: { id: string; first_name: string; last_name: string } | null;
  } | null;
}

const router: IRouter = Router();

const homepageCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000;

function cleanExpiredCache() {
  const now = Date.now();
  for (const [k, v] of homepageCache) {
    if (now - v.ts > CACHE_TTL_MS) homepageCache.delete(k);
  }
}

router.get("/homepage", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const t0 = Date.now();
  const cacheKey = `${req.tenantId || "none"}:${req.userRole === "technician" ? req.userId : "all"}`;
  const cached = homepageCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.set("Cache-Control", "private, max-age=60");
    res.set("X-Cache", "HIT");
    res.json(cached.data);
    console.log(`[perf] /homepage cache HIT ${Date.now() - t0}ms`);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const calendarStart = new Date(monthStart);
  const msDayOfWeek = calendarStart.getDay();
  const msMondayOffset = msDayOfWeek === 0 ? -6 : 1 - msDayOfWeek;
  calendarStart.setDate(calendarStart.getDate() + msMondayOffset);
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + 7);

  const calDateFrom = calendarStart.toISOString().slice(0, 10);
  const calDateTo = calendarEnd.toISOString().slice(0, 10);

  const techFilter = req.userRole === "technician" ? req.userId : undefined;

  const buildJobQuery = () => {
    let q = supabaseAdmin
      .from("jobs")
      .select(DASHBOARD_JOB_FIELDS)
      .eq("is_active", true);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const activeToday = `and(scheduled_date.eq.${today},scheduled_end_date.is.null),and(scheduled_date.lte.${today},scheduled_end_date.gte.${today})`;

  const buildCalendarJobsQuery = () => {
    let q = supabaseAdmin
      .from("jobs")
      .select(CALENDAR_JOB_FIELDS)
      .eq("is_active", true)
      .or(`scheduled_date.gte.${calDateFrom},scheduled_end_date.gte.${calDateFrom}`)
      .lte("scheduled_date", calDateTo)
      .order("scheduled_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const buildProfilesQuery = () => {
    let q = supabaseAdmin
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("is_active", true)
      .order("full_name");
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    return q;
  };

  const buildApplianceQuery = () => {
    let q = supabaseAdmin.from("appliances")
      .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
      .eq("is_active", true);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    return q;
  };

  const buildCustomerCountQuery = () => {
    let q = supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    return q;
  };

  const buildCompletedCountQuery = () => {
    let q = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed").eq("is_active", true).gte("scheduled_date", weekAgo);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const buildTodayCountQuery = () => {
    let q = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const [
    todaysRes, upcomingRes, recentRes, followUpRes, overdueRes,
    customerCountRes, todayCountRes, overdueCountRes, completedCountRes,
    calendarJobsRes, profilesRes, tenantFeatures, jobTypesRes
  ] = await Promise.all([
    buildJobQuery().or(activeToday).neq("status", "cancelled").order("scheduled_time").limit(20),
    buildJobQuery().gt("scheduled_date", today).lte("scheduled_date", weekAhead).eq("status", "scheduled").order("scheduled_date").limit(10),
    buildJobQuery().eq("status", "completed").order("updated_at", { ascending: false }).limit(5),
    buildJobQuery().in("status", ["requires_follow_up", "awaiting_parts"]).order("scheduled_date").limit(10),
    buildApplianceQuery()
      .not("next_service_due", "is", null)
      .lt("next_service_due", today)
      .order("next_service_due")
      .limit(10),
    buildCustomerCountQuery(),
    buildTodayCountQuery().or(activeToday).neq("status", "cancelled"),
    buildApplianceQuery().not("next_service_due", "is", null).lt("next_service_due", today).select("id", { count: "exact", head: true }),
    buildCompletedCountQuery(),
    buildCalendarJobsQuery(),
    buildProfilesQuery(),
    req.tenantId ? getTenantFeatures(req.tenantId) : Promise.resolve(null),
    req.tenantId
      ? supabaseAdmin.from("job_types").select("id, name").eq("tenant_id", req.tenantId)
      : supabaseAdmin.from("job_types").select("id, name"),
  ]);

  const tQueries = Date.now();
  console.log(`[perf] /homepage queries ${tQueries - t0}ms`);

  const mapDashboardJob = (j: DashboardJobRow) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  });

  const mappedOverdue = ((overdueRes.data || []) as unknown as OverdueApplianceRow[]).map((a) => ({
    appliance_id: a.id,
    manufacturer: a.manufacturer,
    model: a.model,
    serial_number: a.serial_number,
    next_service_due: a.next_service_due,
    property_address: a.properties?.address_line1 || null,
    customer_name: a.properties?.customers ? `${a.properties.customers.first_name} ${a.properties.customers.last_name}` : null,
    customer_id: a.properties?.customers?.id || null,
    property_id: a.properties?.id || null,
  }));

  const dashboard = GetDashboardResponse.parse({
    todays_jobs: (todaysRes.data as DashboardJobRow[] || []).map(mapDashboardJob),
    upcoming_jobs: (upcomingRes.data as DashboardJobRow[] || []).map(mapDashboardJob),
    overdue_services: mappedOverdue,
    recent_completed: (recentRes.data as DashboardJobRow[] || []).map(mapDashboardJob),
    follow_up_required: (followUpRes.data as DashboardJobRow[] || []).map(mapDashboardJob),
    stats: {
      total_customers: customerCountRes.count || 0,
      total_jobs_today: todayCountRes.count || 0,
      overdue_count: overdueCountRes.count || 0,
      completed_this_week: completedCountRes.count || 0,
    },
  });

  const hasGeoMapping = !!(tenantFeatures as any)?.geo_mapping;

  const typeMap = new Map(((jobTypesRes as any)?.data || []).map((t: { id: number; name: string }) => [t.id, t.name]));

  const calendarJobs = ((calendarJobsRes.data as CalendarJobRow[] || []).map((j) => ({
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
  })));

  const profiles = profilesRes.data || [];

  const responseBody = {
    dashboard,
    calendar_jobs: {
      jobs: calendarJobs,
      pagination: { page: 1, limit: 500, total: calendarJobs.length, totalPages: 1 },
    },
    calendar_date_range: { date_from: calDateFrom, date_to: calDateTo },
    profiles,
  };

  homepageCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  if (homepageCache.size > 50) cleanExpiredCache();

  res.set("Cache-Control", "private, max-age=60");
  res.set("X-Cache", "MISS");
  res.json(responseBody);
  console.log(`[perf] /homepage total ${Date.now() - t0}ms (queries: ${tQueries - t0}ms, map+serialize: ${Date.now() - tQueries}ms)`);
});

export default router;
