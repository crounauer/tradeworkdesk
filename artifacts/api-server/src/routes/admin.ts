import { Router, type IRouter, type Response } from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { sendConfirmationEmail, sendNewRegistrationNotification } from "../lib/email";
import { stripe } from "../lib/stripe";
import crypto from "crypto";
import { seedDefaultJobTypesForTenant } from "../lib/job-types-seed";

const router: IRouter = Router();

async function requireNotSoleTrader(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  if (!req.tenantId) return true;
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_type")
    .eq("id", req.tenantId)
    .single();
  if (tenant?.company_type === "sole_trader") {
    res.status(403).json({ error: "Team management is not available in sole trader mode. Switch to Company mode first." });
    return false;
  }
  return true;
}

router.get("/admin/users", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireNotSoleTrader(req, res))) return;
  let q = supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.patch("/admin/users/:id", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireNotSoleTrader(req, res))) return;
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

router.delete("/admin/users/:id", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireNotSoleTrader(req, res))) return;
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

router.get("/admin/invite-codes", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireNotSoleTrader(req, res))) return;
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

router.post("/admin/invite-codes", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireNotSoleTrader(req, res))) return;
  const { role = "technician", expires_at, note } = req.body;

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("plan_id, plans(max_users)")
    .eq("id", req.tenantId!)
    .single();

  if (tenant?.plans) {
    const maxUsers = (tenant.plans as { max_users?: number }).max_users ?? 999;
    const { count: currentUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", req.tenantId!)
      .eq("is_active", true);

    const { count: activeInvites } = await supabaseAdmin
      .from("invite_codes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", req.tenantId!)
      .eq("is_active", true)
      .is("used_at", null);

    if ((currentUsers || 0) + (activeInvites || 0) >= maxUsers) {
      res.status(400).json({
        error: `You've reached your plan's limit of ${maxUsers} users. Please upgrade your plan to add more team members.`,
        code: "MAX_USERS_REACHED",
      });
      return;
    }
  }

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

router.delete("/admin/invite-codes/:id", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireNotSoleTrader(req, res))) return;
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

  if (inv.tenant_id) {
    const { data: invTenant } = await supabaseAdmin
      .from("tenants")
      .select("plan_id, plans(max_users)")
      .eq("id", inv.tenant_id)
      .single();

    if (invTenant?.plans) {
      const maxUsers = (invTenant.plans as { max_users?: number }).max_users ?? 999;
      const { count: currentUsers } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", inv.tenant_id)
        .eq("is_active", true);

      if ((currentUsers || 0) >= maxUsers) {
        res.status(400).json({
          error: `This company has reached its maximum number of users (${maxUsers}). Please ask the admin to upgrade the plan.`,
          code: "MAX_USERS_REACHED",
        });
        return;
      }
    }
  }

  const profileUpdates: Record<string, unknown> = { role: inv.role, can_be_assigned_jobs: inv.role === "technician" };
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

