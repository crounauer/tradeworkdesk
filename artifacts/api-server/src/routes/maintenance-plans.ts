/**
 * Maintenance Plans & Service Reminders API
 *
 * Plan tiers:
 *   GET    /api/maintenance/tiers          — list plan tiers
 *   POST   /api/maintenance/tiers          — create tier
 *   PATCH  /api/maintenance/tiers/:id      — update tier
 *   DELETE /api/maintenance/tiers/:id      — delete tier
 *
 * Subscriptions:
 *   GET    /api/maintenance/subscriptions           — list (with ?status=, ?customer_id=)
 *   POST   /api/maintenance/subscriptions           — create
 *   PATCH  /api/maintenance/subscriptions/:id       — update
 *   DELETE /api/maintenance/subscriptions/:id       — cancel
 *
 * Reminder settings:
 *   GET    /api/maintenance/reminder-settings       — get settings
 *   PUT    /api/maintenance/reminder-settings       — upsert settings
 *
 * Reminders:
 *   GET    /api/maintenance/reminders               — list (?status=, ?due_before=)
 *   POST   /api/maintenance/reminders               — create manually
 *   PATCH  /api/maintenance/reminders/:id           — update status
 *   POST   /api/maintenance/reminders/:id/send      — force-send now
 *   POST   /api/maintenance/reminders/generate      — auto-generate from next_service_due on appliances
 *
 * Public tracking:
 *   GET    /api/public/reminder/:token              — track open
 *   GET    /api/public/reminder/:token/book         — redirect to booking URL
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import {
  requireAuth,
  requireTenant,
  type AuthenticatedRequest,
} from "../middlewares/auth";
import { notifyUsersForEvent } from "../lib/push-events";

const router: IRouter = Router();
const publicRouter: IRouter = Router();
const db = supabaseAdmin as any;

// ─── Tiers ────────────────────────────────────────────────────────────────────

router.get("/maintenance/tiers", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("maintenance_plan_tiers")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("sort_order");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

router.post("/maintenance/tiers", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("maintenance_plan_tiers")
    .insert({ ...fields, tenant_id: req.tenantId })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/maintenance/tiers/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("maintenance_plan_tiers")
    .update(fields)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.delete("/maintenance/tiers/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  // Check no active subscriptions
  const { count } = await db.from("maintenance_plan_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("tier_id", req.params.id)
    .eq("status", "active");
  if ((count ?? 0) > 0) {
    return res.status(409).json({ error: "Cannot delete a tier with active subscriptions" });
  }
  await db.from("maintenance_plan_tiers")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId);
  res.status(204).end();
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

router.get("/maintenance/subscriptions", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { status, customer_id } = req.query as Record<string, string>;
  let q = db.from("maintenance_plan_subscriptions")
    .select(`
      *,
      tier:maintenance_plan_tiers(name, colour, price_per_year),
      customer:customers(first_name, last_name, email, phone),
      property:properties(address_line1, postcode)
    `)
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (customer_id) q = q.eq("customer_id", customer_id);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

router.post("/maintenance/subscriptions", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("maintenance_plan_subscriptions")
    .insert({ ...fields, tenant_id: req.tenantId })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/maintenance/subscriptions/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("maintenance_plan_subscriptions")
    .update(fields)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.delete("/maintenance/subscriptions/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  // Soft cancel
  const { data, error } = await db.from("maintenance_plan_subscriptions")
    .update({ status: "cancelled" })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// ─── Reminder settings ────────────────────────────────────────────────────────

router.get("/maintenance/reminder-settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("service_reminder_settings")
    .select("*").eq("tenant_id", req.tenantId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? {});
});

router.put("/maintenance/reminder-settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("service_reminder_settings").upsert(
    { ...fields, tenant_id: req.tenantId },
    { onConflict: "tenant_id" }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Reminders list ───────────────────────────────────────────────────────────

router.get("/maintenance/reminders", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { status, due_before, limit = "50" } = req.query as Record<string, string>;
  let q = db.from("service_reminders")
    .select(`
      *,
      customer:customers(first_name, last_name, email, phone),
      property:properties(address_line1, postcode),
      appliance:appliances(manufacturer, model, fuel_type)
    `)
    .eq("tenant_id", req.tenantId)
    .order("due_date", { ascending: true })
    .limit(parseInt(limit));
  if (status) q = q.eq("status", status);
  if (due_before) q = q.lte("due_date", due_before);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

router.post("/maintenance/reminders", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("service_reminders")
    .insert({ ...fields, tenant_id: req.tenantId })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/maintenance/reminders/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("service_reminders")
    .update(fields)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// POST /api/maintenance/reminders/:id/send — force send a reminder now
router.post("/maintenance/reminders/:id/send", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { data: reminder, error: fetchErr } = await db.from("service_reminders")
    .select("*, customer:customers(first_name, last_name, email, phone)")
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .single();
  if (fetchErr || !reminder) return res.status(404).json({ error: "Not found" });

  // Mark as sent (actual email/SMS delivery handled by background worker / cron)
  const { data, error } = await db.from("service_reminders")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  void notifyUsersForEvent({
    tenantId: req.tenantId!,
    eventType: "maintenance_lifecycle",
    title: "Maintenance Reminder Sent",
    body: `A service reminder has been sent${reminder?.customer?.first_name ? ` to ${reminder.customer.first_name}` : ""}.`,
    url: "/maintenance",
    eventKey: `maintenance_sent:${req.params.id}:${data.sent_at}`,
    targetRoles: ["admin", "office_staff"],
    data: { reminderId: req.params.id },
  }).catch((err) => console.error("[push-events] maintenance_sent failed:", err));

  res.json(data);
});

// POST /api/maintenance/reminders/generate — scan appliances for upcoming due dates
router.post("/maintenance/reminders/generate", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { advance_days = 30 } = req.body as { advance_days?: number };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + advance_days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Find appliances with next_service_due within the window that don't already have a pending reminder
  const { data: appliances, error: appErr } = await db.from("appliances")
    .select("id, tenant_id, property_id, fuel_type, next_service_due, properties(customer_id)")
    .eq("tenant_id", req.tenantId)
    .lte("next_service_due", cutoffStr)
    .not("next_service_due", "is", null);

  if (appErr) return res.status(500).json({ error: appErr.message });
  if (!appliances?.length) return res.json({ created: 0 });

  // For each, check if a pending reminder already exists
  let created = 0;
  for (const app of appliances) {
    const customerId = app.properties?.customer_id;
    if (!customerId) continue;

    const { count } = await db.from("service_reminders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", req.tenantId)
      .eq("appliance_id", app.id)
      .in("status", ["pending", "sent"]);

    if ((count ?? 0) > 0) continue;

    const reminderType = app.fuel_type === "heat_pump"
      ? "heat_pump_service"
      : app.fuel_type === "oil" ? "oil_service" : "annual_service";

    await db.from("service_reminders").insert({
      tenant_id: req.tenantId,
      customer_id: customerId,
      property_id: app.property_id,
      appliance_id: app.id,
      reminder_type: reminderType,
      due_date: app.next_service_due,
      status: "pending",
      channel: "email",
      scheduled_for: new Date().toISOString(),
    });
    created++;
  }

  if (created > 0) {
    void notifyUsersForEvent({
      tenantId: req.tenantId!,
      eventType: "maintenance_lifecycle",
      title: "Maintenance Reminders Generated",
      body: `${created} reminder${created === 1 ? "" : "s"} generated for upcoming services.`,
      url: "/maintenance",
      eventKey: `maintenance_generated:${req.tenantId}:${cutoffStr}:${created}`,
      targetRoles: ["admin", "office_staff"],
      data: { created },
    }).catch((err) => console.error("[push-events] maintenance_generated failed:", err));
  }

  res.json({ created });
});

// ─── Public tracking ──────────────────────────────────────────────────────────

// GET /api/public/reminder/:token — 1x1 pixel, marks opened
publicRouter.get("/public/reminder/:token", async (req: Request, res: Response) => {
  const token = req.params.token;
  await db.from("service_reminders")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("tracking_token", token)
    .eq("status", "sent");

  // Return 1x1 transparent GIF
  const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.set("Content-Type", "image/gif").set("Cache-Control", "no-store").end(pixel);
});

// GET /api/public/reminder/:token/book — redirect to booking page
publicRouter.get("/public/reminder/:token/book", async (req: Request, res: Response) => {
  const token = req.params.token;
  const { data: reminder } = await db.from("service_reminders")
    .select("tenant_id, status")
    .eq("tracking_token", token)
    .maybeSingle();

  if (!reminder) return res.status(404).send("Not found");

  // Get tenant's booking URL
  const { data: tenant } = await db.from("tenants")
    .select("subdomain, custom_domain")
    .eq("id", reminder.tenant_id)
    .maybeSingle();

  await db.from("service_reminders")
    .update({ status: "opened" })
    .eq("tracking_token", token);

  const domain = tenant?.custom_domain ?? `${tenant?.subdomain}.tradeworkdesk.co.uk`;
  res.redirect(`https://${domain}/booking`);
});

export { router as maintenancePlansRouter, publicRouter as maintenancePlansPublicRouter };
