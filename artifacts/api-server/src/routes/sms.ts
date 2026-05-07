import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { hasActiveAddon, hasUserAddon, deductAddonCredit, getAddonCredits } from "../lib/tenant-limits";
import { supabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();

// ──────────────────────────────────────────────────────────────
// SMS Works helpers
// ──────────────────────────────────────────────────────────────

async function getSmsWorksCredentials(): Promise<{ customerId: string; apiKey: string } | null> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["sms_works_customer_id", "sms_works_api_key"]);

  if (!data || data.length < 2) return null;

  const map: Record<string, string> = {};
  for (const row of data as { key: string; value: string }[]) {
    map[row.key] = row.value;
  }

  if (!map["sms_works_customer_id"] || !map["sms_works_api_key"]) return null;
  return { customerId: map["sms_works_customer_id"], apiKey: map["sms_works_api_key"] };
}

async function getSmsWorksJwt(customerId: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.thesmsworks.co.uk/v1/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerid: customerId, key: apiKey }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SMS Works auth failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { token: string };
  if (!data.token) throw new Error("SMS Works returned no token");
  return data.token;
}

// ──────────────────────────────────────────────────────────────
// POST /api/sms/send
// ──────────────────────────────────────────────────────────────
router.post("/sms/send", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { destination, content, sender_id, job_id, customer_id } = req.body as {
    destination?: string;
    content?: string;
    sender_id?: string;
    job_id?: string;
    customer_id?: string;
  };

  if (!destination || typeof destination !== "string") {
    res.status(400).json({ error: "destination is required" });
    return;
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  // Tenant-level addon check
  const tenantHasAddon = await hasActiveAddon(req.tenantId!, "sms_messaging");
  if (!tenantHasAddon) {
    res.status(402).json({ error: "SMS Messaging add-on required. Contact your administrator to activate this feature." });
    return;
  }

  // Per-user addon check (super_admin bypasses)
  if (req.userRole !== "super_admin") {
    const userHasAddon = await hasUserAddon(req.tenantId!, req.userId!, "sms_messaging");
    if (!userHasAddon) {
      res.status(402).json({ error: "SMS Messaging is not assigned to your account. Ask your administrator to assign it." });
      return;
    }
  }

  // Credit check
  const creditInfo = await getAddonCredits(req.tenantId!, "sms_messaging");
  if (creditInfo !== null && creditInfo.credits_remaining <= 0) {
    res.status(402).json({
      error: "No SMS credits remaining. Purchase more credits on the Billing page.",
      credits_remaining: 0,
      bundle_size: creditInfo.bundle_size,
      bundle_price: creditInfo.bundle_price,
    });
    return;
  }

  const creds = await getSmsWorksCredentials();
  if (!creds) {
    res.status(503).json({ error: "SMS not configured. Contact platform support." });
    return;
  }

  const senderId = (sender_id || "TradeWork").slice(0, 11); // SMS Works max 11 chars

  let messageId: string | null = null;
  let status = "sent";
  let creditsUsed: number | null = null;
  let sendError: string | null = null;

  try {
    const token = await getSmsWorksJwt(creds.customerId, creds.apiKey);

    const smsRes = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `JWT ${token}`,
      },
      body: JSON.stringify({
        sender: senderId,
        destination: destination.replace(/\s/g, ""),
        content: content.trim(),
      }),
    });

    const smsBody = await smsRes.json() as { messageid?: string; credits?: number; status?: string; error?: string };
    if (!smsRes.ok) {
      status = "failed";
      sendError = smsBody.error ?? `HTTP ${smsRes.status}`;
    } else {
      messageId = smsBody.messageid ?? null;
      creditsUsed = smsBody.credits ?? null;
    }
  } catch (err) {
    status = "failed";
    sendError = err instanceof Error ? err.message : "Send failed";
  }

  // Record in sms_messages regardless of send success
  const { data: record, error: insertError } = await supabaseAdmin
    .from("sms_messages")
    .insert({
      tenant_id: req.tenantId!,
      sent_by_user_id: req.userId!,
      destination: destination.trim(),
      content: content.trim(),
      sender_id: senderId,
      sms_works_message_id: messageId,
      status,
      credits_used: creditsUsed,
      job_id: job_id || null,
      customer_id: customer_id || null,
    } as Record<string, unknown>)
    .select("id, status, sms_works_message_id")
    .single();

  if (insertError) {
    res.status(500).json({ error: "Message sent but failed to record" });
    return;
  }

  if (status === "failed") {
    res.status(502).json({ error: sendError ?? "Send failed", record });
    return;
  }

  // Deduct one credit on success
  await deductAddonCredit(req.tenantId!, "sms_messaging");

  res.json({ ok: true, message_id: messageId, record });
});

// ──────────────────────────────────────────────────────────────
// GET /api/sms/messages — paginated history for this tenant
// ──────────────────────────────────────────────────────────────
router.get("/sms/messages", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
  const offset = (page - 1) * limit;
  const jobId = req.query.job_id as string | undefined;
  const customerId = req.query.customer_id as string | undefined;

  let query = supabaseAdmin
    .from("sms_messages")
    .select("id, destination, content, sender_id, status, credits_used, sms_works_message_id, job_id, customer_id, created_at, profiles(id, full_name)", { count: "exact" })
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (jobId) query = query.eq("job_id", jobId);
  if (customerId) query = query.eq("customer_id", customerId);

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ data, total: count ?? 0, page, limit });
});

export default router;
