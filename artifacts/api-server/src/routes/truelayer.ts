import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const TL_ENV = process.env.TRUELAYER_ENV || (process.env.NODE_ENV === "production" ? "live" : "sandbox");
export const TL_AUTH_BASE = TL_ENV === "live"
  ? "https://auth.truelayer.com"
  : "https://auth.truelayer-sandbox.com";
export const TL_API_BASE = TL_ENV === "live"
  ? "https://api.truelayer.com"
  : "https://api.truelayer-sandbox.com";
export const TL_PAY_BASE = TL_ENV === "live"
  ? "https://payment.truelayer.com"
  : "https://payment.truelayer-sandbox.com";

// ── Internal helpers ─────────────────────────────────────────────────────────

export async function getTrueLayerToken(): Promise<string> {
  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("TrueLayer platform credentials not configured");

  const res = await fetch(`${TL_AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "payments",
    }),
  });
  if (!res.ok) throw new Error(`TrueLayer auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ── GET /admin/truelayer/status ───────────────────────────────────────────────
router.get(
  "/admin/truelayer/status",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const available = !!(process.env.TRUELAYER_CLIENT_ID && process.env.TRUELAYER_CLIENT_SECRET);
    if (!available) { res.json({ available: false, connected: false }); return; }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("truelayer_sort_code, truelayer_account_number, truelayer_account_holder_name, truelayer_enabled")
      .eq("id", req.tenantId!)
      .single();

    const t = tenant as any;
    res.json({
      available: true,
      connected: !!(t?.truelayer_account_number && t?.truelayer_sort_code && t?.truelayer_account_holder_name && t?.truelayer_enabled),
      sort_code: t?.truelayer_sort_code ? `${t.truelayer_sort_code.slice(0, 2)}-${t.truelayer_sort_code.slice(2, 4)}-${t.truelayer_sort_code.slice(4, 6)}` : null,
      account_number: t?.truelayer_account_number ? `****${t.truelayer_account_number.slice(-4)}` : null,
      account_holder_name: t?.truelayer_account_holder_name ?? null,
    });
  },
);

// ── POST /admin/truelayer/bank-account ───────────────────────────────────────
// Tenant provides their UK bank account as the beneficiary for TrueLayer payments.
router.post(
  "/admin/truelayer/bank-account",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { sort_code, account_number, account_holder_name } = req.body as {
      sort_code?: string;
      account_number?: string;
      account_holder_name?: string;
    };

    if (!sort_code?.trim() || !account_number?.trim() || !account_holder_name?.trim()) {
      res.status(400).json({ error: "sort_code, account_number, and account_holder_name are required" });
      return;
    }
    if (!(process.env.TRUELAYER_CLIENT_ID && process.env.TRUELAYER_CLIENT_SECRET)) {
      res.status(400).json({ error: "TrueLayer is not available on this platform" });
      return;
    }

    const cleanSort = sort_code.replace(/[-\s]/g, "");
    const cleanAccount = account_number.replace(/\s/g, "");

    if (!/^\d{6}$/.test(cleanSort)) {
      res.status(400).json({ error: "Sort code must be 6 digits (e.g. 12-34-56)" });
      return;
    }
    if (!/^\d{8}$/.test(cleanAccount)) {
      res.status(400).json({ error: "Account number must be 8 digits" });
      return;
    }

    await supabaseAdmin
      .from("tenants")
      .update({
        truelayer_sort_code: cleanSort,
        truelayer_account_number: cleanAccount,
        truelayer_account_holder_name: account_holder_name.trim(),
        truelayer_enabled: true,
      } as Record<string, unknown>)
      .eq("id", req.tenantId!);

    res.json({ success: true });
  },
);

// ── DELETE /admin/truelayer ───────────────────────────────────────────────────
router.delete(
  "/admin/truelayer",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await supabaseAdmin
      .from("tenants")
      .update({
        truelayer_sort_code: null,
        truelayer_account_number: null,
        truelayer_account_holder_name: null,
        truelayer_enabled: false,
      } as Record<string, unknown>)
      .eq("id", req.tenantId!);
    res.json({ success: true });
  },
);

export default router;
