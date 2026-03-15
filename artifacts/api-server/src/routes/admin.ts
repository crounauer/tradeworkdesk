import { Router, type IRouter } from "express";
import multer from "multer";
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

// ─── Lookup Options (public read, admin write) ────────────────────────────────

const ALLOWED_LOOKUP_CATEGORIES = new Set([
  "property_type",
  "occupancy_type",
  "boiler_type",
  "fuel_type",
]);

// Public: active options only (used by all forms)
router.get("/lookup-options", requireAuth, async (req, res): Promise<void> => {
  const { category } = req.query as { category?: string };

  let query = supabaseAdmin
    .from("lookup_options")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (category) {
    if (!ALLOWED_LOOKUP_CATEGORIES.has(category)) {
      res.status(400).json({ error: "Invalid category." }); return;
    }
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

// Admin: all options including inactive (used by admin management page)
router.get("/admin/lookup-options", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { category } = req.query as { category?: string };

  let query = supabaseAdmin
    .from("lookup_options")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (category) {
    if (!ALLOWED_LOOKUP_CATEGORIES.has(category)) {
      res.status(400).json({ error: "Invalid category." }); return;
    }
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/admin/lookup-options", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { category, value, label, sort_order } = req.body;
  if (!category || !value || !label) {
    res.status(400).json({ error: "category, value, and label are required." }); return;
  }
  if (!ALLOWED_LOOKUP_CATEGORIES.has(category)) {
    res.status(400).json({ error: `category must be one of: ${[...ALLOWED_LOOKUP_CATEGORIES].join(", ")}.` }); return;
  }
  const valueStr = String(value).trim();
  const labelStr = String(label).trim();
  if (!/^[a-z0-9_]+$/.test(valueStr)) {
    res.status(400).json({ error: "value must contain only lowercase letters, numbers, and underscores." }); return;
  }
  if (labelStr.length > 100) {
    res.status(400).json({ error: "label must be 100 characters or fewer." }); return;
  }

  const { data, error } = await supabaseAdmin
    .from("lookup_options")
    .insert({ category, value: valueStr, label: labelStr, sort_order: sort_order ?? 0 })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.put("/admin/lookup-options/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { id } = req.params;
  const { label, sort_order, is_active } = req.body;

  const updates: Record<string, unknown> = {};
  if (label !== undefined) {
    const labelStr = String(label).trim();
    if (labelStr.length === 0 || labelStr.length > 100) {
      res.status(400).json({ error: "label must be between 1 and 100 characters." }); return;
    }
    updates.label = labelStr;
  }
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);

  const { data, error } = await supabaseAdmin
    .from("lookup_options")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/admin/lookup-options/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from("lookup_options")
    .delete()
    .eq("id", id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

// ─── Company Settings ─────────────────────────────────────────────────────────

const SINGLETON_ID = "default";

router.get("/company-settings", requireAuth, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("singleton_id", SINGLETON_ID)
    .maybeSingle();

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No company settings configured yet." }); return; }
  res.json(data);
});

router.get("/admin/company-settings", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("singleton_id", SINGLETON_ID)
    .maybeSingle();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? {});
});

router.put("/admin/company-settings", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const allowed = [
    "name", "trading_name",
    "address_line1", "address_line2", "city", "county", "postcode", "country",
    "phone", "email", "website",
    "gas_safe_number", "oftec_number", "vat_number", "company_number",
  ];

  const updates: Record<string, unknown> = { singleton_id: SINGLETON_ID };
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key] ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .upsert(updates, { onConflict: "singleton_id" })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed."));
      return;
    }
    cb(null, true);
  },
});

router.post("/admin/company-settings/logo", requireAuth, requireRole("admin"), logoUpload.single("logo"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded." }); return; }

  const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `logo.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("company-logos")
    .upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });

  if (uploadError) { res.status(500).json({ error: uploadError.message }); return; }

  const { data: urlData } = supabaseAdmin.storage
    .from("company-logos")
    .getPublicUrl(storagePath);

  const logoUrl = urlData.publicUrl;

  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .upsert(
      { singleton_id: SINGLETON_ID, logo_url: logoUrl, logo_storage_path: storagePath },
      { onConflict: "singleton_id" }
    )
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ logo_url: data.logo_url, logo_storage_path: data.logo_storage_path });
});

router.delete("/admin/company-settings/logo", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const { data: current } = await supabaseAdmin
    .from("company_settings")
    .select("logo_storage_path")
    .eq("singleton_id", SINGLETON_ID)
    .maybeSingle();

  if (current?.logo_storage_path) {
    await supabaseAdmin.storage.from("company-logos").remove([current.logo_storage_path]);
  }

  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .upsert(
      { singleton_id: SINGLETON_ID, logo_url: null, logo_storage_path: null },
      { onConflict: "singleton_id" }
    )
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

export default router;

