import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { stripe } from "../lib/stripe";
import {
  sendTrialExpiryReminder,
  sendRenewalReminder,
} from "../lib/email";

const router = Router();

const APP_URL = process.env.APP_URL || "https://boilertech.app";
const BILLING_URL = `${APP_URL}/billing`;

function requireCronSecret(req: Request, res: Response): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const provided = req.headers["x-cron-secret"];
  if (!secret || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/internal/send-trial-reminders", async (req: Request, res: Response): Promise<void> => {
  if (!requireCronSecret(req, res)) return;

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
  const in1 = new Date(now.getTime() + 1 * 86400000).toISOString().split("T")[0];

  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, company_name, contact_email, trial_ends_at")
    .eq("status", "trial")
    .not("contact_email", "is", null);

  const results: Array<{ id: string; email: string; days: number; sent: boolean }> = [];
  let successCount = 0;

  for (const tenant of tenants || []) {
    if (!tenant.contact_email || !tenant.trial_ends_at) continue;
    const endsDate = new Date(tenant.trial_ends_at).toISOString().split("T")[0];
    let daysLeft: number | null = null;
    if (endsDate === in7) daysLeft = 7;
    else if (endsDate === in1) daysLeft = 1;
    if (daysLeft === null) continue;

    try {
      await sendTrialExpiryReminder(tenant.contact_email, tenant.company_name, daysLeft, BILLING_URL);
      results.push({ id: tenant.id, email: tenant.contact_email, days: daysLeft, sent: true });
      successCount++;
    } catch {
      results.push({ id: tenant.id, email: tenant.contact_email, days: daysLeft, sent: false });
    }
  }

  res.json({ sent: successCount, results });
});

router.get("/internal/send-renewal-reminders", async (req: Request, res: Response): Promise<void> => {
  if (!requireCronSecret(req, res)) return;

  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, company_name, contact_email, subscription_renewal_at, stripe_subscription_id, plans(monthly_price)")
    .eq("status", "active")
    .not("contact_email", "is", null)
    .not("subscription_renewal_at", "is", null);

  const results: Array<{ id: string; email: string; sent: boolean }> = [];
  let successCount = 0;

  for (const tenant of (tenants || []) as Array<{
    id: string;
    company_name: string;
    contact_email: string | null;
    subscription_renewal_at: string | null;
    stripe_subscription_id?: string | null;
    plans?: { monthly_price?: number } | null;
  }>) {
    if (!tenant.contact_email || !tenant.subscription_renewal_at) continue;
    const renewalDate = new Date(tenant.subscription_renewal_at).toISOString().split("T")[0];
    if (renewalDate !== in3) continue;

    let amount = Math.round((tenant.plans?.monthly_price || 0) * 100);
    let currency = "gbp";

    if (stripe && tenant.stripe_subscription_id) {
      try {
        const upcoming = await stripe.invoices.retrieveUpcoming({
          subscription: tenant.stripe_subscription_id,
        });
        amount = upcoming.amount_due;
        currency = upcoming.currency;
      } catch (err) {
        console.warn(`[renewal-reminder] Failed to fetch upcoming invoice for ${tenant.id}, falling back to plan price:`, err);
      }
    }

    try {
      await sendRenewalReminder(
        tenant.contact_email,
        tenant.company_name,
        tenant.subscription_renewal_at,
        amount,
        currency,
        BILLING_URL,
      );
      results.push({ id: tenant.id, email: tenant.contact_email, sent: true });
      successCount++;
    } catch {
      results.push({ id: tenant.id, email: tenant.contact_email, sent: false });
    }
  }

  res.json({ sent: successCount, results });
});

export default router;
