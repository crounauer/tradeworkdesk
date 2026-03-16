import { Router } from "express";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { requireStripe } from "../lib/stripe";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

const APP_URL = process.env.APP_URL || "https://boilertech.app";

router.post("/billing/checkout", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { plan_id, billing_cycle = "monthly" } = req.body;
  if (!plan_id) { res.status(400).json({ error: "plan_id is required" }); return; }

  const stripeClient = requireStripe();

  const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", plan_id).single();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

  const priceId = billing_cycle === "annual" ? plan.stripe_price_id_annual : plan.stripe_price_id;
  if (!priceId) {
    res.status(400).json({ error: `No Stripe price configured for this plan (${billing_cycle})` });
    return;
  }

  const { data: tenant } = await supabaseAdmin.from("tenants").select("*").eq("id", req.tenantId!).single();
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

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

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?success=1`,
    cancel_url: `${APP_URL}/billing?cancelled=1`,
    metadata: { tenant_id: req.tenantId!, plan_id, billing_cycle },
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
