import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { encryptToken, decryptToken, isEncryptionConfigured } from "../lib/accounting/crypto";

const router: IRouter = Router();

export const PP_BASE = process.env.PAYPAL_ENV === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

// ── Internal helpers ─────────────────────────────────────────────────────────

export async function getPayPalAccessToken(clientId: string, secret: string): Promise<string> {
  const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`PayPal auth failed ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function decryptPayPalCreds(
  tenantId: string,
): Promise<{ clientId: string; secret: string } | null> {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("paypal_client_id, paypal_client_secret")
    .eq("id", tenantId)
    .single();

  const raw = tenant as any;
  if (!raw?.paypal_client_id || !raw?.paypal_client_secret) return null;

  try {
    return {
      clientId: decryptToken(raw.paypal_client_id),
      secret: decryptToken(raw.paypal_client_secret),
    };
  } catch {
    return null;
  }
}

// ── GET /admin/paypal/status ─────────────────────────────────────────────────
router.get(
  "/admin/paypal/status",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("paypal_client_id")
      .eq("id", req.tenantId!)
      .single();

    res.json({ connected: !!(tenant as any)?.paypal_client_id });
  },
);

// ── POST /admin/paypal/credentials ──────────────────────────────────────────
// Tenant enters their own PayPal Business Client ID + Secret.
router.post(
  "/admin/paypal/credentials",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { client_id, client_secret } = req.body as { client_id?: string; client_secret?: string };

    if (!client_id?.trim() || !client_secret?.trim()) {
      res.status(400).json({ error: "client_id and client_secret are required" });
      return;
    }
    if (!isEncryptionConfigured()) {
      res.status(500).json({ error: "Encryption key is not configured on this server" });
      return;
    }

    // Verify credentials work before saving
    try {
      await getPayPalAccessToken(client_id.trim(), client_secret.trim());
    } catch {
      res.status(400).json({ error: "Invalid PayPal credentials — authentication failed. Check your Client ID and Secret." });
      return;
    }

    await supabaseAdmin
      .from("tenants")
      .update({
        paypal_client_id: encryptToken(client_id.trim()),
        paypal_client_secret: encryptToken(client_secret.trim()),
      } as Record<string, unknown>)
      .eq("id", req.tenantId!);

    res.json({ success: true });
  },
);

// ── DELETE /admin/paypal ──────────────────────────────────────────────────────
router.delete(
  "/admin/paypal",
  requireAuth, requireTenant, requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await supabaseAdmin
      .from("tenants")
      .update({ paypal_client_id: null, paypal_client_secret: null, paypal_webhook_id: null } as Record<string, unknown>)
      .eq("id", req.tenantId!);
    res.json({ success: true });
  },
);

export default router;
