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

type ReviewSettings = {
  google_review_url?: string | null;
  trustpilot_url?: string | null;
  checkatrade_url?: string | null;
  which_trusted_url?: string | null;
  custom_review_url?: string | null;
};

type PublicReviewRequest = {
  id: string;
  tenant_id: string;
  tracking_token: string;
  channel: "email" | "sms";
  trigger_type: "job_completed" | "invoice_paid" | "manual";
  customer_name: string;
  status: string;
};

function escHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function withAttribution(url: string, rr: PublicReviewRequest): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", "tradeworkdesk");
    parsed.searchParams.set("utm_medium", rr.channel);
    parsed.searchParams.set("utm_campaign", `review_request_${rr.trigger_type}`);
    parsed.searchParams.set("utm_content", rr.id);
    return parsed.toString();
  } catch {
    return url;
  }
}

function resolveReviewDestinationUrl(settings: ReviewSettings | null, rr: PublicReviewRequest): string | null {
  if (!settings) return null;
  const smsOrder = [
    settings.google_review_url,
    settings.checkatrade_url,
    settings.trustpilot_url,
    settings.which_trusted_url,
    settings.custom_review_url,
  ];
  const emailOrder = [
    settings.google_review_url,
    settings.trustpilot_url,
    settings.checkatrade_url,
    settings.which_trusted_url,
    settings.custom_review_url,
  ];

  const selected = (rr.channel === "sms" ? smsOrder : emailOrder).find((v) => !!String(v || "").trim());
  if (!selected) return null;
  return withAttribution(String(selected), rr);
}

