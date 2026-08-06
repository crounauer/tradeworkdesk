import { Router } from "express";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

router.get(
  "/email-audit",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const status = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
    const emailType = typeof req.query.email_type === "string" ? req.query.email_type.trim().toLowerCase() : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 100;

    let query = supabaseAdmin
      .from("tenant_email_audit_log")
      .select("id, tenant_id, actor_id, status, email_type, provider, provider_message_id, to_email, subject, from_email, reply_to, error_message, failure_category, request_path, metadata, created_at")
      .eq("tenant_id", req.tenantId!)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (["queued", "accepted", "delivered", "deferred", "bounced", "complained", "suppressed", "failed", "sent"].includes(status)) {
      query = query.eq("status", status);
    }

    if (emailType) {
      query = query.eq("email_type", emailType);
    }

    if (search) {
      const escaped = search.replace(/,/g, " ");
      query = query.or(`to_email.ilike.%${escaped}%,subject.ilike.%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      items: data || [],
      count: (data || []).length,
      filters: {
        status: status || null,
        email_type: emailType || null,
        q: search || null,
        limit,
      },
    });
  },
);

router.get(
  "/email-audit/health",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const now = Date.now();
    const lookbackHours = Math.min(168, Math.max(1, Number(req.query.hours ?? 24) || 24));
    const sinceIso = new Date(now - lookbackHours * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("tenant_email_audit_log")
      .select("status, failure_category, needs_action, created_at")
      .eq("tenant_id", req.tenantId!)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const items = (rows || []) as Array<{ status: string; failure_category: string | null; needs_action: boolean; created_at: string }>;
    const totals = {
      total: items.length,
      queued: 0,
      accepted: 0,
      delivered: 0,
      deferred: 0,
      bounced: 0,
      complained: 0,
      suppressed: 0,
      failed: 0,
      needs_action: 0,
    };

    for (const row of items) {
      const status = String(row.status || "").toLowerCase();
      if (status in totals) {
        (totals as Record<string, number>)[status] += 1;
      }
      if (row.needs_action) totals.needs_action += 1;
    }

    const failedLike = totals.failed + totals.bounced + totals.complained + totals.suppressed;
    const successLike = totals.delivered + totals.accepted;
    const failureRate = totals.total > 0 ? Math.round((failedLike / totals.total) * 1000) / 10 : 0;

    res.json({
      lookback_hours: lookbackHours,
      since: sinceIso,
      totals,
      failed_like: failedLike,
      success_like: successLike,
      failure_rate_percent: failureRate,
    });
  },
);

router.post(
  "/email-audit/:id/resolve",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const id = String(req.params.id || "").trim();
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }

    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    const { data, error } = await supabaseAdmin
      .from("tenant_email_audit_log")
      .update({
        needs_action: false,
        resolved_at: new Date().toISOString(),
        resolved_by: req.userId || null,
        resolution_note: note || null,
      })
      .eq("id", id)
      .eq("tenant_id", req.tenantId!)
      .select("id")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Email audit item not found" });
      return;
    }

    res.json({ success: true });
  },
);

router.get(
  "/email-suppressions",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { data, error } = await supabaseAdmin
      .from("tenant_email_suppressions")
      .select("id, email, scope, reason, created_by, created_at")
      .eq("tenant_id", req.tenantId!)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data || []);
  },
);

router.post(
  "/email-suppressions",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const scope = String(req.body?.scope || "all").trim().toLowerCase();
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!["all", "marketing", "review_requests", "campaigns"].includes(scope)) {
      res.status(400).json({ error: "Invalid scope" });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("tenant_email_suppressions")
      .upsert({
        tenant_id: req.tenantId!,
        email,
        scope,
        reason,
        created_by: req.userId || null,
      }, { onConflict: "tenant_id,email,scope" })
      .select("id, email, scope, reason, created_by, created_at")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  },
);

router.delete(
  "/email-suppressions/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const id = String(req.params.id || "").trim();
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }

    const { error } = await supabaseAdmin
      .from("tenant_email_suppressions")
      .delete()
      .eq("id", id)
      .eq("tenant_id", req.tenantId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).send();
  },
);

export default router;
