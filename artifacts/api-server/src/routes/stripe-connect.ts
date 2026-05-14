import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { requireStripe } from "../lib/stripe";
import { getPlatformSetting } from "../lib/geocode";

const router: IRouter = Router();

const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";

// In-memory CSRF state store (same pattern as accounting-integrations)
const pendingOAuthStates = new Map<string, { tenantId: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingOAuthStates) {
    if (val.expiresAt < now) pendingOAuthStates.delete(key);
  }
}, 60_000);

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
// Returns the Stripe OAuth URL to start the Connect flow.

router.get(
  "/admin/stripe-connect/authorize",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const clientId = await getPlatformSetting("stripe_client_id", "STRIPE_CLIENT_ID").catch(() => null);
    if (!clientId) {
      res.status(500).json({ error: "STRIPE_CLIENT_ID is not configured" });
      return;
    }

    const state = crypto.randomBytes(16).toString("hex");
    pendingOAuthStates.set(state, { tenantId: req.tenantId!, expiresAt: Date.now() + 10 * 60_000 });

    const redirectUri = `${APP_URL}/api/admin/stripe-connect/callback`;
    const url = new URL("https://connect.stripe.com/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", "read_write");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", redirectUri);

    res.json({ url: url.toString() });
  }
);

// ── GET /admin/stripe-connect/callback ───────────────────────────────────────
// OAuth callback from Stripe. Exchanges code for account ID and saves it.

router.get(
  "/admin/stripe-connect/callback",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { code, state, error: oauthError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (oauthError) {
      console.error("[stripe-connect] OAuth error:", oauthError);
      res.redirect(`${APP_URL}/admin/stripe-connect?error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!state || !code) {
      res.redirect(`${APP_URL}/admin/stripe-connect?error=missing_params`);
      return;
    }

    const pending = pendingOAuthStates.get(state);
    if (!pending || pending.expiresAt < Date.now()) {
      res.redirect(`${APP_URL}/admin/stripe-connect?error=invalid_state`);
      return;
    }
    pendingOAuthStates.delete(state);
    const { tenantId } = pending;

    try {
      const stripe = requireStripe();
      const response = await stripe.oauth.token({ grant_type: "authorization_code", code });
      const accountId = response.stripe_user_id;

      if (!accountId) {
        res.redirect(`${APP_URL}/admin/stripe-connect?error=no_account_id`);
        return;
      }

      // Fetch account to check charges_enabled
      let chargesEnabled = false;
      try {
        const account = await stripe.accounts.retrieve(accountId);
        chargesEnabled = account.charges_enabled ?? false;
      } catch { /* non-fatal */ }

      await supabaseAdmin
        .from("tenants")
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_charges_enabled: chargesEnabled,
        } as Record<string, unknown>)
        .eq("id", tenantId);

      console.log(`[stripe-connect] Connected account ${accountId} for tenant ${tenantId}`);
      res.redirect(`${APP_URL}/admin/stripe-connect?success=1`);
    } catch (err) {
      console.error("[stripe-connect] Token exchange failed:", err);
      res.redirect(`${APP_URL}/admin/stripe-connect?error=token_exchange_failed`);
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
      try {
        const stripe = requireStripe(false);
        if (stripe) {
          const stripeClientId = await getPlatformSetting("stripe_client_id", "STRIPE_CLIENT_ID").catch(() => null);
          if (stripeClientId) {
            await stripe.oauth.deauthorize({ client_id: stripeClientId, stripe_user_id: accountId });
          }
        }
      } catch (err) {
        // Non-fatal — Stripe may already have disconnected
        console.warn("[stripe-connect] Deauthorize warning:", (err as Error).message);
      }
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
