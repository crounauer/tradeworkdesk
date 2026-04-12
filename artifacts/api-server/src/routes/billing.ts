import { Router } from "express";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { requireStripe } from "../lib/stripe";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";

router.post("/billing/checkout", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { plan_id, billing_cycle = "monthly", addon_ids = [], addon_quantities = {} } = req.body as {
    plan_id?: string;
    billing_cycle?: string;
    addon_ids?: string[];
    addon_quantities?: Record<string, number>;
  };

  const stripeClient = requireStripe();

  let plan;
  if (plan_id) {
    const { data } = await supabaseAdmin.from("plans").select("*").eq("id", plan_id).eq("is_active", true).single();
    if (data && (data as Record<string, unknown>).is_legacy) {
      res.status(400).json({ error: "This plan is no longer available. Please use the current base plan." });
      return;
    }
    plan = data;
  }
  if (!plan) {
    const { data } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .eq("is_legacy", false)
      .order("monthly_price", { ascending: true })
      .limit(1)
      .maybeSingle();
    plan = data;
  }
  if (!plan) { res.status(404).json({ error: "No base plan found" }); return; }

  const { data: tenant } = await supabaseAdmin.from("tenants").select("*").eq("id", req.tenantId!).single();
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const isSoleTrader = tenant.company_type === "sole_trader";
  let priceId: string | null;
  if (isSoleTrader && billing_cycle === "annual" && plan.stripe_sole_trader_price_id_annual) {
    priceId = plan.stripe_sole_trader_price_id_annual;
  } else if (isSoleTrader && plan.stripe_sole_trader_price_id) {
    priceId = plan.stripe_sole_trader_price_id;
  } else {
    priceId = billing_cycle === "annual" ? plan.stripe_price_id_annual : plan.stripe_price_id;
  }
  if (!priceId) {
    res.status(400).json({ error: `No Stripe price configured for this plan (${billing_cycle})` });
    return;
  }

  let customerId: string | undefined = tenant.stripe_customer_id;

  if (!customerId) {
    const customer = await stripeClient.customers.create({
      email: tenant.contact_email || req.userEmail,
      name: tenant.company_name,
      metadata: { tenant_id: req.tenantId! },
    });
    customerId = customer.id;
    await supabaseAdmin.from("tenants").update({ stripe_customer_id: customerId }).eq("id", req.tenantId!);
  }

  const lineItems: Array<{ price: string; quantity: number }> = [{ price: priceId, quantity: 1 }];

  const validatedAddonIds: string[] = [];
  if (Array.isArray(addon_ids) && addon_ids.length > 0) {
    const { data: addons } = await supabaseAdmin
      .from("addons")
      .select("*")
      .in("id", addon_ids)
      .eq("is_active", true);

    if (addons) {
      for (const addon of addons) {
        const addonPriceId = billing_cycle === "annual" ? addon.stripe_price_id_annual : addon.stripe_price_id;
        if (addonPriceId) {
          const qty = addon.is_per_seat ? Math.max(1, Math.floor(addon_quantities?.[addon.id] || 1)) : 1;
          lineItems.push({ price: addonPriceId, quantity: qty });
          validatedAddonIds.push(addon.id);
        }
      }
    }
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
      billing_cycle,
    },
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

router.get("/billing/portal", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const stripeClient = requireStripe();

  const { data: tenant } = await supabaseAdmin.from("tenants").select("stripe_customer_id").eq("id", req.tenantId!).single();
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

  const { data: tenant } = await supabaseAdmin.from("tenants").select("stripe_customer_id").eq("id", req.tenantId!).single();
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

export default router;
