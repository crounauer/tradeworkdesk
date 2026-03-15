import { Router, type IRouter } from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/admin/users", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.patch("/admin/users/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

  let q = supabaseAdmin.from("profiles").update(updates).eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/admin/users/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  if (id === req.userId) {
    res.status(400).json({ error: "You cannot remove your own account." });
    return;
  }

  if (req.tenantId) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("tenant_id").eq("id", id).single();
    if (!profile || profile.tenant_id !== req.tenantId) {
      res.status(404).json({ error: "User not found" });
      return;
    }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(204).send();
});

router.get("/admin/invite-codes", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

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

router.post("/admin/invite-codes", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
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
      tenant_id: req.tenantId,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.delete("/admin/invite-codes/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin.from("invite_codes").update({ is_active: false }).eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { error } = await q;

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

router.post("/auth/validate-invite", async (req, res): Promise<void> => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Code is required." }); return; }

  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("id, role, expires_at, used_at, is_active, tenant_id")
    .eq("code", (code as string).toUpperCase().trim())
    .single();

  if (error || !data) { res.status(404).json({ error: "Invalid invite code." }); return; }

  const invite = data as { id: string; role: string; expires_at: string | null; used_at: string | null; is_active: boolean; tenant_id: string | null };
  if (!invite.is_active) { res.status(400).json({ error: "This invite code has been revoked." }); return; }
  if (invite.used_at) { res.status(400).json({ error: "This invite code has already been used." }); return; }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    res.status(400).json({ error: "This invite code has expired." }); return;
  }

  res.json({ valid: true, role: invite.role });
});

router.post("/auth/use-invite", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Code is required." }); return; }

  const { data: invite, error: fetchError } = await supabaseAdmin
    .from("invite_codes")
    .select("id, role, expires_at, used_at, is_active, tenant_id")
    .eq("code", (code as string).toUpperCase().trim())
    .eq("is_active", true)
    .is("used_at", null)
    .single();

  if (fetchError || !invite) { res.status(400).json({ error: "Invalid or already used invite code." }); return; }

  const inv = invite as { id: string; role: string; expires_at: string | null; tenant_id: string | null };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    res.status(400).json({ error: "Invite code has expired." }); return;
  }

  const profileUpdates: Record<string, unknown> = { role: inv.role };
  if (inv.tenant_id) profileUpdates.tenant_id = inv.tenant_id;

  await Promise.all([
    supabaseAdmin.from("invite_codes").update({ used_by: req.userId, used_at: new Date().toISOString() }).eq("id", inv.id),
    supabaseAdmin.from("profiles").update(profileUpdates).eq("id", req.userId!),
  ]);

  res.json({ success: true, role: inv.role });
});

const ALLOWED_LOOKUP_CATEGORIES = new Set([
  "property_type",
  "occupancy_type",
  "boiler_type",
  "fuel_type",
]);

router.get("/lookup-options", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { category } = req.query as { category?: string };

  let query = supabaseAdmin
    .from("lookup_options")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (req.tenantId) query = query.eq("tenant_id", req.tenantId);

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

router.post("/admin/lookup-options", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
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
    .insert({ category, value: valueStr, label: labelStr, sort_order: sort_order ?? 0, tenant_id: req.tenantId })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.put("/admin/lookup-options/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

  let q = supabaseAdmin
    .from("lookup_options")
    .update(updates)
    .eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/admin/lookup-options/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let delQ = supabaseAdmin
    .from("lookup_options")
    .delete()
    .eq("id", id);
  if (req.tenantId) delQ = delQ.eq("tenant_id", req.tenantId);

  const { error } = await delQ;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

const SINGLETON_ID = "default";

router.get("/company-settings", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("singleton_id", SINGLETON_ID);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No company settings configured yet." }); return; }
  res.json(data);
});

router.get("/admin/company-settings", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("singleton_id", SINGLETON_ID);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? {});
});

router.put("/admin/company-settings", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const allowed = [
    "name", "trading_name",
    "address_line1", "address_line2", "city", "county", "postcode", "country",
    "phone", "email", "website",
    "gas_safe_number", "oftec_number", "vat_number", "company_number",
  ];

  const updates: Record<string, unknown> = { singleton_id: SINGLETON_ID, tenant_id: req.tenantId };
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key] ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .upsert(updates, { onConflict: "singleton_id,tenant_id" })
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

router.post("/admin/company-settings/logo", requireAuth, requireTenant, requireRole("admin"), logoUpload.single("logo"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded." }); return; }

  const tenantPrefix = req.tenantId ? `${req.tenantId}/` : "";
  const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `${tenantPrefix}logo.${ext}`;

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
      { singleton_id: SINGLETON_ID, tenant_id: req.tenantId, logo_url: logoUrl, logo_storage_path: storagePath },
      { onConflict: "singleton_id,tenant_id" }
    )
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ logo_url: data.logo_url, logo_storage_path: data.logo_storage_path });
});

router.delete("/admin/company-settings/logo", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let currentQ = supabaseAdmin
    .from("company_settings")
    .select("logo_storage_path")
    .eq("singleton_id", SINGLETON_ID);
  if (req.tenantId) currentQ = currentQ.eq("tenant_id", req.tenantId);
  const { data: current } = await currentQ.maybeSingle();

  if (current?.logo_storage_path) {
    await supabaseAdmin.storage.from("company-logos").remove([current.logo_storage_path]);
  }

  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .upsert(
      { singleton_id: SINGLETON_ID, tenant_id: req.tenantId, logo_url: null, logo_storage_path: null },
      { onConflict: "singleton_id,tenant_id" }
    )
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.post("/auth/register-company", async (req, res): Promise<void> => {
  const { company_name, contact_name, contact_email, contact_phone, password, plan_id } = req.body;

  if (!company_name || !contact_email || !password || !contact_name) {
    res.status(400).json({ error: "company_name, contact_name, contact_email, and password are required." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const trialEnds = new Date(Date.now() + 14 * 86400000).toISOString();

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .insert({
      company_name,
      contact_name,
      contact_email,
      contact_phone: contact_phone || null,
      status: "trial",
      plan_id: plan_id || "00000000-0000-0000-0000-000000000001",
      trial_ends_at: trialEnds,
    })
    .select()
    .single();

  if (tenantError) { res.status(500).json({ error: tenantError.message }); return; }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: contact_email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: contact_name,
      role: "admin",
      tenant_id: tenant.id,
    },
  });

  if (authError) {
    await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
    res.status(400).json({ error: authError.message });
    return;
  }

  await supabaseAdmin
    .from("profiles")
    .update({ tenant_id: tenant.id, role: "admin" })
    .eq("id", authData.user.id);

  await supabaseAdmin.from("company_settings").insert({
    singleton_id: "default",
    tenant_id: tenant.id,
    name: company_name,
  });

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: authData.user.id,
    actor_email: contact_email,
    event_type: "company_registered",
    entity_type: "tenant",
    entity_id: tenant.id,
    detail: { company_name },
  });

  res.status(201).json({
    tenant_id: tenant.id,
    user_id: authData.user.id,
    message: "Company registered successfully. Please sign in.",
  });
});

export default router;
