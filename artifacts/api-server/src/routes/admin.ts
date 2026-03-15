import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import crypto from "crypto";

const router: IRouter = Router();

// ─── Users ────────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.patch("/admin/users/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { role, full_name, phone } = req.body;

  if (id === req.userId && role && role !== "admin") {
    res.status(400).json({ error: "You cannot change your own role." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/admin/users/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  if (id === req.userId) {
    res.status(400).json({ error: "You cannot remove your own account." });
    return;
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(204).send();
});

// ─── Invite Codes ─────────────────────────────────────────────────────────────

router.get("/admin/invite-codes", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Enrich with creator name
  const profileIds = [...new Set((data || []).map((r: { created_by: string | null }) => r.created_by).filter(Boolean))] as string[];
  let profileMap: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", profileIds);
    profileMap = Object.fromEntries((profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
  }

  const enriched = (data || []).map((code: Record<string, unknown>) => ({
    ...code,
    created_by_name: code.created_by ? profileMap[code.created_by as string] ?? null : null,
  }));

  res.json(enriched);
});

router.post("/admin/invite-codes", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { role = "technician", expires_at, note } = req.body;

  const code = crypto.randomBytes(5).toString("hex").toUpperCase();

  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .insert({
      code,
      role,
      created_by: req.userId,
      expires_at: expires_at || null,
      note: note || null,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.delete("/admin/invite-codes/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from("invite_codes")
    .update({ is_active: false })
    .eq("id", id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

// ─── Public: validate invite code (before sign-up) ───────────────────────────

router.post("/auth/validate-invite", async (req, res): Promise<void> => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Code is required." }); return; }

  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("id, role, expires_at, used_at, is_active")
    .eq("code", (code as string).toUpperCase().trim())
    .single();

  if (error || !data) { res.status(404).json({ error: "Invalid invite code." }); return; }

  const invite = data as { id: string; role: string; expires_at: string | null; used_at: string | null; is_active: boolean };
  if (!invite.is_active) { res.status(400).json({ error: "This invite code has been revoked." }); return; }
  if (invite.used_at) { res.status(400).json({ error: "This invite code has already been used." }); return; }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    res.status(400).json({ error: "This invite code has expired." }); return;
  }

  res.json({ valid: true, role: invite.role });
});

// ─── Authenticated: consume invite code after sign-up ────────────────────────

router.post("/auth/use-invite", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Code is required." }); return; }

  const { data: invite, error: fetchError } = await supabaseAdmin
    .from("invite_codes")
    .select("id, role, expires_at, used_at, is_active")
    .eq("code", (code as string).toUpperCase().trim())
    .eq("is_active", true)
    .is("used_at", null)
    .single();

  if (fetchError || !invite) { res.status(400).json({ error: "Invalid or already used invite code." }); return; }

  const inv = invite as { id: string; role: string; expires_at: string | null };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    res.status(400).json({ error: "Invite code has expired." }); return;
  }

  await Promise.all([
    supabaseAdmin.from("invite_codes").update({ used_by: req.userId, used_at: new Date().toISOString() }).eq("id", inv.id),
    supabaseAdmin.from("profiles").update({ role: inv.role }).eq("id", req.userId!),
  ]);

  res.json({ success: true, role: inv.role });
});

export default router;
