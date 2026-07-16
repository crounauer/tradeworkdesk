import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, getTenantFeatures, type AuthenticatedRequest } from "../middlewares/auth";
import { GetDashboardResponse } from "@workspace/api-zod";

const DASHBOARD_JOB_FIELDS = "id, customer_id, property_id, appliance_id, assigned_technician_id, job_type, job_type_id, service_catalogue_id, status, priority, scheduled_date, scheduled_end_date, scheduled_time, estimated_duration, description, notes, is_active, created_at, updated_at, customers(first_name, last_name), properties(address_line1), profiles(full_name)";

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

interface HomepageFollowUpRow {
  id: string;
  original_job_id: string;
  new_job_id: string | null;
  customer_id: string;
  property_id: string;
  status: string;
  expected_parts_date: string | null;
  created_at: string;
  customers?: { first_name: string; last_name: string } | null;
  properties?: { address_line1: string } | null;
  original_job?: { job_type: string; assigned_technician_id: string | null } | null;
}

const router: IRouter = Router();

// ── Caches ───────────────────────────────────────────────────────────────────
const homepageCache = new Map<string, { data: unknown; ts: number }>();
const storageCache  = new Map<string, { data: { used_bytes: number; file_count: number; signature_count: number }; ts: number }>();

const FRESH_TTL_MS   = 30_000;       // serve from cache with no background refresh
const STALE_TTL_MS   = 3 * 60_000;  // serve stale immediately + kick off background refresh
const STORAGE_TTL_MS = 10 * 60_000; // storage stats rarely change, use a longer TTL

/** Call this whenever jobs are created, updated, or deleted for a tenant. */
export function invalidateHomepageCache(tenantId?: string | null): void {
  if (tenantId) {
    for (const key of homepageCache.keys()) {
      if (key.startsWith(tenantId)) homepageCache.delete(key);
    }
  } else {
    homepageCache.clear();
  }
}

function cleanExpiredCache() {
  const now = Date.now();
  for (const [k, v] of homepageCache) {
    if (now - v.ts > STALE_TTL_MS) homepageCache.delete(k);
  }
  for (const [k, v] of storageCache) {
    if (now - v.ts > STORAGE_TTL_MS) storageCache.delete(k);
  }
}

interface FetchParams {
  tenantId: string | null | undefined;
  userId: string | undefined;
  userRole: string | undefined;
  cacheKey: string;
}

