import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import {
  GetUpcomingServicesResponse,
  GetOverdueServicesResponse,
  GetCompletedByTechnicianQueryParams,
  GetCompletedByTechnicianResponse,
} from "@workspace/api-zod";

interface ServiceReportRow {
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

interface CompletedJobRow {
  id: string;
  customer_id: string;
  property_id: string;
  status: string;
  job_type: string;
  scheduled_date: string;
  description: string | null;
  assigned_technician_id: string | null;
  customers?: { first_name: string; last_name: string } | null;
  properties?: { address_line1: string } | null;
  profiles?: { id: string; full_name: string } | null;
  [key: string]: unknown;
}

interface TechGroup {
  technician_id: string;
  technician_name: string;
  completed_count: number;
  jobs: Record<string, unknown>[];
}

const router: IRouter = Router();

router.get("/reports/upcoming-services", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("reports"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  let q = supabaseAdmin
    .from("appliances")
    .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
    .eq("is_active", true)
    .not("next_service_due", "is", null)
    .gte("next_service_due", today)
    .lte("next_service_due", thirtyDays)
    .order("next_service_due");

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = ((data || []) as unknown as ServiceReportRow[]).map((a) => ({
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

  res.json(GetUpcomingServicesResponse.parse(mapped));
});

router.get("/reports/overdue-services", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("reports"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  let q = supabaseAdmin
    .from("appliances")
    .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
    .eq("is_active", true)
    .not("next_service_due", "is", null)
    .lt("next_service_due", today)
    .order("next_service_due");

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = ((data || []) as unknown as ServiceReportRow[]).map((a) => ({
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

  res.json(GetOverdueServicesResponse.parse(mapped));
});

router.get("/reports/completed-by-technician", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("reports"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = GetCompletedByTechnicianQueryParams.safeParse(req.query);

  let q = supabaseAdmin
    .from("jobs")
    .select("*, customers(first_name, last_name), properties(address_line1), profiles!assigned_technician_id(id, full_name)")
    .eq("status", "completed")
    .eq("is_active", true)
    .not("assigned_technician_id", "is", null);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  if (query.success) {
    if (query.data.date_from) q = q.gte("scheduled_date", query.data.date_from);
    if (query.data.date_to) q = q.lte("scheduled_date", query.data.date_to);
  }

  const { data, error } = await q.order("scheduled_date", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }

  const grouped: Record<string, TechGroup> = {};
  for (const j of (data as CompletedJobRow[]) || []) {
    const tech = j.profiles;
    if (!tech) continue;
    const tid = tech.id;
    if (!grouped[tid]) {
      grouped[tid] = { technician_id: tid, technician_name: tech.full_name, completed_count: 0, jobs: [] };
    }
    grouped[tid].completed_count++;
    grouped[tid].jobs.push({
      ...j,
      customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
      property_address: j.properties?.address_line1 || null,
      technician_name: tech.full_name,
      customers: undefined,
      profiles: undefined,
      properties: undefined,
    });
  }

  res.json(GetCompletedByTechnicianResponse.parse(Object.values(grouped)));
});

// ─── GET /reports/overview ────────────────────────────────────────────────
// Single endpoint that runs all KPI queries in parallel for the dashboard overview
router.get("/reports/overview", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("reports"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const tenantId = req.tenantId!;
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Month boundaries
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  // Last 6 months: build array of { year, month, label, start, end }
  const months: { label: string; start: string; end: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    months.push({ label, start, end });
  }

  const [
    jobsThisMonthRes,
    jobsThisMonthByTypeRes,
    jobsThisMonthByStatusRes,
    paidInvoicesThisMonthRes,
    paidInvoicesByMethodThisMonthRes,
    outstandingInvoicesRes,
    activeCustomersRes,
    monthlyRevenueResults,
  ] = await Promise.all([
    // Total jobs this month
    supabaseAdmin.from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),

    // Jobs this month by type
    supabaseAdmin.from("jobs")
      .select("job_type")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),

    // Jobs this month by status
    supabaseAdmin.from("jobs")
      .select("status")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),

    // Revenue this month (paid invoices)
    supabaseAdmin.from("invoices")
      .select("total, paid_amount")
      .eq("tenant_id", tenantId)
      .eq("type", "invoice")
      .eq("status", "paid")
      .gte("issue_date", monthStart)
      .lte("issue_date", monthEnd),

    // Paid invoices this month grouped by method
    supabaseAdmin.from("invoices")
      .select("total, paid_amount, payment_method")
      .eq("tenant_id", tenantId)
      .eq("type", "invoice")
      .eq("status", "paid")
      .gte("payment_date", monthStart)
      .lte("payment_date", monthEnd),

    // Outstanding balance (sent + overdue)
    supabaseAdmin.from("invoices")
      .select("total")
      .eq("tenant_id", tenantId)
      .eq("type", "invoice")
      .in("status", ["sent", "overdue"]),

    // Active customers
    supabaseAdmin.from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),

    // Monthly revenue for last 6 months (one query per month — small enough)
    Promise.all(months.map(m =>
      supabaseAdmin.from("invoices")
        .select("total, paid_amount")
        .eq("tenant_id", tenantId)
        .eq("type", "invoice")
        .eq("status", "paid")
        .gte("issue_date", m.start)
        .lte("issue_date", m.end)
    )),
  ]);

  // Aggregate jobs by type
  const byType: Record<string, number> = {};
  for (const j of (jobsThisMonthByTypeRes.data || [])) {
    const t = (j as { job_type: string }).job_type || "unknown";
    byType[t] = (byType[t] || 0) + 1;
  }

  // Aggregate jobs by status
  const byStatus: Record<string, number> = {};
  for (const j of (jobsThisMonthByStatusRes.data || [])) {
    const s = (j as { status: string }).status || "unknown";
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  // Revenue this month
  const revenueThisMonth = (paidInvoicesThisMonthRes.data || []).reduce(
    (sum, inv) => sum + Number((inv as { paid_amount?: number | null; total: number }).paid_amount ?? (inv as { total: number }).total), 0
  );

  // Outstanding balance
  const outstandingBalance = (outstandingInvoicesRes.data || []).reduce(
    (sum, inv) => sum + Number((inv as { total: number }).total), 0
  );

  // Monthly revenue chart data
  const monthlyRevenue = months.map((m, i) => {
    const result = monthlyRevenueResults[i];
    const revenue = (result.data || []).reduce(
      (sum, inv) => sum + Number((inv as { paid_amount?: number | null; total: number }).paid_amount ?? (inv as { total: number }).total), 0
    );
    return { label: m.label, revenue };
  });

  const paymentMethodSummary = new Map<string, { method: string; count: number; amount: number }>();
  for (const inv of (paidInvoicesByMethodThisMonthRes.data || [])) {
    const row = inv as { payment_method?: string | null; paid_amount?: number | null; total: number };
    const method = row.payment_method || "unknown";
    const existing = paymentMethodSummary.get(method) || { method, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += Number(row.paid_amount ?? row.total);
    paymentMethodSummary.set(method, existing);
  }

  const paidByMethodThisMonth = Array.from(paymentMethodSummary.values()).sort((a, b) => b.amount - a.amount);

  res.json({
    kpis: {
      jobs_this_month: jobsThisMonthRes.count ?? 0,
      revenue_this_month: revenueThisMonth,
      outstanding_balance: outstandingBalance,
      active_customers: activeCustomersRes.count ?? 0,
    },
    jobs_by_type: Object.entries(byType).map(([type, count]) => ({ type, count })),
    jobs_by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    monthly_revenue: monthlyRevenue,
    paid_by_method_this_month: paidByMethodThisMonth,
  });
});

export default router;
