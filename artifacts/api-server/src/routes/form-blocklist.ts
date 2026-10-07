import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { createEnquiryFromFormSubmission } from "./website-domains-blog";

const router: IRouter = Router();

const VALID_TYPES = ["email", "domain", "ip"] as const;
type BlocklistType = (typeof VALID_TYPES)[number];

function normalizeValue(type: BlocklistType, raw: string): string {
  const value = raw.trim().toLowerCase();
  if (type === "domain") return value.replace(/^@/, "");
  return value;
}

router.get("/form-blocklist", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const isSuperAdmin = req.userRole === "super_admin";
  let q = supabaseAdmin
    .from("form_blocklist")
    .select("id, type, value, note, tenant_id, created_at")
    .order("created_at", { ascending: false });
  // Tenants see their own rows plus platform-wide rows (applied to everyone);
  // super admins additionally manage the platform-wide rows.
  q = q.or(`tenant_id.eq.${req.tenantId!},tenant_id.is.null`);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  const rows = (data || []).map((r: Record<string, unknown>) => ({
    id: r.id,
    type: r.type,
    value: r.value,
    note: r.note,
    created_at: r.created_at,
    platform: r.tenant_id === null,
    can_delete: r.tenant_id !== null || isSuperAdmin,
  }));
  res.json(rows);
});

router.post("/form-blocklist", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const type = typeof req.body?.type === "string" ? req.body.type.trim() : "";
  const rawValue = typeof req.body?.value === "string" ? req.body.value : "";
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

  if (!VALID_TYPES.includes(type as BlocklistType)) {
    res.status(400).json({ error: "type must be one of: email, domain, ip" });
    return;
  }
  const value = normalizeValue(type as BlocklistType, rawValue);
  if (!value) { res.status(400).json({ error: "A value is required." }); return; }

  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (type === "domain" && !/^[^\s@]+\.[^\s@]+$/.test(value)) {
    res.status(400).json({ error: "Enter a valid domain, e.g. spam.com" });
    return;
  }

  // Platform-wide entries (applied to every tenant) are super-admin only.
  const wantsPlatform = req.body?.platform === true;
  if (wantsPlatform && req.userRole !== "super_admin") {
    res.status(403).json({ error: "Only platform admins can add platform-wide entries." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("form_blocklist")
    .insert({
      tenant_id: wantsPlatform ? null : req.tenantId!,
      type,
      value,
      note: note || null,
      created_by: req.userId || null,
    })
    .select("id, type, value, note, created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That entry is already on your blocklist." });
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(data);
});

router.delete("/form-blocklist/:id", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin.from("form_blocklist").delete().eq("id", req.params.id);
  // Tenants may only delete their own rows; super admins may also delete
  // platform-wide (tenant_id IS NULL) rows.
  if (req.userRole === "super_admin") {
    q = q.or(`tenant_id.eq.${req.tenantId!},tenant_id.is.null`);
  } else {
    q = q.eq("tenant_id", req.tenantId!);
  }
  const { error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

// ─── Quarantine (submissions caught by the spam blocklist, held for review) ────

router.get("/form-blocklist/quarantine", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("website_form_submissions")
    .select("id, data, ip_address, created_at")
    .eq("tenant_id", req.tenantId!)
    .eq("status", "spam")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/form-blocklist/quarantine/:id/restore", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = req.params.id;
  const { data: sub } = await supabaseAdmin
    .from("website_form_submissions")
    .select("id, form_id, data, status")
    .eq("id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle() as { data: { id: string; form_id: string; data: Record<string, unknown>; status: string } | null };
  if (!sub || sub.status !== "spam") { res.status(404).json({ error: "Quarantined submission not found" }); return; }

  const { data: form } = await supabaseAdmin
    .from("website_forms")
    .select("form_type")
    .eq("id", sub.form_id)
    .maybeSingle() as { data: { form_type: string | null } | null };
  const formType = String(form?.form_type || "contact");

  const data = { ...(sub.data || {}) };
  delete (data as Record<string, unknown>)._spam_reason;

  const enquiryId = await createEnquiryFromFormSubmission(req.tenantId!, sub.id, formType, data);
  if (!enquiryId) { res.status(500).json({ error: "Failed to restore submission" }); return; }
  res.json({ ok: true, enquiry_id: enquiryId });
});

router.delete("/form-blocklist/quarantine/:id", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("website_form_submissions")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .eq("status", "spam");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

export default router;