async function fetchAndCacheHomepageData(params: FetchParams): Promise<unknown> {
  const { tenantId, userId, userRole, cacheKey } = params;
  const t0 = Date.now();

  const today     = new Date().toISOString().split("T")[0];
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const techFilter = userRole === "technician" ? userId : undefined;

  const buildJobQuery = () => {
    let q = supabaseAdmin
      .from("jobs")
      .select(DASHBOARD_JOB_FIELDS)
      .eq("is_active", true);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const activeToday = `and(scheduled_date.eq.${today},scheduled_end_date.is.null),and(scheduled_date.lte.${today},scheduled_end_date.gte.${today})`;

  const buildApplianceQuery = () => {
    let q = supabaseAdmin.from("appliances")
      .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
      .eq("is_active", true);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    return q;
  };

  const buildCustomerCountQuery = () => {
    let q = supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    return q;
  };

  const buildCompletedCountQuery = () => {
    let q = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true })
      .eq("status", "completed").eq("is_active", true).gte("scheduled_date", weekAgo);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const buildTodayCountQuery = () => {
    let q = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const buildUnpaidInvoicesCountQuery = () => {
    let q = supabaseAdmin.from("invoices").select("id", { count: "exact", head: true })
      .in("status", ["sent", "overdue"])
      .eq("type", "invoice");
    if (tenantId) q = q.eq("tenant_id", tenantId);
    return q;
  };

  // ── Core queries (10 instead of 13 — storage is separate, overdue count derived from data) ──
  const [
    todaysRes, upcomingRes, recentRes, followUpRes, overdueRes,
    customerCountRes, todayCountRes, completedCountRes,
    tenantFeatures, unpaidInvoicesRes,
  ] = await Promise.all([
    buildJobQuery().or(activeToday).neq("status", "cancelled").order("scheduled_time").limit(20),
    buildJobQuery().gt("scheduled_date", today).lte("scheduled_date", weekAhead).eq("status", "scheduled").order("scheduled_date").limit(10),
    buildJobQuery().eq("status", "completed").order("updated_at", { ascending: false }).limit(5),
    (() => {
      let q = supabaseAdmin
        .from("follow_ups")
        .select("id, original_job_id, new_job_id, customer_id, property_id, status, expected_parts_date, created_at, customers(first_name, last_name), properties(address_line1), original_job:jobs!follow_ups_original_job_id_fkey(job_type, assigned_technician_id)")
        .in("status", ["awaiting_parts", "parts_arrived", "booked"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      return q;
    })(),
    buildApplianceQuery()
      .not("next_service_due", "is", null)
      .lt("next_service_due", today)
      .order("next_service_due")
      .limit(10),
    buildCustomerCountQuery(),
    buildTodayCountQuery().or(activeToday).neq("status", "cancelled"),
    buildCompletedCountQuery(),
    tenantId ? getTenantFeatures(tenantId) : Promise.resolve(null),
    buildUnpaidInvoicesCountQuery(),
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

  const mappedFollowUps = ((followUpRes.data || []) as unknown as HomepageFollowUpRow[])
    .filter((f) => !techFilter || f.original_job?.assigned_technician_id === techFilter)
    .map((f) => ({
      id: f.new_job_id || f.original_job_id,
      customer_id: f.customer_id,
      property_id: f.property_id,
      appliance_id: null,
      assigned_technician_id: f.original_job?.assigned_technician_id || null,
      status: f.status === "awaiting_parts" ? "awaiting_parts" : "requires_follow_up",
      job_type: f.original_job?.job_type || "follow_up",
      priority: "medium",
      scheduled_date: f.expected_parts_date || String(f.created_at).slice(0, 10),
      scheduled_time: null,
      estimated_duration: null,
      description: null,
      notes: null,
      is_active: true,
      created_at: f.created_at,
      updated_at: f.created_at,
      customer_name: f.customers ? `${f.customers.first_name} ${f.customers.last_name}` : null,
      property_address: f.properties?.address_line1 || null,
      technician_name: null,
    }));

  const overdueList = (overdueRes.data || []) as unknown as OverdueApplianceRow[];
  const mappedOverdue = overdueList.map((a) => ({
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
    todays_jobs: (todaysRes.data as unknown as DashboardJobRow[] || []).map(mapDashboardJob),
    upcoming_jobs: (upcomingRes.data as unknown as DashboardJobRow[] || []).map(mapDashboardJob),
    overdue_services: mappedOverdue,
    recent_completed: (recentRes.data as unknown as DashboardJobRow[] || []).map(mapDashboardJob),
    follow_up_required: mappedFollowUps,
    stats: {
      total_customers: customerCountRes.count || 0,
      total_jobs_today: todayCountRes.count || 0,
      overdue_count: overdueList.length,  // derived — no extra query needed
      completed_this_week: completedCountRes.count || 0,
      unpaid_invoices_count: unpaidInvoicesRes.count || 0,
    },
  });

  // ── Storage stats — served from a separate long-lived cache ──────────────
  let storage = storageCache.get(cacheKey)?.data;
  if (!storage) {
    try {
      const buildStorageUsageQuery = () => {
        let q = supabaseAdmin.from("file_attachments").select("file_size", { count: "exact" });
        if (tenantId) q = q.eq("tenant_id", tenantId).not("file_size", "is", null);
        return q;
      };
      const buildSignatureCountQuery = () => {
        let q = supabaseAdmin.from("signatures").select("id", { count: "exact", head: true });
        if (tenantId) q = q.eq("tenant_id", tenantId);
        return q;
      };
      const [storageRes, signatureCountRes] = await Promise.all([
        buildStorageUsageQuery(),
        buildSignatureCountQuery(),
      ]);
      const storageAgg = (storageRes.data ?? []) as { file_size: number }[];
      storage = {
        used_bytes: storageAgg.reduce((sum, row) => sum + (row.file_size || 0), 0),
        file_count: storageRes.count ?? 0,
        signature_count: signatureCountRes.count || 0,
      };
    } catch (error) {
      console.warn("[homepage] storage stats unavailable", error);
      storage = {
        used_bytes: 0,
        file_count: 0,
        signature_count: 0,
      };
    }
    storageCache.set(cacheKey, { data: storage, ts: Date.now() });
  }

  const responseBody = { dashboard, storage };

  homepageCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  if (homepageCache.size > 50) cleanExpiredCache();

  console.log(`[perf] /homepage total ${Date.now() - t0}ms (queries: ${tQueries - t0}ms)`);
  return responseBody;
}

router.get("/homepage", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const t0 = Date.now();
  const cacheKey = `${req.tenantId || "none"}:${req.userRole === "technician" ? req.userId : "all"}`;
  const cached = homepageCache.get(cacheKey);
  const age = cached ? Date.now() - cached.ts : Infinity;

  if (age < FRESH_TTL_MS) {
    // Fully fresh — serve immediately
    res.set("Cache-Control", "private, max-age=30");
    res.set("X-Cache", "HIT");
    res.json(cached!.data);
    console.log(`[perf] /homepage HIT (fresh ${Math.round(age / 1000)}s old) ${Date.now() - t0}ms`);
    return;
  }

  if (age < STALE_TTL_MS) {
    // Stale but usable — return immediately, refresh in background
    res.set("Cache-Control", "private, max-age=0, stale-while-revalidate=180");
    res.set("X-Cache", "STALE");
    res.json(cached!.data);
    console.log(`[perf] /homepage STALE (${Math.round(age / 1000)}s old) — bg refresh started ${Date.now() - t0}ms`);
    fetchAndCacheHomepageData({ tenantId: req.tenantId, userId: req.userId, userRole: req.userRole, cacheKey })
      .catch(e => console.warn("[homepage] background refresh error", e));
    return;
  }

  // Cache miss — sync fetch (user must wait, but this should be rare)
  try {
    const data = await fetchAndCacheHomepageData({ tenantId: req.tenantId, userId: req.userId, userRole: req.userRole, cacheKey });
    res.set("Cache-Control", "private, max-age=30");
    res.set("X-Cache", "MISS");
    res.json(data);
    console.log(`[perf] /homepage MISS total ${Date.now() - t0}ms`);
  } catch (e) {
    console.error("[homepage] fetch error", e);
    res.status(500).json({ error: "Failed to load homepage data" });
  }
});

export default router;
