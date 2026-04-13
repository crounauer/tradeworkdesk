import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";
import { requireStripe } from "../lib/stripe";

const router: IRouter = Router();

router.get("/platform/addons", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("addons")
    .select("*")
    .order("sort_order");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get("/platform/addons/public", async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("addons")
    .select("id, name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/platform/addons", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, description, feature_keys, monthly_price, annual_price, stripe_price_id, stripe_price_id_annual, is_active, is_per_seat, sort_order } = req.body;
  if (!name) { res.status(400).json({ error: "Add-on name is required" }); return; }

  const { count } = await supabaseAdmin.from("addons").select("id", { count: "exact", head: true });

  const { data, error } = await supabaseAdmin.from("addons").insert({
    name,
    description: description || null,
    feature_keys: feature_keys || [],
    monthly_price: monthly_price || 0,
    annual_price: annual_price || 0,
    stripe_price_id: stripe_price_id || null,
    stripe_price_id_annual: stripe_price_id_annual || null,
    is_active: is_active !== false,
    is_per_seat: is_per_seat === true,
    sort_order: sort_order ?? ((count || 0) + 1),
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "addon_created",
    entity_type: "addon",
    entity_id: data.id,
    detail: { name },
  });

  res.status(201).json(data);
});

router.patch("/platform/addons/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const allowed = ["name", "description", "feature_keys", "monthly_price", "annual_price", "stripe_price_id", "stripe_price_id_annual", "is_active", "is_per_seat", "sort_order"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  const { data, error } = await supabaseAdmin.from("addons").update(updates).eq("id", id).select().single();
  if (error) { console.error("[addons] update error:", error.message, error.details); res.status(400).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Add-on not found" }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "addon_updated",
    entity_type: "addon",
    entity_id: id,
    detail: updates,
  });

  res.json(data);
});

router.delete("/platform/addons/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  const { count } = await supabaseAdmin
    .from("tenant_addons")
    .select("id", { count: "exact", head: true })
    .eq("addon_id", id)
    .eq("is_active", true);

  if (count && count > 0) {
    res.status(409).json({ error: `Cannot delete add-on: ${count} tenant(s) are currently using it.` });
    return;
  }

  const { error } = await supabaseAdmin.from("addons").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "addon_deleted",
    entity_type: "addon",
    entity_id: id,
    detail: {},
  });

  res.sendStatus(204);
});

router.get("/me/addons", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("tenant_addons")
    .select("id, addon_id, is_active, activated_at, addons(id, name, description, feature_keys, monthly_price, annual_price)")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/billing/addons/update", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { addon_ids, addon_quantities = {} } = req.body as {
    addon_ids: string[];
    addon_quantities?: Record<string, number>;
  };
  if (!Array.isArray(addon_ids)) {
    res.status(400).json({ error: "addon_ids must be an array" });
    return;
  }

  const { data: tenant } = await supabaseAdmin.from("tenants").select("*").eq("id", req.tenantId!).single();
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  if (!tenant.stripe_subscription_id) {
    res.status(400).json({ error: "No active subscription. Please subscribe to the base plan first." });
    return;
  }

  const { data: addons } = await supabaseAdmin
    .from("addons")
    .select("*")
    .in("id", addon_ids.length > 0 ? addon_ids : ["00000000-0000-0000-0000-000000000000"])
    .eq("is_active", true);

  if (!addons) { res.status(400).json({ error: "Invalid add-ons" }); return; }

  const stripeClient = requireStripe();

  const subscription = await stripeClient.subscriptions.retrieve(tenant.stripe_subscription_id);

  const existingItems = subscription.items.data;

  const subInterval = (subscription as unknown as { items: { data: Array<{ plan?: { interval?: string } }> } }).items.data[0]?.plan?.interval;
  const billing_cycle = subInterval === "year" ? "annual" : "monthly";

  const { data: allDbAddons } = await supabaseAdmin.from("addons").select("id, stripe_price_id, stripe_price_id_annual");
  const knownAddonPrices = new Map<string, string>();
  if (allDbAddons) {
    for (const a of allDbAddons) {
      if (a.stripe_price_id) knownAddonPrices.set(a.stripe_price_id, a.id);
      if (a.stripe_price_id_annual) knownAddonPrices.set(a.stripe_price_id_annual, a.id);
    }
  }

  const validatedAddonIds: string[] = [];
  const addonQuantityMap = new Map<string, number>();
  const newItems: { price: string; quantity: number }[] = [];
  for (const addon of (addons || [])) {
    const priceId = billing_cycle === "annual" ? addon.stripe_price_id_annual : addon.stripe_price_id;
    if (priceId) {
      const qty = addon.is_per_seat ? Math.max(1, Math.floor(addon_quantities?.[addon.id] || 1)) : 1;
      newItems.push({ price: priceId, quantity: qty });
      validatedAddonIds.push(addon.id);
      addonQuantityMap.set(addon.id, qty);
    }
  }

  const itemUpdates: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }> = [];

  for (const item of existingItems) {
    if (knownAddonPrices.has(item.price.id)) {
      itemUpdates.push({ id: item.id, deleted: true });
    }
  }

  for (const item of newItems) {
    itemUpdates.push({ price: item.price, quantity: item.quantity });
  }

  if (itemUpdates.length > 0) {
    await stripeClient.subscriptions.update(tenant.stripe_subscription_id, {
      items: itemUpdates,
      proration_behavior: "create_prorations",
    });
  }

  await supabaseAdmin
    .from("tenant_addons")
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  if (validatedAddonIds.length > 0) {
    const inserts = validatedAddonIds.map(addon_id => ({
      tenant_id: req.tenantId!,
      addon_id,
      is_active: true,
      quantity: addonQuantityMap.get(addon_id) || 1,
      activated_at: new Date().toISOString(),
    }));

    await supabaseAdmin
      .from("tenant_addons")
      .upsert(inserts, { onConflict: "tenant_id,addon_id" });
  }

  await supabaseAdmin.from("platform_audit_log").insert({
    event_type: "tenant_addons_updated",
    entity_type: "tenant",
    entity_id: req.tenantId!,
    detail: { addon_ids: validatedAddonIds, billing_cycle },
  });

  res.json({ ok: true });
});

router.get("/platform/tenants/:id/addons", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("tenant_addons")
    .select("*, addons(id, name, description, feature_keys)")
    .eq("tenant_id", id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/platform/tenants/:id/addons", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { addon_ids } = req.body as { addon_ids: string[] };

  if (!Array.isArray(addon_ids)) {
    res.status(400).json({ error: "addon_ids must be an array" });
    return;
  }

  await supabaseAdmin
    .from("tenant_addons")
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq("tenant_id", id)
    .eq("is_active", true);

  if (addon_ids.length > 0) {
    const inserts = addon_ids.map(addon_id => ({
      tenant_id: id,
      addon_id,
      is_active: true,
      activated_at: new Date().toISOString(),
    }));

    await supabaseAdmin
      .from("tenant_addons")
      .upsert(inserts, { onConflict: "tenant_id,addon_id" });
  }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "tenant_addons_set_by_admin",
    entity_type: "tenant",
    entity_id: id,
    detail: { addon_ids },
  });

  res.json({ ok: true });
});

export default router;
