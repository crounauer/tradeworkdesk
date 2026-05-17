import { Router } from "express";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { requireStripe } from "../lib/stripe";
import { supabaseAdmin } from "../lib/supabase";
import { getCurrentUserCount, topUpAddonCredits, getStorageUsed, getEffectiveStorageLimit } from "../lib/tenant-limits";
import { bustInitCache } from "./platform";

const router = Router();

const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";

// Returns the single active non-legacy plan.
async function getActivePlan() {
  const { data } = await supabaseAdmin
    .from("plans")
    .select("id, stripe_price_id, stripe_per_seat_price_id")
    .eq("is_active", true)
    .eq("is_legacy", false)
    .gt("monthly_price", 0)
    .order("monthly_price", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as { id: string; stripe_price_id: string | null; stripe_per_seat_price_id: string | null } | null;
}

/**
 * Sync the per-seat Stripe subscription item quantity for a tenant.
 * Called after a user is added or removed. Safe to call even if the tenant
 * is on a trial or does not yet have a subscription.
 */
export async function syncSeats(tenantId: string): Promise<void> {
  const stripeClient = requireStripe(false);
  if (!stripeClient) return; // Stripe not configured — skip

  const { data: tenantRaw } = await supabaseAdmin
    .from("tenants")
    .select("stripe_subscription_id, stripe_per_seat_item_id")
    .eq("id", tenantId)
    .single();
  const tenant = tenantRaw as { stripe_subscription_id: string | null; stripe_per_seat_item_id: string | null } | null;

  if (!tenant?.stripe_subscription_id) return; // No active subscription yet

  const plan = await getActivePlan();
  if (!plan?.stripe_per_seat_price_id) return; // Per-seat pricing not configured

  const userCount = await getCurrentUserCount(tenantId);
  const extraSeats = Math.max(0, userCount - 2);

  if (tenant.stripe_per_seat_item_id) {
    await stripeClient.subscriptionItems.update(tenant.stripe_per_seat_item_id, {
      quantity: extraSeats,
      proration_behavior: "always_invoice",
    });
  } else if (extraSeats > 0) {
    // First time going above 2 users — add the per-seat item to the subscription
    const item = await stripeClient.subscriptionItems.create({
      subscription: tenant.stripe_subscription_id,
      price: plan.stripe_per_seat_price_id,
      quantity: extraSeats,
      proration_behavior: "always_invoice",
    });
    await supabaseAdmin
      .from("tenants")
      .update({ stripe_per_seat_item_id: item.id } as Record<string, unknown>)
      .eq("id", tenantId);
  }
  // else: extraSeats === 0 and no per-seat item — nothing to do
}

router.post("/billing/checkout", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const stripeClient = requireStripe();

  const plan = await getActivePlan();
  if (!plan) { res.status(404).json({ error: "No active plan found" }); return; }
  if (!plan.stripe_price_id) {
    res.status(400).json({ error: "Stripe price not yet configured for this plan. Please contact support." });
    return;
  }

  const { data: tenantRaw } = await supabaseAdmin.from("tenants").select("*").eq("id", req.tenantId!).single();
  if (!tenantRaw) { res.status(404).json({ error: "Tenant not found" }); return; }
  const tenant = tenantRaw as { stripe_customer_id: string | null; contact_email?: string; company_name?: string };

  let customerId: string | undefined = tenant.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripeClient.customers.create({
      email: tenant.contact_email || req.userEmail,
      name: tenant.company_name,
      metadata: { tenant_id: req.tenantId! },
    });
    customerId = customer.id;
    await supabaseAdmin.from("tenants").update({ stripe_customer_id: customerId } as Record<string, unknown>).eq("id", req.tenantId!);
  }

  const userCount = await getCurrentUserCount(req.tenantId!);
  const extraSeats = Math.max(0, userCount - 2);

  const lineItems: Array<{ price: string; quantity: number }> = [
    { price: plan.stripe_price_id, quantity: 1 },
  ];

  if (plan.stripe_per_seat_price_id && extraSeats > 0) {
    lineItems.push({ price: plan.stripe_per_seat_price_id, quantity: extraSeats });
  }

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    success_url: `${APP_URL}/billing?success=1`,
    cancel_url: `${APP_URL}/billing?cancelled=1`,
    metadata: {
      tenant_id: req.tenantId!,
      plan_id: plan.id,
    },
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

// Internal endpoint: re-sync per-seat quantity for the current tenant
router.post("/billing/sync-seats", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    await syncSeats(req.tenantId!);
    res.json({ success: true });
  } catch (err) {
    console.error("[syncSeats]", err);
    res.status(500).json({ error: "Failed to sync seats" });
  }
});


