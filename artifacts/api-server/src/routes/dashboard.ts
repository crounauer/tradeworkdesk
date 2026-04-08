import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { GetDashboardResponse } from "@workspace/api-zod";

const DASHBOARD_JOB_FIELDS = "id, customer_id, property_id, appliance_id, assigned_technician_id, job_type, job_type_id, status, priority, scheduled_date, scheduled_end_date, scheduled_time, estimated_duration, description, notes, is_active, created_at, updated_at, customers(first_name, last_name), properties(address_line1), profiles(full_name)";

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

const dashboardCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000;

router.get("/dashboard", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const t0 = Date.now();
  const cacheKey = `${req.tenantId || "none"}:${req.userRole === "technician" ? req.userId : "all"}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.set("Cache-Control", "private, max-age=60");
    res.set("X-Cache", "HIT");
    res.json(cached.data);
    return;
  }
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

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

  const buildApplianceQuery = () => {
    let q = supabaseAdmin.from("appliances")
      .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
      .eq("is_active", true);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    return q;
  };

  const activeToday = `and(scheduled_date.eq.${today},scheduled_end_date.is.null),and(scheduled_date.lte.${today},scheduled_end_date.gte.${today})`;

  const [
    todaysRes, upcomingRes, recentRes, followUpRes, overdueRes,
    customerCountRes, todayCountRes, overdueCountRes, completedCountRes
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
    supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true).eq("tenant_id", req.tenantId!),
    (() => {
      let q = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
      if (techFilter) q = q.eq("assigned_technician_id", techFilter);
      return q.or(activeToday).neq("status", "cancelled");
    })(),
    buildApplianceQuery().not("next_service_due", "is", null).lt("next_service_due", today).select("id", { count: "exact", head: true }),
    (() => {
      let q = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed").eq("is_active", true).gte("scheduled_date", weekAgo);
      if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
      if (techFilter) q = q.eq("assigned_technician_id", techFilter);
      return q;
    })(),
  ]);

  const tQueries = Date.now();

  const mapJob = (j: DashboardJobRow) => ({
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

  const responseBody = GetDashboardResponse.parse({
    todays_jobs: (todaysRes.data as DashboardJobRow[] || []).map(mapJob),
    upcoming_jobs: (upcomingRes.data as DashboardJobRow[] || []).map(mapJob),
    overdue_services: mappedOverdue,
    recent_completed: (recentRes.data as DashboardJobRow[] || []).map(mapJob),
    follow_up_required: (followUpRes.data as DashboardJobRow[] || []).map(mapJob),
    stats: {
      total_customers: customerCountRes.count || 0,
      total_jobs_today: todayCountRes.count || 0,
      overdue_count: overdueCountRes.count || 0,
      completed_this_week: completedCountRes.count || 0,
    },
  });
  dashboardCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  res.set("Cache-Control", "private, max-age=60");
  res.set("X-Cache", "MISS");
  res.json(responseBody);
  console.log(`[perf] /dashboard total ${Date.now() - t0}ms (queries: ${tQueries - t0}ms)`);
});

export default router;