router.get("/admin/lookup-options", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { category } = req.query as { category?: string };

  let query = supabaseAdmin
    .from("lookup_options")
    .select("*")
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
    "default_hourly_rate", "call_out_fee", "default_vat_rate", "default_payment_terms_days", "currency",
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

router.post("/admin/switch-to-company", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: tenant, error: fetchErr } = await supabaseAdmin
    .from("tenants")
    .select("company_type")
    .eq("id", req.tenantId!)
    .single();

  if (fetchErr || !tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  if (tenant.company_type === "company") { res.json({ message: "Already in company mode" }); return; }

  const { error } = await supabaseAdmin
    .from("tenants")
    .update({ company_type: "company" })
    .eq("id", req.tenantId!);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true, company_type: "company" });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const { company_name, contact_name, contact_email, contact_phone, password, plan_id, company_type } = req.body;

  const resolvedCompanyType = company_type === "sole_trader" ? "sole_trader" : "company";
  const resolvedCompanyName = resolvedCompanyType === "sole_trader" && !company_name ? contact_name : company_name;

  if (!resolvedCompanyName || !contact_email || !password || !contact_name) {
    res.status(400).json({ error: "contact_name, contact_email, and password are required." });
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
      company_name: resolvedCompanyName,
      contact_name,
      contact_email,
      contact_phone: contact_phone || null,
      status: "trial",
      plan_id: plan_id || "00000000-0000-0000-0000-000000000001",
      trial_ends_at: trialEnds,
      company_type: resolvedCompanyType,
    })
    .select()
    .single();

  if (tenantError) {
    console.error("[register] tenant insert failed:", tenantError.message);
    res.status(500).json({ error: tenantError.message });
    return;
  }

  const { data: linkData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
    type: "signup",
    email: contact_email,
    password,
    options: {
      data: {
        full_name: contact_name,
        role: "admin",
        tenant_id: tenant.id,
      },
    },
  });

  if (authError || !linkData) {
    console.error("[register] generateLink failed:", authError?.message);
    await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
    res.status(400).json({ error: authError?.message ?? "Failed to create account" });
    return;
  }

  // Upsert the profile — ensures correct tenant_id/role even if the trigger
  // inserted a row without them (or failed silently with the safety net).
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: linkData.user.id,
        email: contact_email,
        full_name: contact_name,
        role: "admin",
        tenant_id: tenant.id,
      },
      { onConflict: "id" }
    );
  if (profileError) {
    console.error("[register] profile upsert failed:", JSON.stringify(profileError));
  }

  await supabaseAdmin.from("company_settings").insert({
    singleton_id: "default",
    tenant_id: tenant.id,
    name: resolvedCompanyName,
  });

  seedDefaultJobTypesForTenant(tenant.id).catch((e) =>
    console.error("[seed] Default job types failed for tenant", tenant.id, e)
  );

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: linkData.user.id,
    actor_email: contact_email,
    event_type: "company_registered",
    entity_type: "tenant",
    entity_id: tenant.id,
    detail: { company_name: resolvedCompanyName },
  });

  sendConfirmationEmail(contact_email, contact_name, resolvedCompanyName, linkData.properties.action_link).catch((e) =>
    console.error("[email] Confirmation email failed:", e)
  );

  supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("role", "super_admin")
    .then(({ data: superAdmins }) => {
      if (superAdmins?.length) {
        for (const sa of superAdmins) {
          sendNewRegistrationNotification(
            sa.email,
            resolvedCompanyName,
            contact_name,
            contact_email,
            resolvedCompanyType,
          ).catch((e) => console.error("[email] Super-admin notification failed:", e));
        }
      }
    })
    .catch((e) => console.error("[email] Failed to fetch super_admins:", e));

  res.status(201).json({
    tenant_id: tenant.id,
    user_id: linkData.user.id,
    email: contact_email,
    message: "Check your email to confirm your account.",
  });
});

router.get("/admin/company-type", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("company_type, plan_id, plans(features, name)")
    .eq("id", req.tenantId!)
    .single();

  if (error || !tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const { count: userCount } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  const features = (tenant.plans as { features?: Record<string, boolean> } | null)?.features ?? {};

  res.json({
    company_type: tenant.company_type,
    has_team_management: !!features.team_management,
    plan_name: (tenant.plans as { name?: string } | null)?.name ?? null,
    active_user_count: userCount || 0,
  });
});

router.post("/admin/company-type/upgrade", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_type, plan_id, plans(features)")
    .eq("id", req.tenantId!)
    .single();

  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  if (tenant.company_type === "company") {
    res.status(400).json({ error: "Already operating as a company." }); return;
  }

  const features = (tenant.plans as { features?: Record<string, boolean> } | null)?.features ?? {};
  if (!features.team_management) {
    res.status(400).json({
      error: "Your current plan doesn't include team management. Please upgrade your plan first.",
      code: "PLAN_UPGRADE_REQUIRED",
    });
    return;
  }

  await supabaseAdmin
    .from("tenants")
    .update({ company_type: "company" })
    .eq("id", req.tenantId!);

  await supabaseAdmin
    .from("profiles")
    .update({ can_be_assigned_jobs: true })
    .eq("id", req.userId!)
    .eq("tenant_id", req.tenantId!);

  res.json({ success: true, company_type: "company" });
});

router.post("/admin/company-type/downgrade", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_type")
    .eq("id", req.tenantId!)
    .single();

  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  if (tenant.company_type === "sole_trader") {
    res.status(400).json({ error: "Already operating as a sole trader." }); return;
  }

  const { count: userCount } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  if ((userCount || 0) > 1) {
    res.status(400).json({
      error: "You must remove all other team members before switching to sole trader mode. Currently there are " + ((userCount || 0) - 1) + " other user(s).",
      code: "USERS_EXIST",
    });
    return;
  }

  await supabaseAdmin
    .from("tenants")
    .update({ company_type: "sole_trader" })
    .eq("id", req.tenantId!);

  await supabaseAdmin
    .from("invite_codes")
    .update({ is_active: false })
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .is("used_at", null);

  await supabaseAdmin
    .from("profiles")
    .update({ can_be_assigned_jobs: true })
    .eq("id", req.userId!)
    .eq("tenant_id", req.tenantId!);

  res.json({ success: true, company_type: "sole_trader" });
});

