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

router.get("/reports/customer-portal", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("reports"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const tenantId = req.tenantId!;
  const now = new Date();
  const nowIso = now.toISOString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDayStart = new Date(startOfToday);
  thirtyDayStart.setDate(thirtyDayStart.getDate() - 29);
  const sevenDayStart = new Date(startOfToday);
  sevenDayStart.setDate(sevenDayStart.getDate() - 6);
  const thirtyDayStartIso = thirtyDayStart.toISOString();
  const sevenDayStartIso = sevenDayStart.toISOString();
  const todayKey = startOfToday.toISOString().slice(0, 10);
  const visibleInvoiceStatuses = ["sent", "paid", "overdue", "accepted", "declined", "converted"] as const;

  const [
    activeCustomersRes,
    portalUsersRes,
    pendingRequestsRes,
    invoicesRes,
    activityRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),

    supabaseAdmin
      .from("customer_portal_users")
      .select("id, customer_id, auth_user_id, is_active, invite_expires_at, created_at")
      .eq("tenant_id", tenantId),

    supabaseAdmin
      .from("customer_portal_access_requests")
      .select("id, status, requested_at")
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),

    supabaseAdmin
      .from("invoices")
      .select("id, customer_id, status")
      .eq("tenant_id", tenantId)
      .eq("type", "invoice"),

    supabaseAdmin
      .from("tenant_audit_log")
      .select("entity_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("event_type", "customer_portal_activity")
      .eq("actor_role", "customer_portal")
      .gte("created_at", thirtyDayStartIso),
  ]);

  if (activeCustomersRes.error || portalUsersRes.error || pendingRequestsRes.error || invoicesRes.error || activityRes.error) {
    const message = activeCustomersRes.error?.message
      || portalUsersRes.error?.message
      || pendingRequestsRes.error?.message
      || invoicesRes.error?.message
      || activityRes.error?.message
      || "Failed to load customer portal report";
    res.status(500).json({ error: message });
    return;
  }

  const totalCustomers = activeCustomersRes.count ?? 0;
  const portalUsers = (portalUsersRes.data || []) as Array<{
    id: string;
    customer_id: string;
    auth_user_id: string | null;
    is_active: boolean;
    invite_expires_at: string | null;
    created_at: string;
  }>;
  const pendingRequests = (pendingRequestsRes.data || []) as Array<{ id: string; requested_at: string }>;
  const invoices = (invoicesRes.data || []) as Array<{ id: string; customer_id: string | null; status: string | null }>;
  const activityRows = (activityRes.data || []) as Array<{ entity_id: string | null; created_at: string }>;

  const customersWithPortal = new Set<string>();
  const customersRegistered = new Set<string>();
  const customersEnabled = new Set<string>();
  const customersDisabled = new Set<string>();
  const customersInvitePending = new Set<string>();
  const customersInviteExpired = new Set<string>();
  const portalUserToCustomer = new Map<string, string>();
  const registeredEnabledPortalUserIds = new Set<string>();

  for (const row of portalUsers) {
    customersWithPortal.add(row.customer_id);
    portalUserToCustomer.set(row.id, row.customer_id);
    if (row.auth_user_id) customersRegistered.add(row.customer_id);
    if (row.is_active) customersEnabled.add(row.customer_id);
    else customersDisabled.add(row.customer_id);
    if (row.auth_user_id && row.is_active) registeredEnabledPortalUserIds.add(row.id);
    if (!row.auth_user_id) customersInvitePending.add(row.customer_id);
    if (!row.auth_user_id && row.invite_expires_at && row.invite_expires_at < nowIso) {
      customersInviteExpired.add(row.customer_id);
    }
  }

  const activePortalUsers30d = new Set<string>();
  const activePortalUsers7d = new Set<string>();
  const activePortalUsersToday = new Set<string>();
  for (const row of activityRows) {
    if (!row.entity_id) continue;
    activePortalUsers30d.add(row.entity_id);
    if (row.created_at >= sevenDayStartIso) activePortalUsers7d.add(row.entity_id);
    if (row.created_at.slice(0, 10) === todayKey) activePortalUsersToday.add(row.entity_id);
  }

  const activeCustomers30d = new Set<string>();
  const activeCustomers7d = new Set<string>();
  const activeCustomersToday = new Set<string>();
  for (const portalUserId of activePortalUsers30d) {
    const customerId = portalUserToCustomer.get(portalUserId);
    if (customerId) activeCustomers30d.add(customerId);
  }
  for (const portalUserId of activePortalUsers7d) {
    const customerId = portalUserToCustomer.get(portalUserId);
    if (customerId) activeCustomers7d.add(customerId);
  }
  for (const portalUserId of activePortalUsersToday) {
    const customerId = portalUserToCustomer.get(portalUserId);
    if (customerId) activeCustomersToday.add(customerId);
  }

  const invoicesByStatus = new Map<string, number>();
  let visibleInvoicesTotal = 0;
  let hiddenInvoicesTotal = 0;
  const customersWithVisibleInvoices = new Set<string>();
  const customersWithHiddenInvoices = new Set<string>();

  for (const row of invoices) {
    const status = row.status || "unknown";
    invoicesByStatus.set(status, (invoicesByStatus.get(status) || 0) + 1);

    const isVisible = visibleInvoiceStatuses.includes(status as (typeof visibleInvoiceStatuses)[number]);
    if (isVisible) {
      visibleInvoicesTotal += 1;
      if (row.customer_id) customersWithVisibleInvoices.add(row.customer_id);
    } else {
      hiddenInvoicesTotal += 1;
      if (row.customer_id) customersWithHiddenInvoices.add(row.customer_id);
    }
  }

  const registeredAndEnabled = [...customersRegistered].filter((customerId) => customersEnabled.has(customerId)).length;
  const activeRegisteredEnabled30d = [...activePortalUsers30d].filter((portalUserId) => registeredEnabledPortalUserIds.has(portalUserId)).length;
  const activeRegisteredEnabled7d = [...activePortalUsers7d].filter((portalUserId) => registeredEnabledPortalUserIds.has(portalUserId)).length;
  const base = totalCustomers > 0 ? totalCustomers : 1;
  const percentage = (count: number) => Number(((count / base) * 100).toFixed(1));
  const registeredEnabledBase = registeredAndEnabled > 0 ? registeredAndEnabled : 1;
  const activityPct = (count: number) => Number(((count / registeredEnabledBase) * 100).toFixed(1));

  res.json({
    kpis: {
      total_customers: totalCustomers,
      with_portal_access: customersWithPortal.size,
      registered: customersRegistered.size,
      registered_and_enabled: registeredAndEnabled,
      enabled: customersEnabled.size,
      disabled: customersDisabled.size,
      invite_pending: customersInvitePending.size,
      invite_expired: customersInviteExpired.size,
      pending_access_requests: pendingRequests.length,
      active_portal_users_today: activePortalUsersToday.size,
      active_portal_users_7d: activePortalUsers7d.size,
      active_portal_users_30d: activePortalUsers30d.size,
      active_customers_today: activeCustomersToday.size,
      active_customers_7d: activeCustomers7d.size,
      active_customers_30d: activeCustomers30d.size,
      visible_invoices_total: visibleInvoicesTotal,
      hidden_invoices_total: hiddenInvoicesTotal,
      customers_with_visible_invoices: customersWithVisibleInvoices.size,
      customers_with_hidden_invoices: customersWithHiddenInvoices.size,
    },
    rates: {
      portal_coverage_pct: percentage(customersWithPortal.size),
      registration_pct: percentage(customersRegistered.size),
      registered_and_enabled_pct: percentage(registeredAndEnabled),
      invite_pending_pct: percentage(customersInvitePending.size),
      invite_expired_pct: percentage(customersInviteExpired.size),
      active_30d_of_registered_enabled_pct: activityPct(activeRegisteredEnabled30d),
      active_7d_of_registered_enabled_pct: activityPct(activeRegisteredEnabled7d),
    },
    invoice_status_breakdown: Array.from(invoicesByStatus.entries())
      .map(([status, count]) => ({
        status,
        count,
        visible_in_portal: visibleInvoiceStatuses.includes(status as (typeof visibleInvoiceStatuses)[number]),
      }))
      .sort((a, b) => b.count - a.count),
    portal_visible_invoice_statuses: [...visibleInvoiceStatuses],
  });
});

export default router;
