import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";
import { sendWelcomeEmail } from "../lib/email";
import { stripe } from "../lib/stripe";
import { seedDefaultJobTypesForTenant } from "../lib/job-types-seed";
import { getEffectiveLimits, getCurrentUserCount, getJobsThisMonth } from "../lib/tenant-limits";

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

router.post("/platform/tenants/:id/grant-free-access", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const BASE_PLAN_ID = "37421994-c20d-49f8-aee1-a896e030a5f5";

  const { data: tenant, error: tErr } = await supabaseAdmin
    .from("tenants")
    .update({ plan_id: BASE_PLAN_ID, status: "active", trial_ends_at: null })
    .eq("id", id)
    .select()
    .single();

  if (tErr || !tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const { data: allAddons } = await supabaseAdmin
    .from("addons")
    .select("id")
    .eq("is_active", true);

  if (allAddons && allAddons.length > 0) {
    await supabaseAdmin
      .from("tenant_addons")
      .update({ is_active: false })
      .eq("tenant_id", id)
      .eq("is_active", true);

    const inserts = allAddons.map(a => ({
      tenant_id: id,
      addon_id: a.id,
      is_active: true,
      quantity: 1,
      activated_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("tenant_addons").upsert(inserts, { onConflict: "tenant_id,addon_id" });
  }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "granted_free_access",
    entity_type: "tenant",
    entity_id: id,
    detail: { plan_id: BASE_PLAN_ID, addons_activated: allAddons?.length || 0 },
  });

  res.json({ success: true, tenant });
});

router.post("/platform/tenants/:id/revoke-free-access", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";

  const { data: tenant, error: tErr } = await supabaseAdmin
    .from("tenants")
    .update({ plan_id: FREE_PLAN_ID, status: "active", trial_ends_at: null })
    .eq("id", id)
    .select()
    .single();

  if (tErr || !tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const { count } = await supabaseAdmin
    .from("tenant_addons")
    .update({ is_active: false })
    .eq("tenant_id", id)
    .eq("is_active", true)
    .select("id", { count: "exact", head: true });

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "revoked_free_access",
    entity_type: "tenant",
    entity_id: id,
    detail: { plan_id: FREE_PLAN_ID, addons_deactivated: count || 0 },
  });

  res.json({ success: true, tenant });
});

router.post("/platform/tenants", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { company_name, contact_name, contact_email, contact_phone, plan_id, status } = req.body;
  if (!company_name || !contact_email) {
    res.status(400).json({ error: "company_name and contact_email are required." });
    return;
  }

  let trialDays = 30;
  try {
    const { data: setting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "trial_duration_days")
      .single();
    if (setting?.value && Number(setting.value) > 0) trialDays = Number(setting.value);
  } catch {}
  const trialEnds = new Date(Date.now() + trialDays * 86400000).toISOString();

  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .insert({
      company_name,
      contact_name: contact_name || company_name,
      contact_email,
      contact_phone: contact_phone || null,
      status: status || "trial",
      plan_id: plan_id || null,
      trial_ends_at: trialEnds,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("company_settings").insert({
    singleton_id: "default",
    tenant_id: tenant.id,
    name: company_name,
  });

  seedDefaultJobTypesForTenant(tenant.id).catch((e) =>
    console.error("[seed] Default job types failed for tenant", tenant.id, e)
  );

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "company_registered",
    entity_type: "tenant",
    entity_id: tenant.id,
    detail: { company_name, created_by: "super_admin" },
  });

  if (contact_email && trialEnds) {
    sendWelcomeEmail(contact_email, company_name, trialEnds).catch((e) =>
      console.error("[email] Welcome email failed:", e)
    );
  }

  res.status(201).json(tenant);
});