function renderFeedbackPage(opts: { token: string; customerName: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Share your feedback</title>
    <style>
      body { margin: 0; background: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .wrap { max-width: 680px; margin: 28px auto; padding: 0 16px; }
      .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0 0 12px; color: #475569; line-height: 1.5; }
      .stars { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 16px 0; }
      .star { border: 1px solid #cbd5e1; border-radius: 10px; text-align: center; padding: 10px 0; background: white; cursor: pointer; font-weight: 700; }
      .star input { display: none; }
      .star:has(input:checked) { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }
      textarea { width: 100%; min-height: 120px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; font: inherit; }
      .row { margin-top: 12px; }
      .actions { margin-top: 16px; }
      button { border: 0; background: #2563eb; color: white; border-radius: 10px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
      .hint { font-size: 12px; color: #64748b; margin-top: 8px; }
      label.check { display: flex; gap: 8px; align-items: center; font-size: 13px; color: #334155; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card">
        <h1>How did we do, ${escHtml(opts.customerName || "there")}?</h1>
        <p>Your feedback helps us improve. If you had a great experience, we will ask you to leave a public review next.</p>
        <form method="POST" action="/api/public/review/${encodeURIComponent(opts.token)}/feedback">
          <div class="stars">
            ${[1,2,3,4,5].map((n) => `<label class="star"><input type="radio" name="rating" value="${n}" required />${n} ★</label>`).join("")}
          </div>
          <div class="row">
            <textarea name="feedback" placeholder="Optional: tell us what went well or what we can improve"></textarea>
          </div>
          <div class="row">
            <label class="check">
              <input type="checkbox" name="consent_publish" value="1" />
              You can use my feedback as a testimonial on your website.
            </label>
          </div>
          <div class="actions">
            <button type="submit">Continue</button>
          </div>
          <p class="hint">Public review links are shown after submitting this form.</p>
        </form>
      </section>
    </main>
  </body>
</html>`;
}

function renderFeedbackThankYou(opts: { title: string; message: string; actionUrl?: string | null; actionLabel?: string }): string {
  const action = opts.actionUrl
    ? `<p style="margin-top:16px"><a href="${escHtml(opts.actionUrl)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700">${escHtml(opts.actionLabel || "Continue")}</a></p>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escHtml(opts.title)}</title>
<style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:680px;margin:28px auto;padding:0 16px}.card{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 8px 22px rgba(15,23,42,.08)}h1{margin:0 0 8px;font-size:24px}p{margin:0 0 12px;color:#475569;line-height:1.5}</style></head>
<body><main class="wrap"><section class="card"><h1>${escHtml(opts.title)}</h1><p>${escHtml(opts.message)}</p>${action}</section></main></body></html>`;
}

// ─── Review request settings ──────────────────────────────────────────────────

router.get("/review-requests/settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data, error } = await db.from("review_request_settings")
    .select("*").eq("tenant_id", req.tenantId).maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data ?? {});
});

router.put("/review-requests/settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...fields } = req.body;
  const { data, error } = await db.from("review_request_settings").upsert(
    { ...fields, tenant_id: req.tenantId },
    { onConflict: "tenant_id" }
  ).select().single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// ─── Review requests list ─────────────────────────────────────────────────────

router.get("/review-requests", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { status, limit = "50" } = req.query as Record<string, string>;
  let q = db.from("review_requests").select("*")
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false })
    .limit(parseInt(limit));
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

router.get("/review-requests/stats", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const daysRaw = Number((req.query as Record<string, string>)?.days || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(365, Math.max(7, Math.round(daysRaw))) : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await db
    .from("review_requests")
    .select("id, status, channel, trigger_type, created_at")
    .eq("tenant_id", req.tenantId)
    .gte("created_at", cutoff.toISOString());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (data || []) as Array<{ status: string; channel: "email" | "sms"; trigger_type: string }>;
  const total = rows.length;
  const sent = rows.filter((r) => ["sent", "opened", "clicked"].includes(r.status)).length;
  const opened = rows.filter((r) => ["opened", "clicked"].includes(r.status)).length;
  const clicked = rows.filter((r) => r.status === "clicked").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const suppressed = rows.filter((r) => r.status === "suppressed").length;

  const byChannel = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.channel] = (acc[row.channel] || 0) + 1;
    return acc;
  }, {});

  const byTrigger = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.trigger_type] = (acc[row.trigger_type] || 0) + 1;
    return acc;
  }, {});

  const pct = (value: number, denominator: number) => {
    if (!denominator) return 0;
    return Math.round((value / denominator) * 1000) / 10;
  };

  res.json({
    window_days: days,
    totals: { total, sent, opened, clicked, failed, suppressed },
    rates: {
      send_rate: pct(sent, total),
      open_rate: pct(opened, sent),
      click_rate: pct(clicked, sent),
      click_to_open_rate: pct(clicked, opened),
    },
    by_channel: byChannel,
    by_trigger: byTrigger,
  });
});

// ─── Create / schedule review request ────────────────────────────────────────

router.post("/review-requests", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { customer_name, customer_email, customer_phone, job_id, invoice_id, scheduled_for, channel } = req.body as Record<string, string>;
  if (!customer_name || !customer_email) {
    res.status(400).json({ error: "customer_name and customer_email are required" });
    return;
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
      res.status(409).json({ error: "Review request already sent to this customer recently" });
      return;
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

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

// ─── Force-send now ───────────────────────────────────────────────────────────

router.post("/review-requests/:id/send", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const requestId = String(req.params.id || "");
  try {
    const data = await sendReviewRequestNow(requestId, req.tenantId!);
    res.json(data);
  } catch (err) {
    const status = err instanceof ReviewRequestError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Failed to send review request";
    res.status(status).json({ error: message });
  }
});

router.delete("/review-requests/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const requestId = String(req.params.id || "");
  const { error } = await db.from("review_requests")
    .delete().eq("id", requestId).eq("tenant_id", req.tenantId).eq("status", "pending");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).end();
});

// ─── Automation trigger endpoint ──────────────────────────────────────────────
// Called when events happen (job completed, invoice paid, booking confirmed)
// In a full implementation this would be called by a queue/webhook processor.

router.post("/automation/trigger", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { event, entity_id, entity_type, metadata } = req.body as {
    event: string;
    entity_id: string;
    entity_type: string;
    metadata?: Record<string, unknown>;
  };

  if (!event || !entity_id) {
    res.status(400).json({ error: "event and entity_id are required" });
    return;
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
publicRouter.get("/public/review/:token", async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token || "");
  // Fire-and-forget: record open
  db.from("review_requests")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("tracking_token", token)
    .eq("status", "sent") // only update if not already opened/clicked
    .then(() => {});

  // Return 1x1 transparent gif
  const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" });
  res.end(pixel);
});

publicRouter.get("/public/review/:token/start", async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token || "");
  const { data: rr } = await db
    .from("review_requests")
    .select("id, tenant_id, tracking_token, channel, trigger_type, customer_name, status")
    .eq("tracking_token", token)
    .maybeSingle() as { data: PublicReviewRequest | null };

  if (!rr) {
    res.status(404).send(renderFeedbackThankYou({
      title: "Review link not found",
      message: "This review link is invalid or expired.",
    }));
    return;
  }

  if (rr.status === "sent") {
    await db
      .from("review_requests")
      .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("tracking_token", token)
      .eq("status", "sent");
  }

  res.set("Cache-Control", "no-store");
  res.send(renderFeedbackPage({ token: rr.tracking_token, customerName: rr.customer_name || "there" }));
});

publicRouter.post("/public/review/:token/feedback", async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token || "");
  const rating = Number(req.body?.rating || 0);
  const feedback = String(req.body?.feedback || "").trim();
  const consentPublish = String(req.body?.consent_publish || "") === "1";

  const { data: rr } = await db
    .from("review_requests")
    .select("id, tenant_id, tracking_token, channel, trigger_type, customer_name, status")
    .eq("tracking_token", token)
    .maybeSingle() as { data: PublicReviewRequest | null };

  if (!rr) {
    res.status(404).send(renderFeedbackThankYou({
      title: "Review link not found",
      message: "This review link is invalid or expired.",
    }));
    return;
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    res.status(400).send(renderFeedbackThankYou({
      title: "Rating required",
      message: "Please go back and select a rating between 1 and 5.",
    }));
    return;
  }

  await db.from("review_requests")
    .update({ status: "clicked", clicked_at: new Date().toISOString() })
    .eq("tracking_token", token);

  await db.from("automation_logs").insert({
    tenant_id: rr.tenant_id,
    trigger_event: "review.feedback_submitted",
    entity_type: "review_request",
    entity_id: rr.id,
    status: "success",
    action_type: rating >= 4 ? "review_feedback_positive" : "review_feedback_private",
    message: `rating=${rating}${feedback ? `; feedback=${feedback.slice(0, 300)}` : ""}`,
  });

  if (rating >= 4 && consentPublish && feedback.length >= 10) {
    const { data: website } = await db
      .from("websites")
      .select("id")
      .eq("tenant_id", rr.tenant_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle() as { data: { id: string } | null };

    if (website?.id) {
      await db.from("website_testimonials").insert({
        website_id: website.id,
        tenant_id: rr.tenant_id,
        author_name: rr.customer_name || "Verified Customer",
        rating,
        body: feedback,
        is_visible: false,
        sort_order: 999,
      });
    }
  }

  const { data: settings } = await db
    .from("review_request_settings")
    .select("google_review_url, trustpilot_url, checkatrade_url, which_trusted_url, custom_review_url")
    .eq("tenant_id", rr.tenant_id)
    .maybeSingle() as { data: ReviewSettings | null };

  if (rating >= 4) {
    const destination = resolveReviewDestinationUrl(settings, rr);
    if (destination) {
      res.redirect(destination);
      return;
    }
    res.status(200).send(renderFeedbackThankYou({
      title: "Thanks for your feedback",
      message: "We appreciate your rating.",
    }));
    return;
  }

  res.status(200).send(renderFeedbackThankYou({
    title: "Thanks for your feedback",
    message: "We appreciate you sharing this. Your comments have been sent privately to the team.",
  }));
});

// Click tracking + redirect
publicRouter.get("/public/review/:token/click", async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token || "");
  const { data: rr } = await db.from("review_requests")
    .select("id, tenant_id, tracking_token, channel, trigger_type, customer_name")
    .eq("tracking_token", token).maybeSingle() as { data: PublicReviewRequest | null };

  if (rr) {
    await db.from("review_requests")
      .update({ status: "clicked", clicked_at: new Date().toISOString() })
      .eq("tracking_token", token);
  }

  // Redirect based on channel-aware destination order and attribution tags
  if (rr) {
    const { data: settings } = await db.from("review_request_settings")
      .select("google_review_url, trustpilot_url, checkatrade_url, which_trusted_url, custom_review_url")
      .eq("tenant_id", rr.tenant_id).maybeSingle() as { data: ReviewSettings | null };

    const url = resolveReviewDestinationUrl(settings, rr);

    if (url) {
      res.redirect(url);
      return;
    }
  }

  res.status(404).send("Review link not found");
});

export { router as reviewRequestRouter, publicRouter as reviewRequestPublicRouter };
