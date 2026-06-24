import { Router, type IRouter } from "express";
import multer from "multer";
import { bustInitCache } from "./platform";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { bustInvoicingCache } from "../middlewares/require-tenant-invoicing";
import { sendConfirmationEmail, sendNewRegistrationNotification } from "../lib/email";
import { stripe } from "../lib/stripe";
import crypto from "crypto";
import { seedDefaultJobTypesForTenant } from "../lib/job-types-seed";
import { syncSeats } from "./billing";
import { runServiceDueReminders, previewServiceDueReminders } from "../lib/service-reminders";
import { supabaseAdmin } from "../lib/supabase";
import { grantTrialUsageCredits, syncUserAddonSeats } from "../lib/tenant-limits";

const router: IRouter = Router();

async function insertTenantAuditLog(opts: {
  tenantId?: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  if (!opts.tenantId) return;
  await supabaseAdmin.from("tenant_audit_log").insert({
    tenant_id: opts.tenantId,
    actor_id: opts.actorId || null,
    actor_email: opts.actorEmail || null,
    actor_role: opts.actorRole || null,
    event_type: opts.eventType,
    entity_type: opts.entityType || null,
    entity_id: opts.entityId || null,
    detail: opts.detail || {},
  });
}

router.get("/admin/users", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
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
  const { id } = req.params;
  const { role, full_name, phone, can_be_assigned_jobs } = req.body;

  const { data: before } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name, phone, can_be_assigned_jobs")
    .eq("id", id)
    .eq("tenant_id", req.tenantId)
    .maybeSingle();

  if (id === req.userId && role && role !== "admin") {
    res.status(400).json({ error: "You cannot change your own role." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (can_be_assigned_jobs !== undefined) updates.can_be_assigned_jobs = !!can_be_assigned_jobs;
  // When role changes to/from technician, sync can_be_assigned_jobs unless explicitly overridden
  if (role !== undefined && can_be_assigned_jobs === undefined) {
    updates.can_be_assigned_jobs = role === "technician";
  }

  let q = supabaseAdmin.from("profiles").update(updates).eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await insertTenantAuditLog({
    tenantId: req.tenantId,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    eventType: "user_updated",
    entityType: "profile",
    entityId: id,
    detail: {
      before,
      after: data,
      updated_fields: Object.keys(updates),
    },
  });

  res.json(data);
});

router.delete("/admin/users/:id", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  if (id === req.userId) {
    res.status(400).json({ error: "You cannot remove your own account." });
    return;
  }

  let targetProfile: Record<string, unknown> | null = null;
  if (req.tenantId) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("id, tenant_id, role, email, full_name").eq("id", id).single();
    if (!profile || profile.tenant_id !== req.tenantId) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    targetProfile = profile as Record<string, unknown>;
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  // Sync per-seat billing after removing a user
  if (req.tenantId) {
    syncSeats(req.tenantId).catch((e) => console.error("[syncSeats] delete user:", e));
  }

  await insertTenantAuditLog({
    tenantId: req.tenantId,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    eventType: "user_deleted",
    entityType: "profile",
    entityId: id,
    detail: { deleted_user: targetProfile },
  });

  res.status(204).send();
});

router.get("/admin/audit-log", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { event_type, actor_id, limit: limitStr, offset: offsetStr } = req.query as { event_type?: string; actor_id?: string; limit?: string; offset?: string };
  const lim = Math.min(parseInt(limitStr || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(offsetStr || "0", 10) || 0, 0);

  let q = supabaseAdmin
    .from("tenant_audit_log")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + lim - 1);

  if (event_type) q = q.eq("event_type", event_type);
  if (actor_id) q = q.eq("actor_id", actor_id);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const rows = (data || []) as Array<Record<string, unknown>>;
  const missingActorRows = rows.filter((row) => !row.actor_email && row.actor_id).map((row) => String(row.actor_id));

  if (missingActorRows.length === 0) {
    res.json(rows);
    return;
  }

  const actorIds = [...new Set(missingActorRows)];
  const { data: actorProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .in("id", actorIds);

  const actorMap = new Map<string, { email?: string | null; role?: string | null }>();
  for (const p of (actorProfiles || []) as Array<{ id: string; email?: string | null; role?: string | null }>) {
    actorMap.set(p.id, { email: p.email || null, role: p.role || null });
  }

  const enriched = rows.map((row) => {
    if (row.actor_email || !row.actor_id) return row;
    const actor = actorMap.get(String(row.actor_id));
    if (!actor) return row;
    return {
      ...row,
      actor_email: actor.email || row.actor_email || null,
      actor_role: actor.role || row.actor_role || null,
    };
  });

  res.json(enriched);
});

router.get("/admin/invite-codes", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

  await insertTenantAuditLog({
    tenantId: req.tenantId,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    eventType: "invite_code_created",
    entityType: "invite_code",
    entityId: String((data as { id?: string })?.id || ""),
    detail: {
      role,
      expires_at: expires_at || null,
      note: note || null,
    },
  });

  res.status(201).json(data);
});

router.delete("/admin/invite-codes/:id", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("team_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin.from("invite_codes").update({ is_active: false }).eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { error } = await q;

  if (error) { res.status(500).json({ error: error.message }); return; }

  await insertTenantAuditLog({
    tenantId: req.tenantId,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    eventType: "invite_code_revoked",
    entityType: "invite_code",
    entityId: id,
  });

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

  // No hard user-count cap — extra users above 2 are billed via Stripe automatically.

  const profileUpdates: Record<string, unknown> = { role: inv.role, can_be_assigned_jobs: inv.role === "technician" };
  if (inv.tenant_id) profileUpdates.tenant_id = inv.tenant_id;

  await Promise.all([
    supabaseAdmin.from("invite_codes").update({ used_by: req.userId, used_at: new Date().toISOString() }).eq("id", inv.id),
    supabaseAdmin.from("profiles").update(profileUpdates).eq("id", req.userId!),
  ]);

  // Sync per-seat billing now this user has joined the tenant
  if (inv.tenant_id) {
    syncSeats(inv.tenant_id).catch((e) => console.error("[syncSeats] invite accept:", e));
  }

  await insertTenantAuditLog({
    tenantId: inv.tenant_id || undefined,
    actorId: req.userId,
    actorEmail: req.userEmail,
    eventType: "user_joined_via_invite",
    entityType: "profile",
    entityId: req.userId || null,
    detail: {
      role: inv.role,
      invite_id: inv.id,
    },
  });

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
    "notification_emails",
    "service_area", "coverage_radius_miles",
    "gas_safe_number", "oftec_number", "vat_number", "company_number",
    "default_hourly_rate", "call_out_fee", "default_vat_rate", "default_payment_terms_days", "currency",
    "rates_url", "trading_terms_url", "job_number_prefix",
    "google_calendar_enabled", "google_client_id", "google_client_secret",
    "sms_sender_name",
    // Invoicing settings
    "invoices_enabled", "invoice_number_prefix", "quote_number_prefix",
    "invoice_next_number", "quote_next_number", "quote_validity_days",
    "invoice_footer_text", "invoice_bank_details",
    // Payment method toggles
    "stripe_payments_enabled", "gocardless_payments_enabled",
    // Invoicing provider preference
    "invoicing_provider",
    // White-label branding
    "white_label_enabled", "brand_name", "primary_color", "accent_color",
    "favicon_url", "email_from_name", "email_reply_to",
    // Website enquiry notifications
    "website_enquiry_email_notify", "website_enquiry_sms_notify",
    // Website closure notice banner
    "website_closure_notice_enabled", "website_closure_notice_message",
    "website_closure_notice_start_date", "website_closure_notice_end_date",
    "website_closure_notice_auto_from_holidays",
  ];

  const updates: Record<string, unknown> = { singleton_id: SINGLETON_ID, tenant_id: req.tenantId };
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key] ?? null;
  }

  for (const urlField of ["rates_url", "trading_terms_url", "website"] as const) {
    const val = updates[urlField];
    if (val && typeof val === "string" && val.trim() !== "") {
      try {
        const parsed = new URL(val);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          res.status(400).json({ error: `${urlField} must use http or https` });
          return;
        }
      } catch {
        res.status(400).json({ error: `${urlField} is not a valid URL` });
        return;
      }
    }
  }

  if ("notification_emails" in updates) {
    const raw = updates.notification_emails;
    const normalized = (Array.isArray(raw)
      ? raw
      : typeof raw === "string"
      ? raw.split(/[\n,;]/)
      : [])
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = normalized.find((email) => !emailRegex.test(email));
    if (invalid) {
      res.status(400).json({ error: `Invalid email address in notification_emails: ${invalid}` });
      return;
    }

    updates.notification_emails = normalized.length > 0 ? Array.from(new Set(normalized)) : null;
  }

  // Validate hex colour format
  for (const colorField of ["primary_color", "accent_color"] as const) {
    const val = updates[colorField];
    if (val && typeof val === "string" && !/^#[0-9A-Fa-f]{6}$/.test(val)) {
      res.status(400).json({ error: `${colorField} must be a valid 6-digit hex colour (e.g. #6366f1)` });
      return;
    }
  }

  let { data, error } = await supabaseAdmin
    .from("company_settings")
    .upsert(updates, { onConflict: "singleton_id,tenant_id" })
    .select()
    .single();

  // Backward-compatibility: allow saves to succeed even if the latest DB patch
  // (auto holiday notice toggle column) has not been applied yet.
  if (
    error &&
    typeof error.message === "string" &&
    error.message.includes("website_closure_notice_auto_from_holidays") &&
    "website_closure_notice_auto_from_holidays" in updates
  ) {
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.website_closure_notice_auto_from_holidays;

    const retry = await supabaseAdmin
      .from("company_settings")
      .upsert(fallbackUpdates, { onConflict: "singleton_id,tenant_id" })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) { res.status(500).json({ error: error.message }); return; }

  const closureFields = [
    "website_closure_notice_enabled",
    "website_closure_notice_message",
    "website_closure_notice_start_date",
    "website_closure_notice_end_date",
    "website_closure_notice_auto_from_holidays",
  ] as const;
  const closureUpdates: Record<string, unknown> = {};
  for (const field of closureFields) {
    if (field in req.body) {
      closureUpdates[field] = req.body[field] ?? null;
    }
  }

  if (Object.keys(closureUpdates).length > 0) {
    let closureSave = await supabaseAdmin
      .from("company_settings")
      .update(closureUpdates)
      .eq("tenant_id", req.tenantId)
      .eq("singleton_id", SINGLETON_ID)
      .select()
      .single();

    if (
      closureSave.error &&
      typeof closureSave.error.message === "string" &&
      closureSave.error.message.includes("website_closure_notice_auto_from_holidays") &&
      "website_closure_notice_auto_from_holidays" in closureUpdates
    ) {
      const closureFallback = { ...closureUpdates };
      delete closureFallback.website_closure_notice_auto_from_holidays;

      closureSave = await supabaseAdmin
        .from("company_settings")
        .update(closureFallback)
        .eq("tenant_id", req.tenantId)
        .eq("singleton_id", SINGLETON_ID)
        .select()
        .single();
    }

    if (closureSave.error) {
      res.status(500).json({ error: closureSave.error.message });
      return;
    }

    data = closureSave.data;
  }

  // Bust invoicing-enabled cache if the toggle was changed
  if ("invoices_enabled" in updates && req.tenantId) {
    bustInvoicingCache(req.tenantId);
  }

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
  const { company_name, contact_name, contact_email, contact_phone, password, plan_id, product, company_type, addon_ids, addon_quantities = {}, beta_code, start_on_free } = req.body;

  // Skip beta code validation for now to enable dev testing
  let betaInvite: Record<string, unknown> | null = null;

  if (beta_code?.trim()) {
    const trimmedBetaCode = beta_code.trim().toUpperCase();

    const { data: bi, error: betaError } = await supabaseAdmin
      .from("beta_invites")
      .select("*")
      .eq("code", trimmedBetaCode)
      .eq("is_active", true)
      .single();

    if (bi) {
      betaInvite = bi;
    }
  }
  if (betaInvite) {
    if (betaInvite.expires_at && new Date(betaInvite.expires_at) < new Date()) {
      res.status(400).json({ error: "This beta invite code has expired." });
      return;
    }
    if (betaInvite.used_count >= betaInvite.max_uses) {
      res.status(400).json({ error: "This beta invite code has reached its usage limit." });
      return;
    }
    if (betaInvite.email && betaInvite.email.toLowerCase() !== (contact_email || "").toLowerCase()) {
      res.status(400).json({ error: "This beta code is reserved for a different email address." });
      return;
    }

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("beta_invites")
      .update({ used_count: betaInvite.used_count + 1 })
      .eq("code", beta_code.trim().toUpperCase())
      .eq("is_active", true)
      .lt("used_count", betaInvite.max_uses)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      res.status(400).json({ error: "This beta invite code is no longer available." });
      return;
    }
  }

  const resolvedCompanyType = "company";
  const resolvedCompanyName = company_name || contact_name;

  if (!resolvedCompanyName || !contact_email || !password || !contact_name) {
    res.status(400).json({ error: "contact_name, contact_email, and password are required." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";
  let trialDays = 30;
  try {
    const { data: setting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "trial_duration_days")
      .single();
    if (setting?.value && Number(setting.value) > 0) trialDays = Number(setting.value);
  } catch {}
  const trialEnds = new Date(Date.now() + trialDays * 86400000).toISOString();

  // Map product key to one or more name fragments so renamed plan labels still resolve.
  const PRODUCT_PLAN_CANDIDATES: Record<string, string[]> = {
    tradeworkdesk: ["tradeworkdesk", "job", "job management"],
    tradesite: ["tradesite", "website", "website builder"],
    bundle: ["bundle", "both"],
  };

  let resolvedPlanId = plan_id;
  if (start_on_free) {
    resolvedPlanId = FREE_PLAN_ID;
  } else if (!resolvedPlanId) {
    const productKey = (typeof product === "string" ? product : "").toLowerCase();
    const fragments = PRODUCT_PLAN_CANDIDATES[productKey] || [];
    if (fragments.length > 0) {
      const { data: productPlans } = await supabaseAdmin
        .from("plans")
        .select("id, name, monthly_price")
        .eq("is_active", true)
        .eq("is_legacy", false);

      const matching = (productPlans || []).filter((plan) => {
        const name = String(plan.name || "").toLowerCase();
        return fragments.some((fragment) => name.includes(fragment));
      });

      matching.sort((a, b) => Number(a.monthly_price || 0) - Number(b.monthly_price || 0));
      resolvedPlanId = matching[0]?.id;
    }
    if (!resolvedPlanId) {
      // Fallback: cheapest active non-legacy plan
      const { data: basePlan } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("is_active", true)
        .eq("is_legacy", false)
        .gt("monthly_price", 0)
        .order("monthly_price", { ascending: true })
        .limit(1)
        .maybeSingle();
      resolvedPlanId = basePlan?.id || "00000000-0000-0000-0000-000000000001";
    }
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .insert({
      company_name: resolvedCompanyName,
      contact_name,
      contact_email,
      contact_phone: contact_phone || null,
      status: start_on_free ? "active" as const : "trial" as const,
      plan_id: resolvedPlanId,
      trial_ends_at: start_on_free ? null : trialEnds,
      company_type: resolvedCompanyType,
      source: (["tradeworkdesk", "tradesite", "bundle"].includes((typeof product === "string" ? product : "").toLowerCase()) ? (product as string).toLowerCase() : "tradeworkdesk") as "tradeworkdesk" | "tradesite" | "bundle",
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

  if (Array.isArray(addon_ids) && addon_ids.length > 0) {
    const { data: validAddons } = await supabaseAdmin
      .from("addons")
      .select("id")
      .in("id", addon_ids)
      .eq("is_active", true);

    if (validAddons && validAddons.length > 0) {
      const inserts = validAddons.map((a: { id: string }) => ({
        tenant_id: tenant.id,
        addon_id: a.id,
        is_active: true,
        quantity: Math.max(1, Math.floor(addon_quantities?.[a.id] || 1)),
        activated_at: new Date().toISOString(),
      }));
      await supabaseAdmin.from("tenant_addons").upsert(inserts, { onConflict: "tenant_id,addon_id" }).then(({ error }) => {
        if (error) console.error("[register] addon insert failed:", error.message);
      });
    }
  }

  await supabaseAdmin.from("company_settings").insert({
    singleton_id: "default",
    tenant_id: tenant.id,
    name: resolvedCompanyName,
  });

  seedDefaultJobTypesForTenant(tenant.id).catch((e) =>
    console.error("[seed] Default job types failed for tenant", tenant.id, e)
  );

  await grantTrialUsageCredits(tenant.id).catch((e) =>
    console.error("[trial-credits] Failed to grant initial trial credits", tenant.id, e)
  );

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: linkData.user.id,
    actor_email: contact_email,
    event_type: "company_registered",
    entity_type: "tenant",
    entity_id: tenant.id,
    detail: { company_name: resolvedCompanyName },
  });

  let confirmLink = linkData.properties.action_link;
  const PROD_URL = "https://www.tradeworkdesk.co.uk";
  if (confirmLink && confirmLink.includes("localhost")) {
    confirmLink = confirmLink.replace(/https?:\/\/localhost:\d+/, PROD_URL);
  }

  sendConfirmationEmail(contact_email, contact_name, resolvedCompanyName, confirmLink).catch((e) =>
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
    .select("company_type, plan_id, plans(name)")
    .eq("id", req.tenantId!)
    .single();

  if (error || !tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const { count: userCount } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  res.json({
    company_type: tenant.company_type,
    has_team_management: true,
    plan_name: (tenant.plans as { name?: string } | null)?.name ?? null,
    active_user_count: userCount || 0,
  });
});

router.post("/admin/company-type/upgrade", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_type, plan_id")
    .eq("id", req.tenantId!)
    .single();

  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  if (tenant.company_type === "company") {
    res.status(400).json({ error: "Already operating as a company." }); return;
  }

  await supabaseAdmin
    .from("tenants")
    .update({ company_type: "company" })
    .eq("id", req.tenantId!);

  await supabaseAdmin
    .from('profiles')
    .update({ can_be_assigned_jobs: true })
    .eq('id', req.userId!)
    .eq('tenant_id', req.tenantId!);

  bustInitCache(req.tenantId!);
  res.json({ success: true, company_type: 'company' });
});

router.post('/admin/company-type/downgrade', requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
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
    .from('profiles')
    .update({ can_be_assigned_jobs: true })
    .eq('id', req.userId!)
    .eq('tenant_id', req.tenantId!);

  bustInitCache(req.tenantId!);
  res.json({ success: true, company_type: 'sole_trader' });
});

router.post('/admin/jobs/bulk-reassign', requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

const calloutRatesCache = new Map<string, { data: unknown; ts: number; ver: number }>();
const calloutRatesCacheVer = new Map<string, number>();
const CALLOUT_RATES_CACHE_TTL = 30_000;

function invalidateCalloutRatesCache(tenantId: string) {
  calloutRatesCacheVer.set(tenantId, (calloutRatesCacheVer.get(tenantId) || 0) + 1);
  calloutRatesCache.delete(tenantId);
}

router.get("/admin/callout-rates", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const cacheKey = req.tenantId!;
  const cached = calloutRatesCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CALLOUT_RATES_CACHE_TTL) {
    res.set("Cache-Control", "private, max-age=30");
    res.json(cached.data);
    return;
  }
  const verBefore = calloutRatesCacheVer.get(cacheKey) || 0;
  const { data, error } = await supabaseAdmin
    .from("callout_rates")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .order("sort_order")
    .order("name");
  if (error) { res.status(500).json({ error: error.message }); return; }
  const result = data || [];
  const verAfter = calloutRatesCacheVer.get(cacheKey) || 0;
  if (verBefore === verAfter) {
    calloutRatesCache.set(cacheKey, { data: result, ts: Date.now(), ver: verAfter });
  }
  res.set("Cache-Control", "private, max-age=30");
  res.json(result);
});

router.post("/admin/callout-rates", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, amount, day_type, time_from, time_to, is_default, sort_order, hourly_rate } = req.body;
  if (!name || amount == null) { res.status(400).json({ error: "name and amount are required" }); return; }
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) { res.status(400).json({ error: "amount must be a valid non-negative number" }); return; }
  if (hourly_rate !== undefined && hourly_rate !== null && (!Number.isFinite(Number(hourly_rate)) || Number(hourly_rate) < 0)) {
    res.status(400).json({ error: "hourly_rate must be a valid non-negative number" }); return;
  }

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
    hourly_rate: hourly_rate != null && hourly_rate !== "" ? Number(hourly_rate) : null,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  invalidateCalloutRatesCache(req.tenantId!);
  res.json(data);
});

