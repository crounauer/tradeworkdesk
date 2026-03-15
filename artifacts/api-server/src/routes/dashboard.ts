import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { GetDashboardResponse } from "@workspace/api-zod";

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

router.get("/dashboard", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const techFilter = req.userRole === "technician" ? req.userId : undefined;

  const buildJobQuery = () => {
    let q = supabaseAdmin
      .from("jobs")
      .select("*, customers(first_name, last_name), properties(address_line1), profiles(full_name)")
      .eq("is_active", true);
    if (techFilter) q = q.eq("assigned_technician_id", techFilter);
    return q;
  };

  const [todaysRes, upcomingRes, recentRes, followUpRes, overdueRes, statsRes] = await Promise.all([
    buildJobQuery().eq("scheduled_date", today).neq("status", "cancelled").order("scheduled_time").limit(20),
    buildJobQuery().gt("scheduled_date", today).lte("scheduled_date", weekAhead).eq("status", "scheduled").order("scheduled_date").limit(10),
    buildJobQuery().eq("status", "completed").order("updated_at", { ascending: false }).limit(5),
    buildJobQuery().eq("status", "requires_follow_up").order("scheduled_date").limit(10),
    supabaseAdmin
      .from("appliances")
      .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
      .eq("is_active", true)
      .not("next_service_due", "is", null)
      .lt("next_service_due", today)
      .order("next_service_due")
      .limit(10),
    Promise.all([
      supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
      buildJobQuery().eq("scheduled_date", today).neq("status", "cancelled"),
      supabaseAdmin.from("appliances").select("id", { count: "exact", head: true }).eq("is_active", true).not("next_service_due", "is", null).lt("next_service_due", today),
      (() => {
        let q = supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed").eq("is_active", true).gte("scheduled_date", weekAgo);
        if (techFilter) q = q.eq("assigned_technician_id", techFilter);
        return q;
      })(),
    ]),
  ]);

  const mapJob = (j: DashboardJobRow) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  });

  const mappedOverdue = (overdueRes.data as OverdueApplianceRow[] || []).map((a) => ({
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

  res.json(GetDashboardResponse.parse({
    todays_jobs: (todaysRes.data as DashboardJobRow[] || []).map(mapJob),
    upcoming_jobs: (upcomingRes.data as DashboardJobRow[] || []).map(mapJob),
    overdue_services: mappedOverdue,
    recent_completed: (recentRes.data as DashboardJobRow[] || []).map(mapJob),
    follow_up_required: (followUpRes.data as DashboardJobRow[] || []).map(mapJob),
    stats: {
      total_customers: statsRes[0].count || 0,
      total_jobs_today: (statsRes[1].data || []).length,
      overdue_count: statsRes[2].count || 0,
      completed_this_week: statsRes[3].count || 0,
    },
  }));
});

export default router;