router.post("/admin/jobs/bulk-reassign", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { from_user_id, to_user_id, date_from, date_to, statuses } = req.body;

  if (!to_user_id) {
    res.status(400).json({ error: "to_user_id is required" }); return;
  }

  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, can_be_assigned_jobs")
    .eq("id", to_user_id)
    .eq("tenant_id", req.tenantId!)
    .single();

  if (!targetProfile) {
    res.status(404).json({ error: "Target user not found in this company" }); return;
  }

  let q = supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  if (from_user_id === "unassigned") {
    q = q.is("assigned_technician_id", null);
  } else if (from_user_id) {
    q = q.eq("assigned_technician_id", from_user_id);
  }

  if (date_from) q = q.gte("scheduled_date", date_from);
  if (date_to) q = q.lte("scheduled_date", date_to);

  const allowedStatuses = statuses && Array.isArray(statuses) && statuses.length > 0
    ? statuses
    : ["scheduled", "in_progress", "requires_follow_up", "awaiting_parts"];

  q = q.in("status", allowedStatuses);

  const { data: matchingJobs, error: fetchError } = await q;
  if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }

  if (!matchingJobs || matchingJobs.length === 0) {
    res.json({ success: true, reassigned_count: 0 }); return;
  }

  const jobIds = matchingJobs.map((j: { id: string }) => j.id);

  const { error: updateError } = await supabaseAdmin
    .from("jobs")
    .update({ assigned_technician_id: to_user_id, updated_at: new Date().toISOString() })
    .in("id", jobIds)
    .eq("tenant_id", req.tenantId!);

  if (updateError) { res.status(500).json({ error: updateError.message }); return; }

  res.json({ success: true, reassigned_count: jobIds.length });
});

router.get("/admin/assignable-users", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, can_be_assigned_jobs")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .eq("can_be_assigned_jobs", true)
    .order("full_name");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get("/admin/callout-rates", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("callout_rates")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .order("sort_order")
    .order("name");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/admin/callout-rates", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, amount, day_type, time_from, time_to, is_default, sort_order } = req.body;
  if (!name || amount == null) { res.status(400).json({ error: "name and amount are required" }); return; }
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) { res.status(400).json({ error: "amount must be a valid non-negative number" }); return; }

  if (is_default) {
    await supabaseAdmin.from("callout_rates").update({ is_default: false }).eq("tenant_id", req.tenantId!);
  }

  const { data, error } = await supabaseAdmin.from("callout_rates").insert({
    tenant_id: req.tenantId!,
    name,
    amount: Number(amount),
    day_type: day_type || "weekday",
    time_from: time_from || null,
    time_to: time_to || null,
    is_default: !!is_default,
    sort_order: sort_order ?? 0,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.put("/admin/callout-rates/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { name, amount, day_type, time_from, time_to, is_default, sort_order, is_active } = req.body;

  if (is_default) {
    await supabaseAdmin.from("callout_rates").update({ is_default: false }).eq("tenant_id", req.tenantId!).neq("id", id);
  }

  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    res.status(400).json({ error: "amount must be a valid non-negative number" }); return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (amount !== undefined) updates.amount = Number(amount);
  if (day_type !== undefined) updates.day_type = day_type;
  if (time_from !== undefined) updates.time_from = time_from || null;
  if (time_to !== undefined) updates.time_to = time_to || null;
  if (is_default !== undefined) updates.is_default = !!is_default;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabaseAdmin.from("callout_rates").update(updates).eq("id", id).eq("tenant_id", req.tenantId!).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/admin/callout-rates/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { error } = await supabaseAdmin.from("callout_rates").delete().eq("id", req.params.id).eq("tenant_id", req.tenantId!);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

router.get("/admin/products", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("product_catalogue")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .order("name");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/admin/products", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, default_price } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (default_price != null && (!Number.isFinite(Number(default_price)) || Number(default_price) < 0)) {
    res.status(400).json({ error: "default_price must be a valid non-negative number" }); return;
  }
  const { data, error } = await supabaseAdmin.from("product_catalogue").insert({
    tenant_id: req.tenantId!,
    name,
    default_price: default_price != null ? Number(default_price) : null,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.put("/admin/products/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, default_price, is_active } = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (default_price !== undefined) updates.default_price = default_price != null ? Number(default_price) : null;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabaseAdmin.from("product_catalogue").update(updates).eq("id", req.params.id).eq("tenant_id", req.tenantId!).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/admin/products/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { error } = await supabaseAdmin.from("product_catalogue").delete().eq("id", req.params.id).eq("tenant_id", req.tenantId!);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