router.put("/admin/callout-rates/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { name, amount, day_type, time_from, time_to, is_default, sort_order, is_active, hourly_rate } = req.body;

  if (is_default) {
    await supabaseAdmin.from("callout_rates").update({ is_default: false }).eq("tenant_id", req.tenantId!).neq("id", id);
  }

  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    res.status(400).json({ error: "amount must be a valid non-negative number" }); return;
  }
  if (hourly_rate !== undefined && hourly_rate !== null && hourly_rate !== "" && (!Number.isFinite(Number(hourly_rate)) || Number(hourly_rate) < 0)) {
    res.status(400).json({ error: "hourly_rate must be a valid non-negative number" }); return;
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
  if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate != null && hourly_rate !== "" ? Number(hourly_rate) : null;

  const { data, error } = await supabaseAdmin.from("callout_rates").update(updates).eq("id", id).eq("tenant_id", req.tenantId!).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  invalidateCalloutRatesCache(req.tenantId!);
  res.json(data);
});

router.delete("/admin/callout-rates/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { error } = await supabaseAdmin.from("callout_rates").delete().eq("id", req.params.id).eq("tenant_id", req.tenantId!);
  if (error) { res.status(500).json({ error: error.message }); return; }
  invalidateCalloutRatesCache(req.tenantId!);
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

// ─── Service Catalogue Admin CRUD ────────────────────────────────────────────

router.get("/admin/service-catalogue", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("service_catalogue")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .order("name");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/admin/service-catalogue", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, default_price } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (default_price != null && (!Number.isFinite(Number(default_price)) || Number(default_price) < 0)) {
    res.status(400).json({ error: "default_price must be a valid non-negative number" }); return;
  }
  const { data, error } = await supabaseAdmin.from("service_catalogue").insert({
    tenant_id: req.tenantId!,
    name,
    default_price: default_price != null ? Number(default_price) : null,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.put("/admin/service-catalogue/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, default_price, is_active } = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (default_price !== undefined) updates.default_price = default_price != null ? Number(default_price) : null;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabaseAdmin.from("service_catalogue").update(updates).eq("id", req.params.id).eq("tenant_id", req.tenantId!).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/admin/service-catalogue/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { error } = await supabaseAdmin.from("service_catalogue").delete().eq("id", req.params.id).eq("tenant_id", req.tenantId!);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

// Service reminder endpoints (platform super_admin only)
router.get("/admin/service-reminders/preview", requireAuth, requireRole("super_admin"), async (_req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const data = await previewServiceDueReminders();
    res.json({ reminders: data, count: data.length });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
  }
});

router.post("/admin/service-reminders/send", requireAuth, requireRole("super_admin"), async (_req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const result = await runServiceDueReminders();
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// Per-user addon assignment
// ──────────────────────────────────────────────────────────────

// GET /api/admin/user-addons — list all user-addon assignments for this tenant
router.get("/admin/user-addons", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("user_addons")
    .select("id, user_id, addon_id, is_active, activated_at, addons(id, name, feature_keys), profiles(id, full_name, email)")
    .eq("tenant_id", req.tenantId!)
    .order("activated_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// GET /api/admin/available-addons — list per-seat addons the tenant has active (for use in UI)
router.get("/admin/available-addons", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("tenant_addons")
    .select("id, addon_id, addons(id, name, feature_keys, monthly_price)")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .eq("addons.is_per_seat", true);

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Filter to only rows where the addon is per-seat
  const perSeat = (data ?? []).filter(row => row.addons !== null);
  res.json(perSeat);
});

// PUT /api/admin/users/:userId/addons — set which per-seat addons a user has
router.put("/admin/users/:userId/addons", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId } = req.params;
  const { addon_ids } = req.body as { addon_ids: string[] };

  if (!Array.isArray(addon_ids)) {
    res.status(400).json({ error: "addon_ids must be an array" });
    return;
  }

  // Verify user belongs to this tenant
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .eq("tenant_id", req.tenantId!)
    .single();

  if (!profile) { res.status(404).json({ error: "User not found" }); return; }

  // Fetch available per-seat addons active for this tenant
  const { data: tenantAddons } = await supabaseAdmin
    .from("tenant_addons")
    .select("addon_id, addons(id, is_per_seat)")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  const perSeatAddonIds: string[] = (tenantAddons ?? [])
    .filter(ta => (ta.addons as { is_per_seat?: boolean } | null)?.is_per_seat)
    .map(ta => ta.addon_id as string);

  // Upsert user_addons: activate requested, deactivate others
  const changedAddonIds = new Set<string>();

  for (const addonId of perSeatAddonIds) {
    const shouldBeActive = addon_ids.includes(addonId);
    const { data: existing } = await supabaseAdmin
      .from("user_addons")
      .select("id, is_active")
      .eq("tenant_id", req.tenantId!)
      .eq("user_id", userId)
      .eq("addon_id", addonId)
      .maybeSingle();

    if (existing) {
      if ((existing as { is_active: boolean }).is_active !== shouldBeActive) {
        await supabaseAdmin
          .from("user_addons")
          .update({ is_active: shouldBeActive } as Record<string, unknown>)
          .eq("id", (existing as { id: string }).id);
        changedAddonIds.add(addonId);
      }
    } else if (shouldBeActive) {
      await supabaseAdmin.from("user_addons").insert({
        tenant_id: req.tenantId!,
        user_id: userId,
        addon_id: addonId,
        is_active: true,
      } as Record<string, unknown>);
      changedAddonIds.add(addonId);
    }
  }

  // Sync seat counts for any changed addons
  for (const addonId of changedAddonIds) {
    await syncUserAddonSeats(req.tenantId!, addonId);
  }

  res.json({ ok: true, updated: changedAddonIds.size });
});

export default router;
