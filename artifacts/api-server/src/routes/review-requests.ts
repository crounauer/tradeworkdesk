/**
 * Review Request Automation API routes
 *
 * Authenticated (tenant staff):
 *   GET    /api/review-requests/settings         — get settings
 *   PUT    /api/review-requests/settings         — upsert settings
 *   GET    /api/review-requests                  — list review requests
 *   POST   /api/review-requests                  — create/schedule manually
 *   POST   /api/review-requests/:id/send         — force-send now
 *   DELETE /api/review-requests/:id              — cancel pending request
 *
 * Automation hooks (called internally / by webhooks):
 *   POST   /api/automation/trigger               — fire an automation event
 *
 * Public (no auth):
 *   GET    /api/public/review/:token             — track open (pixel)
 *   GET    /api/public/review/:token/click       — track click + redirect
 *
 * Website form → enquiry integration:
 *   POST   /api/website/forms/:formId/submit     — already handled in website-domains-blog.ts
 *   (we extend that handler to auto-create an enquiry if auto_create_enquiry = true)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { ReviewRequestError, sendReviewRequestNow, triggerReviewRequestAutomation } from "../lib/review-request-service";
import {
  requireAuth,
  requireTenant,
  type AuthenticatedRequest,
} from "../middlewares/auth";

const router: IRouter = Router();
const publicRouter: IRouter = Router();
const db = supabaseAdmin as any;

// ─── Review request settings ──────────────────────────────────────────────────

router.get("/review-requests/settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db.from("review_request_settings")
    .select("*").eq("tenant_id", req.tenantId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? {});
});

router.put("/review-requests/settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("review_request_settings").upsert(
    { ...fields, tenant_id: req.tenantId },
    { onConflict: "tenant_id" }
  ).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Review requests list ─────────────────────────────────────────────────────

router.get("/review-requests", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { status, limit = "50" } = req.query as Record<string, string>;
  let q = db.from("review_requests").select("*")
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false })
    .limit(parseInt(limit));
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Create / schedule review request ────────────────────────────────────────

router.post("/review-requests", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { customer_name, customer_email, customer_phone, job_id, invoice_id, scheduled_for, channel } = req.body as Record<string, string>;
  if (!customer_name || !customer_email) {
    return res.status(400).json({ error: "customer_name and customer_email are required" });
  }

  // Check if we've already sent one to this customer recently
  const { data: settings } = await db.from("review_request_settings")
    .select("max_per_customer_days, is_enabled").eq("tenant_id", req.tenantId).maybeSingle();

  if (settings?.max_per_customer_days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.max_per_customer_days);
    const { data: recent } = await db.from("review_requests")
      .select("id").eq("tenant_id", req.tenantId)
      .eq("customer_email", customer_email)
      .in("status", ["sent", "opened", "clicked"])
      .gte("sent_at", cutoff.toISOString())
      .limit(1);
    if (recent?.length) {
      return res.status(409).json({ error: "Review request already sent to this customer recently" });
    }
  }

  const { data, error } = await db.from("review_requests").insert({
    tenant_id: req.tenantId,
    customer_name,
    customer_email,
    customer_phone: customer_phone || null,
    job_id: job_id || null,
    invoice_id: invoice_id || null,
    trigger_type: "manual",
    channel: channel || "email",
    status: "pending",
    scheduled_for: scheduled_for || new Date().toISOString(),
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ─── Force-send now ───────────────────────────────────────────────────────────

router.post("/review-requests/:id/send", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await sendReviewRequestNow(req.params.id, req.tenantId!);
    res.json(data);
  } catch (err) {
    const status = err instanceof ReviewRequestError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Failed to send review request";
    res.status(status).json({ error: message });
  }
});

router.delete("/review-requests/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await db.from("review_requests")
    .delete().eq("id", req.params.id).eq("tenant_id", req.tenantId).eq("status", "pending");
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// ─── Automation trigger endpoint ──────────────────────────────────────────────
// Called when events happen (job completed, invoice paid, booking confirmed)
// In a full implementation this would be called by a queue/webhook processor.

router.post("/automation/trigger", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const { event, entity_id, entity_type, metadata } = req.body as {
    event: string;
    entity_id: string;
    entity_type: string;
    metadata?: Record<string, unknown>;
  };

  if (!event || !entity_id) {
    return res.status(400).json({ error: "event and entity_id are required" });
  }

  const logs = await triggerReviewRequestAutomation({
    tenantId: req.tenantId!,
    event,
    entityId: entity_id,
    entityType: entity_type,
    metadata,
  });

  res.json({ ok: true, processed: logs });
});

// ─── Public tracking routes ───────────────────────────────────────────────────

// Open tracking pixel
publicRouter.get("/public/review/:token", async (req: Request, res: Response) => {
  // Fire-and-forget: record open
  db.from("review_requests")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("tracking_token", req.params.token)
    .eq("status", "sent") // only update if not already opened/clicked
    .then(() => {});

  // Return 1x1 transparent gif
  const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" });
  res.end(pixel);
});

// Click tracking + redirect
publicRouter.get("/public/review/:token/click", async (req: Request, res: Response) => {
  const { data: rr } = await db.from("review_requests")
    .select("tenant_id, tracking_token")
    .eq("tracking_token", req.params.token).maybeSingle();

  if (rr) {
    await db.from("review_requests")
      .update({ status: "clicked", clicked_at: new Date().toISOString() })
      .eq("tracking_token", req.params.token);
  }

  // Redirect to the first configured review platform
  if (rr) {
    const { data: settings } = await db.from("review_request_settings")
      .select("google_review_url, trustpilot_url, checkatrade_url, custom_review_url")
      .eq("tenant_id", rr.tenant_id).maybeSingle();

    const url = settings?.google_review_url
      || settings?.trustpilot_url
      || settings?.checkatrade_url
      || settings?.custom_review_url;

    if (url) return res.redirect(url);
  }

  res.status(404).send("Review link not found");
});

export { router as reviewRequestRouter, publicRouter as reviewRequestPublicRouter };
