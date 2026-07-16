import { Router, type IRouter } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";

// New tables not yet in Supabase generated types — use untyped alias
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/platform/tenants/:id/impersonate
//
// Generates a short-lived signed impersonation token for a tenant.
// The super admin uses this token to access the business app as any admin
// user in that tenant — for support/troubleshooting only.
//
// The token is:
//   - valid for 1 hour
//   - single-use (marked used_at on first exchange)
//   - fully audited in platform_audit_log + impersonation_sessions
//   - revocable via DELETE /api/platform/impersonation/:sessionId
// ---------------------------------------------------------------------------

router.post(
  "/platform/tenants/:id/impersonate",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id: tenantId } = req.params;
    const { reason, target_user_id } = req.body as {
      reason?: string;
      target_user_id?: string;
    };

    // Verify tenant exists
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from("tenants")
      .select("id, company_name, status")
      .eq("id", tenantId)
      .single();

    if (tenantErr || !tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Find the admin user for this tenant (or the specified target user)
    let targetUserId = target_user_id;
    if (!targetUserId) {
      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("role", "admin")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle() as { data: { id: string } | null; error: unknown };

      if (!adminProfile) {
        res.status(404).json({ error: "No active admin user found for this tenant" });
        return;
      }
      targetUserId = adminProfile.id;
    }

    // Generate a cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Record the impersonation session
    const { data: session, error: sessionErr } = await db
      .from("impersonation_sessions")
      .insert({
        actor_id: req.userId,
        actor_email: req.userEmail,
        tenant_id: tenantId,
        target_user_id: targetUserId,
        reason: reason || null,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single() as { data: { id: string } | null; error: unknown };

    if (sessionErr || !session) {
      const sessionErrMsg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr || "unknown error");
      console.error("[impersonate] session insert failed:", sessionErrMsg);
      res.status(500).json({ error: "Failed to create impersonation session" });
      return;
    }

    // Write audit log entry
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_id: req.userId,
      actor_email: req.userEmail,
      event_type: "impersonation_created",
      entity_type: "tenant",
      entity_id: tenantId,
      detail: {
        tenant_name: (tenant as Record<string, unknown>).company_name,
        target_user_id: targetUserId,
        reason: reason || null,
        session_id: session.id,
        expires_at: expiresAt,
      },
    });

    res.json({
      session_id: session.id,
      token: rawToken,
      expires_at: expiresAt,
      tenant_id: tenantId,
      target_user_id: targetUserId,
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/platform/impersonation/exchange
//
// Exchanges a raw impersonation token for a Supabase session.
// Called by the frontend after receiving the token — creates an actual
// Supabase auth session for the target user.
// ---------------------------------------------------------------------------

router.post(
  "/platform/impersonation/exchange",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { token } = req.body as { token?: string };

    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { data: session, error: sessionErr } = await db
      .from("impersonation_sessions")
      .select("id, tenant_id, target_user_id, expires_at, used_at, revoked_at, actor_id, actor_email")
      .eq("token_hash", tokenHash)
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (sessionErr || !session) {
      res.status(401).json({ error: "Invalid or expired impersonation token" });
      return;
    }

    const s = session as Record<string, unknown>;

    if (s.revoked_at) {
      res.status(401).json({ error: "Impersonation session has been revoked" });
      return;
    }

    if (s.used_at) {
      res.status(401).json({ error: "Impersonation token has already been used" });
      return;
    }

    if (new Date(s.expires_at as string) < new Date()) {
      res.status(401).json({ error: "Impersonation token has expired" });
      return;
    }

    // Mark as used immediately to prevent replay
    await db
      .from("impersonation_sessions")
      .update({ used_at: new Date().toISOString() } as any)
      .eq("id", s.id as string);

    // Generate a Supabase session for the target user using admin API
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: "", // not used with user_id approach below
    });

    // Use the admin.createSession approach instead
    const { data: userSession, error: userSessionErr } = await (supabaseAdmin.auth.admin as any)
      .createSession?.({ user_id: s.target_user_id as string })
      ?? { data: null, error: new Error("createSession not available") };

    if (userSessionErr || !userSession) {
      // Fallback: return target user info so the frontend can use the
      // impersonation token to identify the user without a full session swap
      console.warn("[impersonate] createSession not available, returning user info only");

      await supabaseAdmin.from("platform_audit_log").insert({
        actor_id: req.userId,
        actor_email: req.userEmail,
        event_type: "impersonation_used",
        entity_type: "tenant",
        entity_id: s.tenant_id as string,
        detail: {
          session_id: s.id,
          target_user_id: s.target_user_id,
          method: "token_only",
        },
      });

      res.json({
        method: "token_only",
        target_user_id: s.target_user_id,
        tenant_id: s.tenant_id,
        session_id: s.id,
      });
      return;
    }

    await supabaseAdmin.from("platform_audit_log").insert({
      actor_id: req.userId,
      actor_email: req.userEmail,
      event_type: "impersonation_used",
      entity_type: "tenant",
      entity_id: s.tenant_id as string,
      detail: {
        session_id: s.id,
        target_user_id: s.target_user_id,
        method: "session_swap",
      },
    });

    res.json({
      method: "session_swap",
      session: userSession.session,
      target_user_id: s.target_user_id,
      tenant_id: s.tenant_id,
    });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/platform/impersonation/:sessionId
// Revokes an active impersonation session
// ---------------------------------------------------------------------------

router.delete(
  "/platform/impersonation/:sessionId",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { sessionId } = req.params;

    const { error } = await db
      .from("impersonation_sessions")
      .update({ revoked_at: new Date().toISOString() } as any)
      .eq("id", sessionId)
      .is("revoked_at", null);

    if (error) {
      const errMsg = error instanceof Error ? error.message : String(error || "unknown error");
      res.status(500).json({ error: errMsg });
      return;
    }

    await supabaseAdmin.from("platform_audit_log").insert({
      actor_id: req.userId,
      actor_email: req.userEmail,
      event_type: "impersonation_revoked",
      entity_type: "impersonation_session",
      entity_id: sessionId,
      detail: {},
    });

    res.json({ ok: true });
  }
);

// ---------------------------------------------------------------------------
// GET /api/platform/impersonation — list recent sessions (super admin only)
// ---------------------------------------------------------------------------

router.get(
  "/platform/impersonation",
  requireAuth,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res): Promise<void> => {
    const { data, error } = await db
      .from("impersonation_sessions")
      .select("id, actor_email, tenant_id, target_user_id, reason, expires_at, used_at, revoked_at, created_at, tenants(company_name)")
      .order("created_at", { ascending: false })
      .limit(100) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load impersonation sessions" });
      return;
    }

    res.json(data || []);
  }
);

export default router;
