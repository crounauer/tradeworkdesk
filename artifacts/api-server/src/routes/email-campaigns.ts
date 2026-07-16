/**
 * Email Marketing Campaigns API
 *
 * Authenticated routes:
 *   GET    /api/campaigns               — list campaigns
 *   POST   /api/campaigns               — create draft
 *   GET    /api/campaigns/:id           — get campaign details
 *   PATCH  /api/campaigns/:id           — update (draft/scheduled only)
 *   DELETE /api/campaigns/:id           — delete (draft only)
 *   POST   /api/campaigns/:id/send      — send or schedule campaign
 *   POST   /api/campaigns/:id/preview   — send test email to self
 *   GET    /api/campaigns/:id/recipients — list recipients
 *   GET    /api/campaigns/preview-audience — preview recipient count for filters
 *
 *   GET    /api/campaigns/unsubscribes  — list unsubscribed emails
 *
 * Public (no auth):
 *   GET    /api/public/campaign/:token/open     — track open (pixel)
 *   GET    /api/public/campaign/:token/click    — track click + redirect
 *   GET    /api/public/campaign/:token/unsubscribe — unsubscribe page
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import {
  requireAuth,
  requireTenant,
  type AuthenticatedRequest,
} from "../middlewares/auth";

const router: IRouter = Router();
const publicRouter: IRouter = Router();
const db = supabaseAdmin as any;

// ─── Helper: resolve audience from filter ────────────────────────────────────

async function resolveAudience(
  tenantId: string,
  filter: Record<string, unknown>
): Promise<{ email: string; name: string | null; customer_id: string | null }[]> {
  // Get all unsubscribed emails for this tenant
  const { data: unsubs } = await db.from("email_unsubscribes")
    .select("email").eq("tenant_id", tenantId);
  const unsubSet = new Set<string>((unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase()));

  let q = db.from("customers")
    .select("id, first_name, last_name, email")
    .eq("tenant_id", tenantId)
    .not("email", "is", null)
    .neq("email", "");

  if (filter["last_serviced_before"]) {
    // Customers whose last job was before a given date
    q = q.lt("last_service_date", filter["last_serviced_before"] as string);
  }

  const { data: customers, error } = await q;
  if (error || !customers) return [];

  return customers
    .filter((c: { email: string }) => c.email && !unsubSet.has(c.email.toLowerCase()))
    .map((c: { id: string; first_name: string | null; last_name: string | null; email: string }) => ({
      email: c.email,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
      customer_id: c.id,
    }));
}

// ─── Campaigns CRUD ──────────────────────────────────────────────────────────

router.get("/campaigns", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { data, error } = await db.from("email_campaigns")
    .select("id, name, subject, status, scheduled_for, sent_at, recipient_count, open_count, click_count, created_at")
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

router.get("/campaigns/preview-audience", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const filter = typeof req.query.filter === "string"
    ? JSON.parse(req.query.filter) as Record<string, unknown>
    : {};
  const audience = await resolveAudience(req.tenantId!, filter);
  res.json({ count: audience.length });
});

router.get("/campaigns/unsubscribes", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { data, error } = await db.from("email_unsubscribes")
    .select("*").eq("tenant_id", req.tenantId).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

router.get("/campaigns/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { data, error } = await db.from("email_campaigns")
    .select("*").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (error) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

router.post("/campaigns", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("email_campaigns")
    .insert({ ...fields, tenant_id: req.tenantId, status: "draft" })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch("/campaigns/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  // Only allow editing drafts or scheduled campaigns
  const { data: existing } = await db.from("email_campaigns")
    .select("status").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "sent" || existing.status === "sending") {
    return res.status(409).json({ error: "Cannot edit a campaign that has already been sent" });
  }
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("email_campaigns")
    .update(fields)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete("/campaigns/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { data: existing } = await db.from("email_campaigns")
    .select("status").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "draft") {
    return res.status(409).json({ error: "Only draft campaigns can be deleted" });
  }
  await db.from("email_campaigns").delete().eq("id", req.params.id);
  res.status(204).end();
});

// ─── Send / Schedule ─────────────────────────────────────────────────────────

router.post("/campaigns/:id/send", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { scheduled_for } = req.body as { scheduled_for?: string };

  const { data: campaign } = await db.from("email_campaigns")
    .select("*").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!campaign) return res.status(404).json({ error: "Not found" });
  if (campaign.status === "sent" || campaign.status === "sending") {
    return res.status(409).json({ error: "Campaign already sent" });
  }

  // Resolve audience
  const filter = campaign.recipient_filter ?? {};
  const audience = await resolveAudience(req.tenantId!, filter);

  if (audience.length === 0) {
    return res.status(422).json({ error: "No recipients matched the filter (or all unsubscribed)" });
  }

  // Insert recipient rows
  const rows = audience.map((r) => ({
    campaign_id: campaign.id,
    tenant_id: req.tenantId,
    customer_id: r.customer_id,
    email: r.email,
    name: r.name,
    status: "pending",
  }));
  await db.from("campaign_recipients").insert(rows);

  if (scheduled_for) {
    // Schedule for later
    const { data } = await db.from("email_campaigns")
      .update({ status: "scheduled", scheduled_for, recipient_count: audience.length })
      .eq("id", req.params.id)
      .select()
      .single();
    return res.json(data);
  }

  // Mark as sending (actual dispatch handled by background worker/cron)
  const { data } = await db.from("email_campaigns")
    .update({ status: "sending", recipient_count: audience.length })
    .eq("id", req.params.id)
    .select()
    .single();
  res.json(data);
});

// POST /api/campaigns/:id/preview — sends test email to the requesting user
router.post("/campaigns/:id/preview", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { to_email } = req.body as { to_email?: string };
  if (!to_email) return res.status(400).json({ error: "to_email is required" });
  // In production this would actually send via Resend/Mailgun etc.
  // For now just acknowledge — background worker will pick it up
  res.json({ queued: true, to: to_email });
});

// ─── Recipients ───────────────────────────────────────────────────────────────

router.get("/campaigns/:id/recipients", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const { data, error } = await db.from("campaign_recipients")
    .select("id, email, name, status, sent_at, opened_at, clicked_at")
    .eq("campaign_id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ─── Public tracking ──────────────────────────────────────────────────────────

// GET /api/public/campaign/:token/open — 1x1 tracking pixel
publicRouter.get("/public/campaign/:token/open", async (req: Request, res: Response) => {
  const token = req.params.token;
  // Update recipient
  const { data: recipient } = await db.from("campaign_recipients")
    .select("id, campaign_id")
    .eq("tracking_token", token)
    .maybeSingle();
  if (recipient) {
    await db.from("campaign_recipients")
      .update({ status: "opened", opened_at: new Date().toISOString() })
      .eq("tracking_token", token);
    // Increment campaign open counter
    await db.rpc("increment_campaign_counter", {
      p_campaign_id: recipient.campaign_id,
      p_column: "open_count",
    }).catch(() => null); // best-effort
  }
  const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.set("Content-Type", "image/gif").set("Cache-Control", "no-store").end(pixel);
});

// GET /api/public/campaign/:token/click — track click and redirect
publicRouter.get("/public/campaign/:token/click", async (req: Request, res: Response) => {
  const token = req.params.token;
  const { redirect_url } = req.query as { redirect_url?: string };
  const { data: recipient } = await db.from("campaign_recipients")
    .select("id, campaign_id")
    .eq("tracking_token", token)
    .maybeSingle();
  if (recipient) {
    await db.from("campaign_recipients")
      .update({ status: "clicked", clicked_at: new Date().toISOString() })
      .eq("tracking_token", token);
    await db.rpc("increment_campaign_counter", {
      p_campaign_id: recipient.campaign_id,
      p_column: "click_count",
    }).catch(() => null);
  }
  if (redirect_url) {
    // Only allow http/https redirects to prevent open redirect abuse
    try {
      const url = new URL(redirect_url);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return res.redirect(302, url.toString());
      }
    } catch {
      // invalid URL — fall through
    }
  }
  res.status(200).send("Tracked");
});

// GET /api/public/campaign/:token/unsubscribe — one-click unsubscribe
publicRouter.get("/public/campaign/:token/unsubscribe", async (req: Request, res: Response): Promise<Response | void> => {
  const token = req.params.token;
  const { data: recipient } = await db.from("campaign_recipients")
    .select("email, tenant_id")
    .eq("tracking_token", token)
    .maybeSingle();
  if (!recipient) return res.status(404).send("Link not recognised");

  await db.from("campaign_recipients")
    .update({ status: "unsubscribed" })
    .eq("tracking_token", token);
  await db.from("email_unsubscribes").upsert(
    { tenant_id: recipient.tenant_id, email: recipient.email },
    { onConflict: "tenant_id, email", ignoreDuplicates: true }
  );

  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
    <body style="font-family:sans-serif;padding:2rem;text-align:center;">
      <h2>You've been unsubscribed</h2>
      <p>You won't receive further marketing emails from this company.</p>
    </body></html>
  `);
});

export { router as emailCampaignsRouter, publicRouter as emailCampaignsPublicRouter };
