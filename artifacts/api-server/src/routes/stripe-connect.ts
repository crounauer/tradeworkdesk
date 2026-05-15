import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { requireStripe } from "../lib/stripe";

const router: IRouter = Router();

const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";

// ── GET /admin/stripe-connect/status ────────────────────────────────────────
// Returns current Stripe Connect status for the tenant.

router.get(
  "/admin/stripe-connect/status",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", req.tenantId!)
      .single();

    const accountId = (tenant as any)?.stripe_connect_account_id as string | null;
    const chargesEnabled = !!(tenant as any)?.stripe_connect_charges_enabled;

    if (!accountId) {
      res.json({ connected: false });
      return;
    }

    // If we already know charges are enabled, skip the Stripe API call
    if (chargesEnabled) {
      res.json({ connected: true, charges_enabled: true, account_id: accountId });
      return;
    }

    // Refresh charges_enabled from Stripe
    try {
      const stripe = requireStripe(false);
      if (stripe) {
        const account = await stripe.accounts.retrieve(accountId);
        const enabled = account.charges_enabled ?? false;
        if (enabled && !chargesEnabled) {
          await supabaseAdmin
            .from("tenants")
            .update({ stripe_connect_charges_enabled: true } as Record<string, unknown>)
            .eq("id", req.tenantId!);
        }
        res.json({ connected: true, charges_enabled: enabled, account_id: accountId });
      } else {
        res.json({ connected: true, charges_enabled: chargesEnabled, account_id: accountId });
      }
    } catch {
      res.json({ connected: true, charges_enabled: chargesEnabled, account_id: accountId });
    }
  }
);

// ── GET /admin/stripe-connect/authorize ──────────────────────────────────────
// Creates (or reuses) a Stripe Standard account and returns an Account Link URL
// for hosted onboarding. No OAuth client ID required.

router.get(
  "/admin/stripe-connect/authorize",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const stripe = requireStripe();

      // Get or create Stripe Standard account for this tenant
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("stripe_connect_account_id")
        .eq("id", req.tenantId!)
        .single();

      let accountId = (tenant as any)?.stripe_connect_account_id as string | null;

      if (!accountId) {
        const account = await stripe.accounts.create({ type: "standard" });
        accountId = account.id;
        await supabaseAdmin
          .from("tenants")
          .update({ stripe_connect_account_id: accountId } as Record<string, unknown>)
          .eq("id", req.tenantId!);
        console.log(`[stripe-connect] Created account ${accountId} for tenant ${req.tenantId}`);
      }

      // Create Account Link for Stripe-hosted onboarding
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${APP_URL}/admin/stripe-connect`,
        return_url: `${APP_URL}/admin/stripe-connect?success=1`,
        type: "account_onboarding",
      });

      res.json({ url: accountLink.url });
    } catch (err) {
      console.error("[stripe-connect] Authorize error:", err);
      res.status(500).json({ error: "Failed to start Stripe Connect flow" });
    }
  }
);

// ── DELETE /admin/stripe-connect ─────────────────────────────────────────────
// Disconnects the tenant's Stripe account.

router.delete(
  "/admin/stripe-connect",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("stripe_connect_account_id")
      .eq("id", req.tenantId!)
      .single();

    const accountId = (tenant as any)?.stripe_connect_account_id as string | null;

    if (accountId) {
      console.log(`[stripe-connect] Disconnecting account ${accountId} for tenant ${req.tenantId}`);
    }

    await supabaseAdmin
      .from("tenants")
      .update({
        stripe_connect_account_id: null,
        stripe_connect_charges_enabled: false,
      } as Record<string, unknown>)
      .eq("id", req.tenantId!);

    res.json({ ok: true });
  }
);

export default router;