router.delete("/platform/tenants/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const confirm = req.query.confirm === "true";

  const { data: tenant } = await supabaseAdmin.from("tenants").select("company_name").eq("id", id).single();
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const { data: users } = await supabaseAdmin.from("profiles").select("id, email").eq("tenant_id", id);
  const userCount = users?.length || 0;

  if (userCount > 0 && !confirm) {
    res.status(409).json({
      error: "confirm_required",
      message: `This company has ${userCount} user(s). Deleting will permanently remove the company and all associated users.`,
      user_count: userCount,
      users: users?.map(u => ({ id: u.id, email: u.email })),
    });
    return;
  }

  if (userCount > 0 && users) {
    for (const user of users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id).catch(e =>
        console.error(`[delete-tenant] Failed to delete auth user ${user.id}:`, e.message)
      );
    }
    await supabaseAdmin.from("profiles").delete().eq("tenant_id", id);
  }

  await supabaseAdmin.from("tenant_addons").delete().eq("tenant_id", id);
  await supabaseAdmin.from("company_settings").delete().eq("tenant_id", id);

  const { error } = await supabaseAdmin.from("tenants").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "tenant_deleted",
    entity_type: "tenant",
    entity_id: id,
    detail: { company_name: tenant.company_name, users_deleted: userCount },
  });

  res.sendStatus(204);
});

