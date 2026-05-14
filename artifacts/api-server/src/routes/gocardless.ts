import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { encryptToken, decryptToken, isEncryptionConfigured } from "../lib/accounting/crypto";
import { getPlatformSetting } from "../lib/geocode";

const router: IRouter = Router();
const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";

// Use sandbox in non-production unless overridden
const GC_ENV = process.env.GOCARDLESS_ENV || (process.env.NODE_ENV === "production" ? "live" : "sandbox");
export const GC_API_BASE = GC_ENV === "live"
  ? "https://api.gocardless.com"
  : "https://api-sandbox.gocardless.com";
const GC_OAUTH_BASE = GC_ENV === "live"
  ? "https://connect.gocardless.com"
  : "https://connect-sandbox.gocardless.com";
const GC_VERSION = "2015-07-06";

export function gcHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "GoCardless-Version": GC_VERSION,
    "Content-Type": "application/json",
  };
}

export async function gcRequest<T = unknown>(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${GC_API_BASE}${path}`, {
    method,
    headers: gcHeaders(accessToken),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`GoCardless API ${res.status}: ${JSON.stringify(errBody)}`);
  }
  return res.json() as Promise<T>;
}

// ── CSRF state ───────────────────────────────────────────────────────────────
const pendingStates = new Map<string, { tenantId: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) if (v.expiresAt < now) pendingStates.delete(k);
}, 60_000);

// ── GET /admin/gocardless/status ─────────────────────────────────────────────
router.get(
  "/admin/gocardless/status",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const clientId = await getPlatformSetting("gocardless_client_id", "GOCARDLESS_CLIENT_ID").catch(() => null);
    if (!clientId) { res.json({ available: false, connected: false }); return; }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("gocardless_organisation_id, gocardless_access_token")
      .eq("id", req.tenantId!)
      .single();

    const orgId = (tenant as any)?.gocardless_organisation_id as string | null;
    if (!orgId) { res.json({ available: true, connected: false }); return; }
    res.json({ available: true, connected: true, organisation_id: orgId });
  },
);

// ── GET /admin/gocardless/authorize ──────────────────────────────────────────
router.get(
  "/admin/gocardless/authorize",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const clientId = await getPlatformSetting("gocardless_client_id", "GOCARDLESS_CLIENT_ID").catch(() => null);
    if (!clientId) { res.status(500).json({ error: "GOCARDLESS_CLIENT_ID is not configured" }); return; }
    if (!isEncryptionConfigured()) { res.status(500).json({ error: "Encryption key is not configured" }); return; }

    const state = crypto.randomBytes(16).toString("hex");
    pendingStates.set(state, { tenantId: req.tenantId!, expiresAt: Date.now() + 10 * 60_000 });

    const url = new URL(`${GC_OAUTH_BASE}/oauth/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", "read_write");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", `${APP_URL}/api/admin/gocardless/callback`);
    res.json({ url: url.toString() });
  },
);

// ── GET /admin/gocardless/callback ───────────────────────────────────────────
router.get(
  "/admin/gocardless/callback",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { code, state, error: oauthError } = req.query as Record<string, string | undefined>;

    if (oauthError) {
      res.redirect(`${APP_URL}/admin/payment-providers?error=${encodeURIComponent(oauthError)}`);
      return;
    }
    if (!state || !code) {
      res.redirect(`${APP_URL}/admin/payment-providers?error=missing_params`);
      return;
    }
    const pending = pendingStates.get(state);
    if (!pending || pending.expiresAt < Date.now()) {
      res.redirect(`${APP_URL}/admin/payment-providers?error=invalid_state`);
      return;
    }
    pendingStates.delete(state);

    try {
      const [clientId, clientSecret] = await Promise.all([
        getPlatformSetting("gocardless_client_id", "GOCARDLESS_CLIENT_ID"),
        getPlatformSetting("gocardless_client_secret", "GOCARDLESS_CLIENT_SECRET"),
      ]);
      if (!clientId || !clientSecret) throw new Error("GoCardless credentials not configured");
      const tokenRes = await fetch(`${GC_OAUTH_BASE}/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: `${APP_URL}/api/admin/gocardless/callback`,
        }),
      });
      if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
      const tokens = await tokenRes.json() as { access_token: string; organisation_id: string };

      await supabaseAdmin
        .from("tenants")
        .update({
          gocardless_access_token: encryptToken(tokens.access_token),
          gocardless_organisation_id: tokens.organisation_id,
        } as Record<string, unknown>)
        .eq("id", pending.tenantId);

      console.log(`[gocardless] Connected org ${tokens.organisation_id} for tenant ${pending.tenantId}`);
      res.redirect(`${APP_URL}/admin/payment-providers?gc_success=1`);
    } catch (err) {
      console.error("[gocardless] Token exchange failed:", err);
      res.redirect(`${APP_URL}/admin/payment-providers?error=gc_token_failed`);
    }
  },
);

// ── DELETE /admin/gocardless ─────────────────────────────────────────────────
router.delete(
  "/admin/gocardless",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await supabaseAdmin
      .from("tenants")
      .update({ gocardless_access_token: null, gocardless_organisation_id: null } as Record<string, unknown>)
      .eq("id", req.tenantId!);
    res.json({ success: true });
  },
);

export default router;
