import { Router } from "express";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { requireStripe } from "../lib/stripe";
import { supabaseAdmin } from "../lib/supabase";
import { getCurrentUserCount } from "../lib/tenant-limits";

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

export default router;
