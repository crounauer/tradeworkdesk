import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/platform/stats", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const [tenantsRes, usersRes, activeTenantsRes, trialTenantsRes, plansRes] = await Promise.all([
    supabaseAdmin.from("tenants").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("tenants").select("id", { count: "exact", head: true }).eq("status", "trial"),
    supabaseAdmin.from("plans").select("id, name, monthly_price").eq("is_active", true).order("sort_order"),
  ]);

  res.json({
    total_tenants: tenantsRes.count || 0,
    total_users: usersRes.count || 0,
    active_tenants: activeTenantsRes.count || 0,
    trial_tenants: trialTenantsRes.count || 0,
    plans: plansRes.data || [],
  });
});

router.get("/platform/tenants", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { status, search } = req.query as { status?: string; search?: string };

  let q = supabaseAdmin.from("tenants").select("*, plans(name)").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (search) {
    const s = `%${search}%`;
    q = q.or(`company_name.ilike.${s},contact_email.ilike.${s},contact_name.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const enriched = await Promise.all((data || []).map(async (t: Record<string, unknown>) => {
    const { count } = await supabaseAdmin
      .from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t.id);
    return { ...t, user_count: count || 0, plan_name: (t.plans as { name: string } | null)?.name || null, plans: undefined };
  }));

  res.json(enriched);
});

router.get("/platform/tenants/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  const { data: tenant, error } = await supabaseAdmin
    .from("tenants").select("*, plans(*)").eq("id", id).single();
  if (error || !tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const [usersRes, jobsRes, customersRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, email, full_name, role, created_at").eq("tenant_id", id).order("created_at"),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", id).eq("is_active", true),
  ]);

  res.json({
    ...tenant,
    users: usersRes.data || [],
    job_count: jobsRes.count || 0,
    customer_count: customersRes.count || 0,
  });
});

router.patch("/platform/tenants/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const allowed = [
    "company_name", "contact_name", "contact_email", "contact_phone",
    "status", "plan_id", "trial_ends_at", "notes",
    "stripe_customer_id", "stripe_subscription_id",
    "subscription_started_at", "subscription_renewal_at",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key] ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("tenants").update(updates).eq("id", id).select().single();
  if (error || !data) { res.status(404).json({ error: "Tenant not found" }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "tenant_updated",
    entity_type: "tenant",
    entity_id: id,
    detail: updates,
  });

  res.json(data);
});

router.get("/platform/plans/public", async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("plans").select("id, name, description, monthly_price, annual_price, max_users, max_jobs_per_month")
    .eq("is_active", true).order("sort_order");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get("/platform/plans", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("plans").select("*").order("sort_order");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/platform/plans", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, description, monthly_price, annual_price, max_users, max_jobs_per_month, features, stripe_price_id, stripe_price_id_annual } = req.body;
  if (!name) { res.status(400).json({ error: "Plan name is required" }); return; }

  const { count } = await supabaseAdmin.from("plans").select("id", { count: "exact", head: true });

  const { data, error } = await supabaseAdmin.from("plans").insert({
    name,
    description: description || null,
    monthly_price: monthly_price || 0,
    annual_price: annual_price || 0,
    max_users: max_users || 5,
    max_jobs_per_month: max_jobs_per_month || 100,
    features: features || {},
    sort_order: (count || 0) + 1,
    stripe_price_id: stripe_price_id || null,
    stripe_price_id_annual: stripe_price_id_annual || null,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "plan_created",
    entity_type: "plan",
    entity_id: data.id,
    detail: { name },
  });

  res.status(201).json(data);
});

router.patch("/platform/plans/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const allowed = ["name", "description", "monthly_price", "annual_price", "max_users", "max_jobs_per_month", "features", "is_active", "sort_order", "stripe_price_id", "stripe_price_id_annual"];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("plans").update(updates).eq("id", id).select().single();
  if (error || !data) { res.status(404).json({ error: "Plan not found" }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "plan_updated",
    entity_type: "plan",
    entity_id: id,
    detail: updates,
  });

  res.json(data);
});

router.delete("/platform/plans/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  const { count } = await supabaseAdmin
    .from("tenants").select("id", { count: "exact", head: true }).eq("plan_id", id);
  if (count && count > 0) {
    res.status(409).json({ error: `Cannot delete plan: ${count} tenant(s) are currently using it.` });
    return;
  }

  const { error } = await supabaseAdmin.from("plans").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "plan_deleted",
    entity_type: "plan",
    entity_id: id,
    detail: {},
  });

  res.sendStatus(204);
});

router.get("/platform/announcements", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("platform_announcements").select("*").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get("/platform/announcements/active", requireAuth, async (_req, res): Promise<void> => {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("platform_announcements")
    .select("*")
    .eq("is_active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("severity", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/platform/announcements", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { title, body, severity, starts_at, ends_at } = req.body;
  if (!title || !body) { res.status(400).json({ error: "Title and body are required" }); return; }

  const { data, error } = await supabaseAdmin.from("platform_announcements").insert({
    title,
    body,
    severity: severity || "info",
    starts_at: starts_at || new Date().toISOString(),
    ends_at: ends_at || null,
    created_by: req.userId,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/platform/announcements/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const allowed = ["title", "body", "severity", "starts_at", "ends_at", "is_active"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("platform_announcements").update(updates).eq("id", id).select().single();
  if (error || !data) { res.status(404).json({ error: "Announcement not found" }); return; }
  res.json(data);
});

router.delete("/platform/announcements/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("platform_announcements").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

router.get("/platform/audit-log", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { event_type, limit: limitStr, offset: offsetStr } = req.query as { event_type?: string; limit?: string; offset?: string };
  const lim = Math.min(parseInt(limitStr || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(offsetStr || "0", 10) || 0, 0);

  let q = supabaseAdmin
    .from("platform_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + lim - 1);

  if (event_type) q = q.eq("event_type", event_type);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get("/platform/tenant-info", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.tenantId) { res.json(null); return; }

  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, company_name, status, trial_ends_at, plan_id, plans(name, max_users, max_jobs_per_month)")
    .eq("id", req.tenantId)
    .single();

  if (error || !data) { res.json(null); return; }
  res.json(data);
});

router.get("/me/tenant", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.tenantId) { res.json(null); return; }

  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, company_name, status, trial_ends_at, plan_id, plans(name, monthly_price, max_users, max_jobs_per_month)")
    .eq("id", req.tenantId)
    .single();

  if (error || !data) { res.json(null); return; }

  const { data: subscription } = await supabaseAdmin
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  res.json({ ...data, subscription: subscription || null });
});

router.get("/platform/stats/mrr", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, plan_id, status, plans(monthly_price)")
    .in("status", ["active", "trial"]);

  const mrr = (tenants || []).reduce((sum: number, t: { plans?: { monthly_price?: number } | null }) => {
    return sum + (t.plans?.monthly_price || 0);
  }, 0);

  res.json({ mrr });
});

router.get("/platform/stats/signups", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data } = await supabaseAdmin
    .from("tenants")
    .select("created_at")
    .order("created_at", { ascending: true });

  const months: Record<string, number> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months[key] = 0;
  }

  (data || []).forEach((t: { created_at: string }) => {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in months) months[key]++;
  });

  res.json(Object.entries(months).map(([month, count]) => ({ month, count })));
});

export default router;
