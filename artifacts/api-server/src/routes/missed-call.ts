/**
 * Missed Call Text-Back API
 *
 * Authenticated routes (tenant staff):
 *   GET  /api/missed-call/settings         — get settings
 *   PUT  /api/missed-call/settings         — upsert settings
 *   GET  /api/missed-call/logs             — list missed call log
 *
 * Public webhook (called by SMS Works / Twilio on inbound missed call):
 *   POST /api/public/missed-call/webhook   — process incoming missed-call event
 *
 * The webhook looks up the tenant by business_number and sends an SMS reply
 * via the configured provider.
 *
 * SMS Works "Missed Call" webhook sends:
 *   { "caller_id": "+447700900001", "destination": "+447700900002", "timestamp": "..." }
 *
 * Twilio "StatusCallback" for missed calls sends form-encoded:
 *   CallStatus=no-answer, To=+447700900002, From=+447700900001
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import {
  requireAuth,
  requireTenant,
  type AuthenticatedRequest,
} from "../middlewares/auth";
import { notifyUsersForEvent } from "../lib/push-events";

const router: IRouter = Router();
const publicRouter: IRouter = Router();
const db = supabaseAdmin as any;

// ─── Helper: send SMS via SMS Works ─────────────────────────────────────────

async function sendSmsWorksMessage(
  apiKey: string,
  apiSecret: string,
  to: string,
  from: string,
  body: string
): Promise<{ messageId: string | null; error: string | null }> {
  try {
    // Authenticate
    const authRes = await fetch("https://api.thesmsworks.co.uk/v1/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, secret: apiSecret }),
    });
    if (!authRes.ok) return { messageId: null, error: `Auth failed: HTTP ${authRes.status}` };
    const { token } = await authRes.json() as { token: string };

    const sendRes = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({
        sender: from.slice(0, 11),
        destination: to.replace(/\s/g, ""),
        content: body,
      }),
    });
    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return { messageId: null, error: errText };
    }
    const result = await sendRes.json() as { messageid?: string };
    return { messageId: result.messageid ?? null, error: null };
  } catch (e) {
    return { messageId: null, error: String(e) };
  }
}

// ─── Authenticated settings ───────────────────────────────────────────────────

router.get("/missed-call/settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("missed_call_settings")
    .select("*").eq("tenant_id", req.tenantId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? {});
});

router.put("/missed-call/settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("missed_call_settings").upsert(
    { ...fields, tenant_id: req.tenantId },
    { onConflict: "tenant_id" }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get("/missed-call/logs", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { limit = "50" } = req.query as { limit?: string };
  const { data, error } = await db.from("missed_call_logs")
    .select(`
      *,
      customer:customers(first_name, last_name, phone)
    `)
    .eq("tenant_id", req.tenantId)
    .order("received_at", { ascending: false })
    .limit(parseInt(limit));
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ─── Public webhook ───────────────────────────────────────────────────────────

publicRouter.post("/public/missed-call/webhook", async (req: Request, res: Response): Promise<void> => {
  // Normalise caller/destination from both SMS Works and Twilio formats
  let callerNumber: string | null = null;
  let destinationNumber: string | null = null;
  let provider: "smsworks" | "twilio" = "smsworks";

  const body = req.body as Record<string, string>;

  if (body.caller_id) {
    // SMS Works format
    callerNumber = body.caller_id;
    destinationNumber = body.destination ?? null;
    provider = "smsworks";
  } else if (body.From) {
    // Twilio format
    callerNumber = body.From;
    destinationNumber = body.To ?? null;
    provider = "twilio";
    // Only process missed calls (no-answer or busy)
    if (body.CallStatus && !["no-answer", "busy", "failed"].includes(body.CallStatus)) {
      res.status(200).send("OK");
      return;
    }
  }

  if (!callerNumber || !destinationNumber) {
    res.status(400).json({ error: "Missing caller or destination" });
    return;
  }

  // Respond to webhook immediately (avoid timeout)
  res.status(200).send("OK");

  // Look up tenant by business number
  const { data: settings } = await db.from("missed_call_settings")
    .select("*")
    .eq("business_number", destinationNumber)
    .eq("is_enabled", true)
    .maybeSingle();

  if (!settings) return; // no tenant configured for this number

  // Business hours check
  if (settings.business_hours_only) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMins = hours * 60 + minutes;
    const [startH, startM] = (settings.business_start as string).split(":").map(Number);
    const [endH, endM] = (settings.business_end as string).split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    const outsideHours = currentMins < startMins || currentMins > endMins;

    if (outsideHours) {
      await db.from("missed_call_logs").insert({
        tenant_id: settings.tenant_id,
        caller_number: callerNumber,
        response_sent: false,
        suppressed: true,
        suppression_reason: "outside_business_hours",
        message_sent: null,
      });
      return;
    }
  }

  // Try to match caller to a known customer
  const { data: customer } = await db.from("customers")
    .select("id")
    .eq("tenant_id", settings.tenant_id)
    .or(`phone.eq.${callerNumber},mobile.eq.${callerNumber}`)
    .maybeSingle();

  // Build message from template
  const { data: tenant } = await db.from("tenants")
    .select("company_name")
    .eq("id", settings.tenant_id)
    .maybeSingle();
  const companyName: string = tenant?.company_name ?? "Us";
  const message = (settings.message_template as string)
    .replace(/\{\{company_name\}\}/g, companyName);

  // Delay if configured
  if (settings.delay_seconds > 0) {
    await new Promise((r) => setTimeout(r, Math.min(settings.delay_seconds * 1000, 30000)));
  }

  // Get platform SMS credentials
  const { data: platformSettings } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("key, value")
    .in("key", ["sms_works_api_key", "sms_works_secret"]);

  const creds: Record<string, string> = {};
  for (const s of (platformSettings ?? []) as { key: string; value: string }[]) {
    creds[s.key] = s.value;
  }

  let smsRef: string | null = null;
  let sendError: string | null = null;

  if (provider === "smsworks" && creds["sms_works_api_key"] && creds["sms_works_secret"]) {
    const result = await sendSmsWorksMessage(
      creds["sms_works_api_key"],
      creds["sms_works_secret"],
      callerNumber,
      settings.sender_id ?? companyName.slice(0, 11),
      message
    );
    smsRef = result.messageId;
    sendError = result.error;
  }

  // Log the interaction
  await db.from("missed_call_logs").insert({
    tenant_id: settings.tenant_id,
    caller_number: callerNumber,
    response_sent: !sendError,
    response_at: new Date().toISOString(),
    message_sent: message,
    sms_provider_ref: smsRef,
    suppressed: false,
    customer_id: customer?.id ?? null,
  });

  if (sendError) {
    void notifyUsersForEvent({
      tenantId: settings.tenant_id,
      eventType: "system_reliability",
      title: "Missed-Call SMS Failure",
      body: `Auto-reply to ${callerNumber} failed to send.`,
      url: "/missed-call",
      eventKey: `missed_call_sms_failed:${settings.tenant_id}:${callerNumber}:${new Date().toISOString().slice(0, 10)}`,
      targetRoles: ["admin"],
      data: { callerNumber, provider, reason: sendError },
    }).catch((err) => console.error("[push-events] missed call reliability alert failed:", err));
  } else {
    void notifyUsersForEvent({
      tenantId: settings.tenant_id,
      eventType: "customer_communications",
      title: "Missed Call Captured",
      body: `New missed call from ${callerNumber}.`,
      url: "/missed-call",
      eventKey: `missed_call_captured:${settings.tenant_id}:${callerNumber}:${new Date().toISOString().slice(0, 10)}`,
      targetRoles: ["admin", "office_staff"],
      data: { callerNumber, provider },
    }).catch((err) => console.error("[push-events] missed call communication alert failed:", err));
  }
});

export { router as missedCallRouter, publicRouter as missedCallPublicRouter };