router.get("/platform/tenants/:id/billing-portal", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("stripe_customer_id, company_name")
    .eq("id", id)
    .single();

  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  if (!tenant.stripe_customer_id) { res.status(400).json({ error: "Tenant has no Stripe customer" }); return; }

  if (!stripe) { res.status(503).json({ error: "Stripe not configured" }); return; }

  const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${APP_URL}/platform/tenants/${id}`,
  });

  res.json({ url: session.url });
});

router.get("/platform/plans/public", async (_req, res): Promise<void> => {
  const fullSelect = "id, name, description, monthly_price, annual_price, per_user_price, user_note, max_users, max_jobs_per_month, features, is_active, is_popular, sort_order, sole_trader_price, sole_trader_price_annual, stripe_price_id, stripe_price_id_annual, stripe_sole_trader_price_id, stripe_sole_trader_price_id_annual";
  const basicSelect = "id, name, description, monthly_price, annual_price, max_users, max_jobs_per_month, features, is_active, sort_order";

  let result = await supabaseAdmin.from("plans").select(fullSelect).eq("is_active", true).eq("is_legacy", false).order("sort_order", { ascending: true });
  if (result.error?.code === "42703") {
    result = await supabaseAdmin.from("plans").select(basicSelect).eq("is_active", true).order("sort_order", { ascending: true });
  }
  if (result.error) { res.status(500).json({ error: result.error.message }); return; }
  res.json(result.data || []);
});

router.get("/platform/plans", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("plans").select("*").order("sort_order");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/platform/plans", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, description, monthly_price, annual_price, per_user_price, user_note, max_users, max_jobs_per_month, features, is_popular, stripe_price_id, stripe_price_id_annual } = req.body;
  if (!name) { res.status(400).json({ error: "Plan name is required" }); return; }

  const { count } = await supabaseAdmin.from("plans").select("id", { count: "exact", head: true });

  const fullPayload = {
    name,
    description: description || null,
    monthly_price: monthly_price || 0,
    annual_price: annual_price || 0,
    per_user_price: per_user_price ?? null,
    user_note: user_note || null,
    max_users: max_users || 5,
    max_jobs_per_month: max_jobs_per_month || 100,
    features: features || {},
    is_popular: is_popular || false,
    sort_order: (count || 0) + 1,
    stripe_price_id: stripe_price_id || null,
    stripe_price_id_annual: stripe_price_id_annual || null,
  };

  let result = await supabaseAdmin.from("plans").insert(fullPayload).select().single();

  if (result.error?.code === "42703") {
    const { per_user_price: _a, user_note: _b, is_popular: _c, ...basePayload } = fullPayload;
    result = await supabaseAdmin.from("plans").insert(basePayload).select().single();
  }

  const { data, error } = result;
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

router.get("/platform/settings/:key", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { key } = req.params;
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value, updated_at")
    .eq("key", key)
    .single();
  if (error || !data) { res.status(404).json({ error: "Setting not found" }); return; }
  res.json(data);
});

router.put("/platform/settings/:key", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body;
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "setting_updated",
    entity_type: "platform_setting",
    entity_id: key,
    detail: { value },
  });
  res.json(data);
});

router.patch("/platform/plans/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const allowed = ["name", "description", "monthly_price", "annual_price", "per_user_price", "user_note", "max_users", "max_jobs_per_month", "features", "is_active", "is_popular", "sort_order", "stripe_price_id", "stripe_price_id_annual"];
  const patchOnlyNew = ["per_user_price", "user_note", "is_popular"];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  let result = await supabaseAdmin.from("plans").update(updates).eq("id", id).select().single();

  if (result.error?.code === "42703") {
    const fallbackUpdates = { ...updates };
    for (const key of patchOnlyNew) delete fallbackUpdates[key];
    result = await supabaseAdmin.from("plans").update(fallbackUpdates).eq("id", id).select().single();
  }

  const { data, error } = result;
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

router.post("/platform/plans/:id/sync-stripe", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { stripe_price_id, stripe_price_id_annual } = req.body as { stripe_price_id?: string; stripe_price_id_annual?: string };

  if (!stripe_price_id && !stripe_price_id_annual) {
    res.status(400).json({ error: "Provide at least stripe_price_id or stripe_price_id_annual" });
    return;
  }

  const updates: Record<string, string | null> = {};
  if (stripe_price_id !== undefined) updates.stripe_price_id = stripe_price_id || null;
  if (stripe_price_id_annual !== undefined) updates.stripe_price_id_annual = stripe_price_id_annual || null;

  if (stripe) {
    for (const [field, priceId] of Object.entries(updates)) {
      if (!priceId) continue;
      try {
        await stripe.prices.retrieve(priceId);
      } catch {
        res.status(400).json({ error: `Invalid Stripe Price ID for ${field}: ${priceId}` });
        return;
      }
    }
  }

  const { data, error } = await supabaseAdmin.from("plans").update(updates).eq("id", id).select().single();
  if (error || !data) { res.status(404).json({ error: "Plan not found" }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "plan_stripe_synced",
    entity_type: "plan",
    entity_id: id,
    detail: updates,
  });

  res.json(data);
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
    .select("id, company_name, company_type, status, trial_ends_at, plan_id, plans(name, max_users, max_jobs_per_month)")
    .eq("id", req.tenantId)
    .single();

  if (error || !data) { res.json(null); return; }
  res.json(data);
});

const initCache = new Map<string, { data: unknown; ts: number }>();
const INIT_CACHE_TTL_MS = 60_000;

router.get("/me/init", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const t0 = Date.now();
  const cacheKey = `${req.tenantId || "none"}:${req.userId}`;
  const cached = initCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < INIT_CACHE_TTL_MS) {
    res.set("Cache-Control", "no-store");
    res.set("X-Cache", "HIT");
    res.json(cached.data);
    console.log(`[perf] /me/init cache HIT ${Date.now() - t0}ms`);
    return;
  }

  const superAdminFeatures = {
    job_management: true, invoicing: true, reports: true, team_management: true,
    social_media: true, heat_pump_forms: true, oil_tank_forms: true,
    commissioning_forms: true, combustion_analysis: true, api_access: true,
    scheduling: true, custom_branding: true, priority_support: true,
  };

  const profilePromise = supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, phone, tenant_id, is_active, created_at, updated_at")
    .eq("id", req.userId!)
    .single();

  if (req.userRole === "super_admin") {
    const saNow = new Date();
    const [profileResult, announcementsResult] = await Promise.all([
      profilePromise,
      supabaseAdmin
        .from("platform_announcements")
        .select("id, title, body, severity, starts_at, ends_at")
        .eq("is_active", true)
        .lte("starts_at", saNow.toISOString())
        .or(`ends_at.is.null,ends_at.gt.${saNow.toISOString()}`)
        .order("severity", { ascending: false })
        .limit(10),
    ]);
    const responseBody = {
      profile: profileResult.data || null,
      planFeatures: { plan_id: null, plan_name: "Super Admin", features: superAdminFeatures },
      tenant: null,
      enquiriesCount: 0,
      announcements: announcementsResult.data || [],
    };
    initCache.set(cacheKey, { data: responseBody, ts: Date.now() });
    res.set("Cache-Control", "no-store");
    res.json(responseBody);
    return;
  }

  const promises: Promise<unknown>[] = [profilePromise];

  if (req.tenantId) {
    promises.push(
      supabaseAdmin
        .from("tenants")
        .select("id, company_name, company_type, status, trial_ends_at, subscription_renewal_at, stripe_customer_id, plan_id, plans(name, features, monthly_price, max_users, max_jobs_per_month)")
        .eq("id", req.tenantId)
        .single(),
      supabaseAdmin
        .from("tenant_subscriptions")
        .select("id, tenant_id, stripe_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at")
        .eq("tenant_id", req.tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("enquiries")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "contacted", "quoted"])
        .eq("tenant_id", req.tenantId),
      supabaseAdmin
        .from("tenant_addons")
        .select("addon_id, addons(id, name, feature_keys)")
        .eq("tenant_id", req.tenantId)
        .eq("is_active", true),
      supabaseAdmin
        .from("follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("status", "awaiting_parts")
        .lt("expected_parts_date", new Date().toISOString().split("T")[0])
        .eq("tenant_id", req.tenantId),
    );
  }

  const now2 = new Date();
  promises.push(
    supabaseAdmin
      .from("platform_announcements")
      .select("id, title, body, severity, starts_at, ends_at")
      .eq("is_active", true)
      .lte("starts_at", now2.toISOString())
      .or(`ends_at.is.null,ends_at.gt.${now2.toISOString()}`)
      .order("severity", { ascending: false })
      .limit(10)
  );

  const results = await Promise.all(promises);

  const profileRes = results[0] as { data: Record<string, unknown> | null };
  const profile = profileRes?.data || null;

  let planFeatures = { plan_id: null as string | null, plan_name: null as string | null, features: {} as Record<string, boolean> };
  let tenant = null;
  let enquiriesCount = 0;

  let activeAddons: Array<{ addon_id: string; addons: { id: string; name: string; feature_keys: string[] } | null }> = [];

  if (req.tenantId) {
    const tenantRes = results[1] as { data: Record<string, unknown> & { plan_id?: string; plans?: { name?: string; features?: Record<string, boolean>; monthly_price?: number; max_users?: number; max_jobs_per_month?: number } | null } | null; error: unknown };
    const subscriptionRes = results[2] as { data: Record<string, unknown> | null };
    const enquiriesRes = results[3] as { count: number | null };
    const addonsRes = results[4] as { data: typeof activeAddons | null };
    activeAddons = addonsRes?.data || [];
    const overdueFollowUpsRes = results[5] as { count: number | null };

    if (tenantRes?.data) {
      if (tenantRes.data.status === "trial" && tenantRes.data.trial_ends_at) {
        const trialEnd = new Date(tenantRes.data.trial_ends_at as string).getTime();
        if (trialEnd < Date.now()) {
          const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";
          const { data: freePlan } = await supabaseAdmin
            .from("plans")
            .select("name, features, monthly_price, max_users, max_jobs_per_month")
            .eq("id", FREE_PLAN_ID)
            .single();
          await Promise.all([
            supabaseAdmin
              .from("tenants")
              .update({ plan_id: FREE_PLAN_ID, status: "active", trial_ends_at: null })
              .eq("id", req.tenantId!),
            supabaseAdmin
              .from("tenant_addons")
              .update({ is_active: false })
              .eq("tenant_id", req.tenantId!)
              .eq("is_active", true),
          ]);
          tenantRes.data.plan_id = FREE_PLAN_ID;
          tenantRes.data.status = "active";
          tenantRes.data.trial_ends_at = null;
          if (freePlan) {
            tenantRes.data.plans = freePlan as typeof tenantRes.data.plans;
          }
          activeAddons = [];
        }
      }
      const plan = tenantRes.data.plans;
      const baseFeatures: Record<string, boolean> = { ...(plan?.features ?? {}) };

      for (const ta of activeAddons) {
        if (ta.addons?.feature_keys) {
          for (const key of ta.addons.feature_keys) {
            baseFeatures[key] = true;
          }
        }
      }

      planFeatures = {
        plan_id: tenantRes.data.plan_id ?? null,
        plan_name: plan?.name ?? null,
        features: baseFeatures,
      };
      tenant = { ...tenantRes.data, subscription: subscriptionRes?.data || null };
    }

    enquiriesCount = enquiriesRes?.count || 0;
  }

  const announcementsIdx = req.tenantId ? 6 : 1;
  const announcementsRes = results[announcementsIdx] as { data: unknown[] | null };
  const announcements = announcementsRes?.data || [];

  const addonsList = activeAddons.map(a => ({
    addon_id: a.addon_id,
    name: a.addons?.name ?? null,
    feature_keys: a.addons?.feature_keys ?? [],
  }));

  let usageLimits = null;
  if (req.tenantId) {
    const [limits, userCount, jobCount] = await Promise.all([
      getEffectiveLimits(req.tenantId),
      getCurrentUserCount(req.tenantId),
      getJobsThisMonth(req.tenantId),
    ]);
    usageLimits = {
      maxUsers: limits.maxUsers,
      currentUsers: userCount,
      baseMaxUsers: limits.baseMaxUsers,
      addonExtraUsers: limits.addonExtraUsers,
      maxJobsPerMonth: limits.maxJobsPerMonth,
      currentJobsThisMonth: jobCount,
      baseMaxJobsPerMonth: limits.baseMaxJobsPerMonth,
      addonExtraJobs: limits.addonExtraJobs,
    };
  }

  let overdueFollowUpsCount = 0;
  if (req.tenantId) {
    const ofuRes = results[5] as { count: number | null } | undefined;
    overdueFollowUpsCount = ofuRes?.count || 0;
  }
  const responseBody = { profile, planFeatures, tenant, enquiriesCount, overdueFollowUpsCount, announcements, activeAddons: addonsList, usageLimits };
  initCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  res.set("Cache-Control", "no-store");
  res.json(responseBody);
  console.log(`[perf] /me/init total ${Date.now() - t0}ms`);
});

router.get("/me/plan-features", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (req.userRole === "super_admin") {
    res.json({ plan_id: null, plan_name: "Super Admin", features: {
      job_management: true, invoicing: true, reports: true, team_management: true,
      social_media: true, heat_pump_forms: true, oil_tank_forms: true,
      commissioning_forms: true, combustion_analysis: true, api_access: true,
      scheduling: true, custom_branding: true, priority_support: true,
    }});
    return;
  }

  if (!req.tenantId) {
    res.json({ plan_id: null, plan_name: null, features: {} });
    return;
  }

  const [tenantRes, addonsRes] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select("plan_id, plans(name, features)")
      .eq("id", req.tenantId)
      .single(),
    supabaseAdmin
      .from("tenant_addons")
      .select("addon_id, addons(feature_keys)")
      .eq("tenant_id", req.tenantId)
      .eq("is_active", true),
  ]);

  if (tenantRes.error || !tenantRes.data) {
    res.json({ plan_id: null, plan_name: null, features: {} });
    return;
  }

  const plan = tenantRes.data.plans as { name?: string; features?: Record<string, boolean> } | null;
  const features: Record<string, boolean> = { ...(plan?.features ?? {}) };

  if (addonsRes.data) {
    for (const ta of addonsRes.data) {
      const addon = ta.addons as { feature_keys?: string[] } | null;
      if (addon?.feature_keys) {
        for (const key of addon.feature_keys) {
          features[key] = true;
        }
      }
    }
  }

  res.json({
    plan_id: tenantRes.data.plan_id,
    plan_name: plan?.name ?? null,
    features,
  });
});

router.get("/me/tenant", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.tenantId) { res.json(null); return; }

  const [tenantRes, subscriptionRes] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select("id, company_name, company_type, status, trial_ends_at, subscription_renewal_at, stripe_customer_id, plan_id, stripe_subscription_id, plans(name, monthly_price, max_users, max_jobs_per_month, is_legacy)")
      .eq("id", req.tenantId)
      .single(),
    supabaseAdmin
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", req.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (tenantRes.error || !tenantRes.data) { res.json(null); return; }

  res.json({ ...tenantRes.data, subscription: subscriptionRes.data || null });
});

router.get("/platform/stats/mrr", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  if (stripe) {
    try {
      let mrr = 0;
      let hasMore = true;
      let startingAfter: string | undefined;
      while (hasMore) {
        const subs = await stripe.subscriptions.list({
          status: "active",
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
          expand: ["data.items.data.price"],
        });
        for (const sub of subs.data) {
          for (const item of sub.items.data) {
            const price = item.price as unknown as { unit_amount?: number; recurring?: { interval?: string; interval_count?: number } };
            if (price.unit_amount && price.recurring) {
              const interval = price.recurring.interval;
              const count = price.recurring.interval_count || 1;
              const unitCents = price.unit_amount / 100;
              if (interval === "month") mrr += unitCents / count;
              else if (interval === "year") mrr += unitCents / (12 * count);
            }
          }
        }
        hasMore = subs.has_more;
        if (subs.data.length > 0) startingAfter = subs.data[subs.data.length - 1].id;
        else break;
      }
      res.json({ mrr: Math.round(mrr * 100) / 100, source: "stripe" });
      return;
    } catch (err) {
      console.warn("[mrr] Stripe MRR fetch failed, falling back to DB:", err);
    }
  }

  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, plan_id, status, plans(monthly_price)")
    .in("status", ["active", "trial"]);

  const mrr = (tenants || []).reduce((sum: number, t: { plans?: { monthly_price?: number }[] | { monthly_price?: number } | null }) => {
    const planData = Array.isArray(t.plans) ? t.plans[0] : t.plans;
    return sum + (planData?.monthly_price || 0);
  }, 0);

  res.json({ mrr, source: "db" });
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

router.post("/platform/email/test", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { template, to } = req.body;
  if (!template || !to) { res.status(400).json({ error: "template and to are required" }); return; }

  const { sendWelcomeEmail: wel, sendInvoiceEmail: inv, sendTrialExpiryReminder: trial, sendRenewalReminder: ren, sendPaymentFailedEmail: fail } = await import("../lib/email");

  const BILLING = process.env.APP_URL ? `${process.env.APP_URL}/billing` : "https://tradeworkdesk.co.uk/billing";
  const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();

  try {
    switch (template) {
      case "welcome":
        await wel(to, "Test Company Ltd", futureDate);
        break;
      case "invoice":
        await inv(to, "Test Company Ltd", 5999, "gbp", futureDate, "https://invoice.stripe.com/test");
        break;
      case "trial_expiry":
        await trial(to, "Test Company Ltd", 7, BILLING);
        break;
      case "renewal_reminder":
        await ren(to, "Test Company Ltd", futureDate, 5999, "gbp", BILLING);
        break;
      case "payment_failed":
        await fail(to, "Test Company Ltd", 5999, "gbp", BILLING);
        break;
      default:
        res.status(400).json({ error: `Unknown template: ${template}` });
        return;
    }
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_id: req.userId,
      actor_email: req.userEmail,
      event_type: "test_email_sent",
      entity_type: null,
      entity_id: null,
      detail: { template, to },
    });
    res.json({ ok: true, template, to });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

function generateBetaCode(): string {
  return "BETA-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.get("/platform/beta-invites", requireAuth, requireSuperAdmin, async (_req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("beta_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.post("/platform/beta-invites", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { count = 1, max_uses = 1, email, expires_at, notes } = req.body;
  const batchSize = Math.min(Math.max(1, Number(count) || 1), 50);

  const codes = Array.from({ length: batchSize }, () => ({
    code: generateBetaCode(),
    max_uses: Math.max(1, Number(max_uses) || 1),
    email: email?.trim() || null,
    expires_at: expires_at || null,
    is_active: true,
    created_by: req.userId,
    notes: notes?.trim() || null,
  }));

  const { data, error } = await supabaseAdmin
    .from("beta_invites")
    .insert(codes)
    .select();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail || "super_admin",
    event_type: "beta_invites_created",
    entity_type: "beta_invite",
    entity_id: null,
    detail: { count: batchSize, notes },
  });

  res.status(201).json(data);
});

router.patch("/platform/beta-invites/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { is_active, max_uses, notes, expires_at } = req.body;

  const updates: Record<string, unknown> = {};
  if (is_active !== undefined) updates.is_active = is_active;
  if (max_uses !== undefined) updates.max_uses = Math.max(1, Number(max_uses) || 1);
  if (notes !== undefined) updates.notes = notes?.trim() || null;
  if (expires_at !== undefined) updates.expires_at = expires_at || null;

  const { data, error } = await supabaseAdmin
    .from("beta_invites")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/platform/beta-invites/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from("beta_invites")
    .delete()
    .eq("id", id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

router.post("/auth/validate-beta", async (req, res): Promise<void> => {
  const { code } = req.body;
  if (!code?.trim()) {
    res.status(400).json({ valid: false, error: "Beta code is required" });
    return;
  }

  const trimmed = code.trim().toUpperCase();
  const { data: invite, error } = await supabaseAdmin
    .from("beta_invites")
    .select("*")
    .eq("code", trimmed)
    .eq("is_active", true)
    .single();

  if (error || !invite) {
    res.status(404).json({ valid: false, error: "Invalid beta code" });
    return;
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    res.json({ valid: false, error: "This beta code has expired" });
    return;
  }

  if (invite.used_count >= invite.max_uses) {
    res.json({ valid: false, error: "This beta code has reached its usage limit" });
    return;
  }

  res.json({ valid: true, email: invite.email || null });
});

export default router;