router.get("/billing/portal", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const stripeClient = requireStripe();

  const { data: tenantRaw } = await supabaseAdmin.from("tenants").select("stripe_customer_id").eq("id", req.tenantId!).single();
  const tenant = tenantRaw as { stripe_customer_id: string | null } | null;
  if (!tenant?.stripe_customer_id) {
    res.status(400).json({ error: "No billing account found. Please upgrade to a paid plan first." });
    return;
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${APP_URL}/billing`,
  });

  res.json({ url: session.url });
});

router.get("/billing/payment-method", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const stripeClient = requireStripe();

  const { data: tenantRaw } = await supabaseAdmin.from("tenants").select("stripe_customer_id").eq("id", req.tenantId!).single();
  const tenant = tenantRaw as { stripe_customer_id: string | null } | null;
  if (!tenant?.stripe_customer_id) {
    res.json(null);
    return;
  }

  const paymentMethods = await stripeClient.paymentMethods.list({
    customer: tenant.stripe_customer_id,
    type: "card",
    limit: 1,
  });

  const pm = paymentMethods.data[0];
  if (!pm) { res.json(null); return; }

  res.json({
    brand: pm.card?.brand,
    last4: pm.card?.last4,
    exp_month: pm.card?.exp_month,
    exp_year: pm.card?.exp_year,
  });
});

const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";

router.post("/me/switch-to-free", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: tenantRaw } = await supabaseAdmin
    .from("tenants")
    .select("id, status, plan_id")
    .eq("id", req.tenantId!)
    .single();
  const tenant = tenantRaw as { id: string; status: string; plan_id: string | null } | null;

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  if (tenant.status !== "trial") {
    res.status(400).json({ error: "Only trial accounts can switch to the free plan" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("tenants")
    .update({
      plan_id: FREE_PLAN_ID,
      status: "active" as const,
      trial_ends_at: null,
    } as Record<string, unknown>)
    .eq("id", req.tenantId!);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await (supabaseAdmin.from("platform_audit_log") as unknown as { insert: (v: Record<string, unknown>) => Promise<unknown> }).insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "switched_to_free_plan",
    entity_type: "tenant",
    entity_id: req.tenantId,
    detail: { previous_status: tenant.status, previous_plan_id: tenant.plan_id },
  });

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Usage credit management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/billing/credits
 * Returns credit balances for all usage-based addons this tenant has access to.
 */
router.get("/billing/credits", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  // Only show credits for addons the tenant is actively subscribed to
  const { data: activeSubscriptions } = await supabaseAdmin
    .from("tenant_addons")
    .select("addon_id")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  if (!activeSubscriptions || activeSubscriptions.length === 0) { res.json([]); return; }

  const subscribedAddonIds = (activeSubscriptions as { addon_id: string }[]).map(a => a.addon_id);

  const { data: usageAddons } = await supabaseAdmin
    .from("addons")
    .select("id, name, description, feature_keys, usage_unit_label, usage_bundle_size, usage_bundle_price")
    .eq("billing_model", "usage")
    .eq("is_active", true)
    .in("id", subscribedAddonIds)
    .order("sort_order");

  if (!usageAddons || usageAddons.length === 0) { res.json([]); return; }

  const addonIds = (usageAddons as { id: string }[]).map(a => a.id);

  const { data: credits } = await supabaseAdmin
    .from("tenant_addon_credits")
    .select("addon_id, credits_remaining, total_purchased, updated_at")
    .eq("tenant_id", req.tenantId!)
    .in("addon_id", addonIds);

  const creditMap = new Map<string, { credits_remaining: number; total_purchased: number; updated_at: string }>();
  for (const c of (credits ?? []) as { addon_id: string; credits_remaining: number; total_purchased: number; updated_at: string }[]) {
    creditMap.set(c.addon_id, c);
  }

  const result = (usageAddons as Record<string, unknown>[]).map(a => ({
    ...a,
    credits_remaining: creditMap.get(a.id as string)?.credits_remaining ?? 0,
    total_purchased: creditMap.get(a.id as string)?.total_purchased ?? 0,
    last_topped_up: creditMap.get(a.id as string)?.updated_at ?? null,
  }));

  res.json(result);
});

/**
 * POST /api/billing/credits/:addonId/buy
 * Body: { bundles: number }  — number of bundles to purchase
 * Deducts via Stripe if active subscription; always updates credit balance.
 */
router.post("/billing/credits/:addonId/buy", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { addonId } = req.params;
  const bundles = Math.max(1, Math.floor(Number(req.body.bundles) || 1));

  const { data: addonRaw } = await supabaseAdmin
    .from("addons")
    .select("id, name, billing_model, usage_bundle_size, usage_bundle_price, stripe_price_id")
    .eq("id", addonId)
    .eq("billing_model", "usage")
    .eq("is_active", true)
    .maybeSingle();

  if (!addonRaw) { res.status(404).json({ error: "Usage-based addon not found" }); return; }
  const addon = addonRaw as { id: string; name: string; usage_bundle_size: number | null; usage_bundle_price: number | null; stripe_price_id: string | null };

  const bundlePrice = addon.usage_bundle_price ?? 10;
  const totalCharge = bundlePrice * bundles;

  // Stripe: charge if tenant has active subscription and addon has a price ID
  const stripeClient = requireStripe(false);
  if (stripeClient && addon.stripe_price_id && totalCharge > 0) {
    const { data: tenantRaw } = await supabaseAdmin
      .from("tenants")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", req.tenantId!)
      .single();
    const tenant = tenantRaw as { stripe_customer_id: string | null; stripe_subscription_id: string | null } | null;

    if (tenant?.stripe_customer_id && tenant?.stripe_subscription_id) {
      try {
        // Create an invoice item so the charge appears on their next invoice
        await stripeClient.invoiceItems.create({
          customer: tenant.stripe_customer_id,
          amount: Math.round(totalCharge * 100), // pence
          currency: "gbp",
          description: `${addon.name} — ${bundles} × ${addon.usage_bundle_size ?? 1000} credits`,
        });
        // Immediately finalise via a one-off invoice
        const invoice = await stripeClient.invoices.create({
          customer: tenant.stripe_customer_id,
          auto_advance: true,
        });
        await stripeClient.invoices.finalizeInvoice(invoice.id);
        await stripeClient.invoices.pay(invoice.id);
      } catch (stripeErr) {
        console.error("[billing/credits/buy] Stripe error:", stripeErr);
        res.status(402).json({ error: "Payment failed. Please check your payment method." });
        return;
      }
    }
  }

  const result = await topUpAddonCredits(req.tenantId!, addonId, bundles);
  res.json({ ok: true, ...result, bundles_purchased: bundles, total_charged: totalCharge });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-service addon management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/billing/storage-usage
 * Returns fresh (uncached) storage stats for the current tenant.
 */
router.get("/billing/storage-usage", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const [usedBytes, limitBytes, fileCountResult] = await Promise.all([
    getStorageUsed(req.tenantId!),
    getEffectiveStorageLimit(req.tenantId!),
    supabaseAdmin.from("file_attachments").select("id", { count: "exact", head: true }).eq("tenant_id", req.tenantId!),
  ]);

  res.json({ used_bytes: usedBytes, file_count: fileCountResult.count ?? 0, limit_bytes: limitBytes });
});

/**
 * GET /api/billing/addons
 * Returns all available addons together with the tenant's current subscription status for each.
 */
router.get("/billing/addons", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const [{ data: addons }, { data: tenantAddons }] = await Promise.all([
    supabaseAdmin
      .from("addons")
      .select("id, name, description, feature_keys, monthly_price, annual_price, is_per_seat, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order"),
    supabaseAdmin
      .from("tenant_addons")
      .select("addon_id, is_active, quantity, stripe_subscription_item_id")
      .eq("tenant_id", req.tenantId!),
  ]);

  const tenantAddonMap = new Map<string, { is_active: boolean; quantity: number; stripe_subscription_item_id: string | null }>();
  for (const ta of (tenantAddons ?? []) as { addon_id: string; is_active: boolean; quantity: number; stripe_subscription_item_id: string | null }[]) {
    tenantAddonMap.set(ta.addon_id, ta);
  }

  const result = (addons ?? []).map((a: Record<string, unknown>) => ({
    ...(a as object),
    subscribed: tenantAddonMap.get(a.id as string)?.is_active ?? false,
    quantity: tenantAddonMap.get(a.id as string)?.quantity ?? 0,
  }));

  res.json(result);
});

/**
 * POST /api/billing/addons/:addonId/subscribe
 * Subscribe the tenant to an addon. Updates Stripe if subscription exists.
 */
router.post("/billing/addons/:addonId/subscribe", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { addonId } = req.params;

  const { data: addon } = await supabaseAdmin
    .from("addons")
    .select("id, name, monthly_price, stripe_price_id, is_active")
    .eq("id", addonId)
    .eq("is_active", true)
    .maybeSingle();

  if (!addon) { res.status(404).json({ error: "Addon not found or inactive" }); return; }

  // Upsert tenant_addon row
  const { error: upsertError } = await supabaseAdmin
    .from("tenant_addons")
    .upsert(
      {
        tenant_id: req.tenantId!,
        addon_id: addonId,
        is_active: true,
        quantity: 1,
        activated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      { onConflict: "tenant_id,addon_id" }
    );

  if (upsertError) {
    console.error("[billing/subscribe] upsert error:", upsertError);
    res.status(500).json({ error: upsertError.message }); return;
  }

  // Bust init cache so features activate immediately
  if (req.tenantId) bustInitCache(req.tenantId);

  // Stripe: add subscription item if tenant has an active subscription and addon has a price ID
  const stripeClient = requireStripe(false);
  const addonRow = addon as { stripe_price_id: string | null };
  if (stripeClient && addonRow.stripe_price_id) {
    const { data: tenantRaw } = await supabaseAdmin
      .from("tenants")
      .select("stripe_subscription_id")
      .eq("id", req.tenantId!)
      .single();
    const stripeSubId = (tenantRaw as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;

    if (stripeSubId) {
      try {
        const item = await stripeClient.subscriptionItems.create({
          subscription: stripeSubId,
          price: addonRow.stripe_price_id,
          quantity: 1,
          proration_behavior: "always_invoice",
        });
        await supabaseAdmin
          .from("tenant_addons")
          .update({ stripe_subscription_item_id: item.id } as Record<string, unknown>)
          .eq("tenant_id", req.tenantId!)
          .eq("addon_id", addonId);
      } catch (stripeErr) {
        console.error("[billing/addons/subscribe] Stripe error:", stripeErr);
        // Non-fatal: DB is already updated
      }
    }
  }

  res.json({ success: true });
});

/**
 * DELETE /api/billing/addons/:addonId/subscribe
 * Unsubscribe the tenant from an addon. Updates Stripe if subscription item exists.
 */
router.delete("/billing/addons/:addonId/subscribe", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { addonId } = req.params;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("tenant_addons")
    .select("id, stripe_subscription_item_id")
    .eq("tenant_id", req.tenantId!)
    .eq("addon_id", addonId)
    .maybeSingle();

  if (fetchError) {
    console.error("[billing/addons/unsubscribe] fetch error:", fetchError);
    res.status(500).json({ error: fetchError.message }); return;
  }

  // Idempotent: if no row exists the addon is already inactive — succeed silently
  if (!existing) {
    res.json({ success: true }); return;
  }

  const row = existing as { id: string; stripe_subscription_item_id: string | null };

  const { error } = await supabaseAdmin
    .from("tenant_addons")
    .update({ is_active: false, deactivated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("tenant_id", req.tenantId!)
    .eq("addon_id", addonId);

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Bust init cache so features deactivate immediately
  if (req.tenantId) bustInitCache(req.tenantId);

  // Stripe: remove subscription item
  if (row.stripe_subscription_item_id) {
    const stripeClient = requireStripe(false);
    if (stripeClient) {
      try {
        await stripeClient.subscriptionItems.del(row.stripe_subscription_item_id, {
          proration_behavior: "always_invoice",
        });
        await supabaseAdmin
          .from("tenant_addons")
          .update({ stripe_subscription_item_id: null } as Record<string, unknown>)
          .eq("tenant_id", req.tenantId!)
          .eq("addon_id", addonId);
      } catch (stripeErr) {
        console.error("[billing/addons/unsubscribe] Stripe error:", stripeErr);
      }
    }
  }

  res.json({ success: true });
});

export default router;
