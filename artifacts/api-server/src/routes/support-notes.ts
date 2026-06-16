import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";

// New tables not yet in Supabase generated types — use untyped alias
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/platform/tenants/:id/support-notes
// ---------------------------------------------------------------------------

router.get(
  "/platform/tenants/:id/support-notes",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id: tenantId } = req.params;

    const { data, error } = await db
      .from("tenant_support_notes")
      .select("id, body, is_pinned, author_email, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  }
);

// ---------------------------------------------------------------------------
// POST /api/platform/tenants/:id/support-notes
// ---------------------------------------------------------------------------

router.post(
  "/platform/tenants/:id/support-notes",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id: tenantId } = req.params;
    const { body, is_pinned = false } = req.body as {
      body?: string;
      is_pinned?: boolean;
    };

    if (!body?.trim()) {
      res.status(400).json({ error: "body is required" });
      return;
    }

    const { data, error } = await db
      .from("tenant_support_notes")
      .insert({
        tenant_id: tenantId,
        author_id: req.userId,
        author_email: req.userEmail,
        body: body.trim(),
        is_pinned: !!is_pinned,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Audit log
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_id: req.userId,
      actor_email: req.userEmail,
      event_type: "support_note_created",
      entity_type: "tenant",
      entity_id: tenantId,
      detail: { note_id: (data as Record<string, unknown>).id },
    });

    res.status(201).json(data);
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/platform/support-notes/:noteId
// ---------------------------------------------------------------------------

router.patch(
  "/platform/support-notes/:noteId",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { noteId } = req.params;
    const { body, is_pinned } = req.body as {
      body?: string;
      is_pinned?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (body !== undefined) updates.body = body.trim();
    if (is_pinned !== undefined) updates.is_pinned = !!is_pinned;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await db
      .from("tenant_support_notes")
      .update(updates)
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/platform/support-notes/:noteId
// ---------------------------------------------------------------------------

router.delete(
  "/platform/support-notes/:noteId",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { noteId } = req.params;

    const { error } = await db
      .from("tenant_support_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true });
  }
);

export default router;
