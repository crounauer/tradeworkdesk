import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  ListCustomersQueryParams,
  ListCustomersResponse,
  CreateCustomerBody,
  GetCustomerParams,
  GetCustomerResponse,
  UpdateCustomerParams,
  UpdateCustomerBody,
  UpdateCustomerResponse,
  DeleteCustomerParams,
} from "@workspace/api-zod";
import { z } from "zod";
import { generateInviteToken, portalUserCache } from "./portal";
import { sendPortalInviteEmail, type EmailCompanyDetails } from "../lib/email";

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

router.get("/customers", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  let q = supabaseAdmin.from("customers").select("*").order("last_name");

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  if (query.success) {
    if (query.data.is_active !== undefined) {
      q = q.eq("is_active", query.data.is_active);
    } else {
      q = q.eq("is_active", true);
    }
    if (query.data.search) {
      const s = `%${query.data.search}%`;
      q = q.or(`business_name.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},mobile.ilike.${s},address_line1.ilike.${s},address_line2.ilike.${s},city.ilike.${s},county.ilike.${s},postcode.ilike.${s}`);
    }
  } else {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(ListCustomersResponse.parse(data || []));
});

router.post("/customers", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("customers").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  await insertTenantAuditLog({
    tenantId: req.tenantId,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    eventType: "customer_created",
    entityType: "customer",
    entityId: String((data as { id?: string })?.id || ""),
    detail: {
      first_name: (data as Record<string, unknown>).first_name,
      last_name: (data as Record<string, unknown>).last_name,
    },
  });

  res.status(201).json(data);
});

router.get("/customers/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("customers").select("*").eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: customer, error } = await q.single();
  if (error || !customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const { data: properties } = await supabaseAdmin
    .from("properties").select("*").eq("customer_id", params.data.id).eq("is_active", true).order("address_line1");

  res.json(GetCustomerResponse.parse({ ...customer, properties: properties || [] }));
});

router.patch("/customers/:id", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateCustomerBody.extend({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let q = supabaseAdmin.from("customers").update(body.data).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error || !data) { res.status(404).json({ error: "Customer not found" }); return; }

  await insertTenantAuditLog({
    tenantId: req.tenantId,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    eventType: "customer_updated",
    entityType: "customer",
    entityId: params.data.id,
    detail: {
      updated_fields: Object.keys(body.data),
    },
  });

  res.json(UpdateCustomerResponse.parse(data));
});

router.delete("/customers/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("customers").update({ is_active: false }).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  await insertTenantAuditLog({
    tenantId: req.tenantId,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    eventType: "customer_deleted",
    entityType: "customer",
    entityId: params.data.id,
  });

  res.sendStatus(204);
});

const ImportCustomerRow = z.object({
  title: z.string().optional(),
  business_name: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  postcode: z.string().optional(),
  notes: z.string().optional(),
});

const ImportCustomersBody = z.object({
  customers: z.array(z.record(z.string(), z.string().optional())),
  skipDuplicates: z.boolean().default(true),
});

router.post("/customers/import", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ImportCustomersBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { customers: rows, skipDuplicates } = parsed.data;
  const tenantId = req.tenantId!;

  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("email, phone, last_name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const emailSet = new Set<string>();
  const phoneLastNameSet = new Set<string>();
  for (const c of existing || []) {
    if (c.email) emailSet.add(c.email.toLowerCase().trim());
    if (c.phone && c.last_name) phoneLastNameSet.add(`${c.phone.trim()}|${c.last_name.toLowerCase().trim()}`);
  }

  let created = 0;
  let skipped = 0;
  const failed: { row: number; reason: string }[] = [];
  const toInsert: { data: Record<string, unknown>; csvRow: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const cleaned: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(raw)) {
      cleaned[k] = v?.trim() || undefined;
    }

    const v = ImportCustomerRow.safeParse(cleaned);
    if (!v.success) {
      failed.push({ row: i + 1, reason: "Missing required fields (first_name, last_name)" });
      continue;
    }

    const row = v.data;
    let isDuplicate = false;
    if (row.email && emailSet.has(row.email.toLowerCase().trim())) {
      isDuplicate = true;
    }
    if (!isDuplicate && row.phone && row.last_name) {
      const key = `${row.phone.trim()}|${row.last_name.toLowerCase().trim()}`;
      if (phoneLastNameSet.has(key)) isDuplicate = true;
    }

    if (isDuplicate && skipDuplicates) {
      skipped++;
      continue;
    }

    toInsert.push({ data: { ...row, tenant_id: tenantId }, csvRow: i + 1 });
    if (row.email) emailSet.add(row.email.toLowerCase().trim());
    if (row.phone && row.last_name) phoneLastNameSet.add(`${row.phone.trim()}|${row.last_name.toLowerCase().trim()}`);
  }

  if (toInsert.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error } = await supabaseAdmin.from("customers").insert(batch.map(b => b.data));
      if (error) {
        for (const item of batch) {
          failed.push({ row: item.csvRow, reason: error.message });
        }
      } else {
        created += batch.length;
      }
    }
  }

  res.json({ created, skipped, failed, total: rows.length });
});

router.post("/customers/check-duplicates", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = z.object({ customers: z.array(z.record(z.string(), z.string().optional())) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const tenantId = req.tenantId!;
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("email, phone, last_name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const emailSet = new Set<string>();
  const phoneLastNameSet = new Set<string>();
  for (const c of existing || []) {
    if (c.email) emailSet.add(c.email.toLowerCase().trim());
    if (c.phone && c.last_name) phoneLastNameSet.add(`${c.phone.trim()}|${c.last_name.toLowerCase().trim()}`);
  }

  const duplicates: number[] = [];
  for (let i = 0; i < body.data.customers.length; i++) {
    const row = body.data.customers[i];
    const email = row.email?.trim().toLowerCase();
    const phone = row.phone?.trim();
    const lastName = row.last_name?.trim().toLowerCase();

    let isDup = false;
    if (email && emailSet.has(email)) isDup = true;
    if (!isDup && phone && lastName && phoneLastNameSet.has(`${phone}|${lastName}`)) isDup = true;

    if (isDup) duplicates.push(i);
  }

  res.json({ duplicates });
});

router.post("/customers/portal-invite/bulk", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = z.object({ dry_run: z.boolean().optional() }).safeParse(req.body || {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const dryRun = !!body.data.dry_run;

  const { data: customers, error: customerErr } = await supabaseAdmin
    .from("customers")
    .select("id, first_name, last_name, email")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true);

  if (customerErr) {
    res.status(500).json({ error: customerErr.message });
    return;
  }

  const allCustomers = (customers || []) as Array<{ id: string; first_name: string; last_name: string; email: string | null }>;
  const eligible = allCustomers.filter((c) => !!c.email?.trim());
  const skippedNoEmail = allCustomers.length - eligible.length;

  if (eligible.length === 0) {
    res.json({
      success: true,
      dry_run: dryRun,
      total_customers: allCustomers.length,
      eligible_with_email: 0,
      invited: 0,
      reenabled: 0,
      already_active: 0,
      email_failed: 0,
      failed: 0,
      skipped_no_email: skippedNoEmail,
    });
    return;
  }

  const eligibleIds = eligible.map((c) => c.id);
  const { data: existingPortalUsers, error: portalErr } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, customer_id, auth_user_id, is_active, invite_token, invite_expires_at")
    .eq("tenant_id", req.tenantId!)
    .in("customer_id", eligibleIds);

  if (portalErr) {
    res.status(500).json({ error: portalErr.message });
    return;
  }

  const portalByCustomer = new Map<string, { id: string; auth_user_id: string | null; is_active: boolean; invite_token: string | null; invite_expires_at: string | null }>();
  for (const row of (existingPortalUsers || []) as Array<{ id: string; customer_id: string; auth_user_id: string | null; is_active: boolean; invite_token: string | null; invite_expires_at: string | null }>) {
    portalByCustomer.set(row.customer_id, {
      id: row.id,
      auth_user_id: row.auth_user_id,
      is_active: row.is_active,
      invite_token: row.invite_token,
      invite_expires_at: row.invite_expires_at,
    });
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_name")
    .eq("id", req.tenantId!)
    .single();

  const { data: cs } = await supabaseAdmin
    .from("company_settings")
    .select("name, trading_name, phone, email, notification_emails, website, logo_url, email_from_name, email_reply_to, email_templates")
    .eq("tenant_id", req.tenantId!)
    .eq("singleton_id", "default")
    .maybeSingle();

  const companyName = (cs as { name?: string; trading_name?: string } | null)?.name
    || (cs as { name?: string; trading_name?: string } | null)?.trading_name
    || (tenant as { company_name?: string } | null)?.company_name
    || "Your Service Provider";

  const baseUrl = process.env.APP_URL
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://tradeworkdesk.co.uk");

  let invited = 0;
  let reenabled = 0;
  let alreadyActive = 0;
  let emailFailed = 0;
  let failed = 0;
  const pendingInviteEmails: Array<{ to: string; customerName: string; registerUrl: string }> = [];
  const nowMs = Date.now();

  for (const customer of eligible) {
    const email = customer.email?.toLowerCase().trim();
    if (!email) continue;

    const existing = portalByCustomer.get(customer.id);

    if (existing?.auth_user_id && existing.is_active) {
      alreadyActive += 1;
      continue;
    }

    if (existing?.auth_user_id && !existing.is_active) {
      if (!dryRun) {
        const { error: reenableErr } = await supabaseAdmin
          .from("customer_portal_users")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", existing.id);

        if (reenableErr) {
          failed += 1;
          continue;
        }

        portalUserCache.delete(existing.auth_user_id);
      }

      reenabled += 1;
      continue;
    }

    const hasReusableInvite = !!(
      existing?.invite_token
      && existing?.invite_expires_at
      && new Date(existing.invite_expires_at).getTime() > nowMs
      && existing.is_active
      && !existing.auth_user_id
    );

    const token = hasReusableInvite ? String(existing!.invite_token) : generateInviteToken();
    const expiresAt = hasReusableInvite
      ? String(existing!.invite_expires_at)
      : new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (!dryRun) {
      if (existing) {
        const { error: updateErr } = await supabaseAdmin
          .from("customer_portal_users")
          .update({
            invite_token: token,
            invite_email: email,
            invite_expires_at: expiresAt,
            is_active: true,
            auth_user_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateErr) {
          failed += 1;
          continue;
        }
      } else {
        const { error: insertErr } = await supabaseAdmin
          .from("customer_portal_users")
          .insert({
            customer_id: customer.id,
            tenant_id: req.tenantId!,
            invite_token: token,
            invite_email: email,
            invite_expires_at: expiresAt,
          });

        if (insertErr) {
          failed += 1;
          continue;
        }
      }

      const registerUrl = `${baseUrl}/portal/register?token=${token}`;
      const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Customer";
      pendingInviteEmails.push({
        to: customer.email!,
        customerName,
        registerUrl,
      });
    }

    invited += 1;
  }

  if (!dryRun && pendingInviteEmails.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < pendingInviteEmails.length; i += batchSize) {
      const batch = pendingInviteEmails.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((entry) =>
          sendPortalInviteEmail(entry.to, entry.customerName, companyName, entry.registerUrl, {
            name: (cs as { name?: string } | null)?.name,
            trading_name: (cs as { trading_name?: string } | null)?.trading_name,
            email: (cs as { email?: string } | null)?.email,
            notification_emails: (cs as { notification_emails?: string[] } | null)?.notification_emails,
            logo_url: (cs as { logo_url?: string } | null)?.logo_url,
            phone: (cs as { phone?: string } | null)?.phone,
            website: (cs as { website?: string } | null)?.website,
            email_from_name: (cs as { email_from_name?: string } | null)?.email_from_name,
            email_reply_to: (cs as { email_reply_to?: string } | null)?.email_reply_to,
            email_templates: (cs as { email_templates?: EmailCompanyDetails["email_templates"] } | null)?.email_templates,
          })
        )
      );

      for (const result of results) {
        if (result.status === "rejected") {
          emailFailed += 1;
          console.error("[portal] Bulk invite email failed:", result.reason);
        }
      }
    }
  }

  res.json({
    success: true,
    dry_run: dryRun,
    total_customers: allCustomers.length,
    eligible_with_email: eligible.length,
    invited,
    reenabled,
    already_active: alreadyActive,
    email_failed: emailFailed,
    failed,
    skipped_no_email: skippedNoEmail,
  });
});

router.post("/customers/portal-invite/extend-bulk", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = z.object({ dry_run: z.boolean().optional() }).safeParse(req.body || {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const dryRun = !!body.data.dry_run;

  const { data: pendingPortalUsers, error } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, invite_token")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .is("auth_user_id", null);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (pendingPortalUsers || []) as Array<{ id: string; invite_token: string | null }>;
  const now = Date.now();
  const inviteExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

  let extended = 0;
  let failed = 0;

  for (const row of rows) {
    if (dryRun) {
      extended += 1;
      continue;
    }

    const token = row.invite_token || generateInviteToken();
    const { error: updateErr } = await supabaseAdmin
      .from("customer_portal_users")
      .update({
        invite_token: token,
        invite_expires_at: inviteExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateErr) {
      failed += 1;
      continue;
    }

    extended += 1;
  }

  res.json({
    success: true,
    dry_run: dryRun,
    pending_total: rows.length,
    extended,
    failed,
    invite_expires_at: inviteExpiresAt,
  });
});

router.post("/customers/:id/portal-invite", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin.from("customers").select("id, first_name, last_name, email, tenant_id").eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: customer, error: custErr } = await q.single();

  if (custErr || !customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  if (!customer.email) {
    res.status(400).json({ error: "Customer does not have an email address. Add an email first." });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, auth_user_id, is_active, invite_token, invite_expires_at")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (existing?.auth_user_id && existing.is_active) {
    res.status(400).json({ error: "Customer already has portal access" });
    return;
  }

  const nowMs = Date.now();
  const hasReusableInvite = !!(
    existing?.invite_token
    && existing?.invite_expires_at
    && new Date(existing.invite_expires_at).getTime() > nowMs
    && existing.is_active
    && !existing.auth_user_id
  );

  const token = hasReusableInvite ? String(existing!.invite_token) : generateInviteToken();
  const expiresAt = hasReusableInvite
    ? String(existing!.invite_expires_at)
    : new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    await supabaseAdmin
      .from("customer_portal_users")
      .update({
        invite_token: token,
        invite_email: customer.email.toLowerCase().trim(),
        invite_expires_at: expiresAt,
        is_active: true,
        auth_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    const { error: insertErr } = await supabaseAdmin
      .from("customer_portal_users")
      .insert({
        customer_id: id,
        tenant_id: req.tenantId!,
        invite_token: token,
        invite_email: customer.email.toLowerCase().trim(),
        invite_expires_at: expiresAt,
      });

    if (insertErr) {
      res.status(500).json({ error: "Failed to create portal invite" });
      return;
    }
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_name")
    .eq("id", req.tenantId!)
    .single();

  const { data: cs } = await supabaseAdmin
    .from("company_settings")
    .select("name, trading_name, phone, email, notification_emails, website, logo_url, email_from_name, email_reply_to, email_templates")
    .eq("tenant_id", req.tenantId!)
    .eq("singleton_id", "default")
    .maybeSingle();

  const companyName = (cs as any)?.name || (cs as any)?.trading_name || tenant?.company_name || "Your Service Provider";

  const baseUrl = process.env.APP_URL
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://tradeworkdesk.co.uk");
  const registerUrl = `${baseUrl}/portal/register?token=${token}`;

  const customerName = `${customer.first_name} ${customer.last_name}`;

  try {
    await sendPortalInviteEmail(customer.email, customerName, companyName, registerUrl, {
      name: (cs as any)?.name,
      trading_name: (cs as any)?.trading_name,
      email: (cs as any)?.email,
      notification_emails: (cs as any)?.notification_emails,
      logo_url: (cs as any)?.logo_url,
      phone: (cs as any)?.phone,
      website: (cs as any)?.website,
      email_from_name: (cs as any)?.email_from_name,
      email_reply_to: (cs as any)?.email_reply_to,
      email_templates: (cs as any)?.email_templates,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send invite email";
    console.error("[portal] Failed to send invite email:", e);
    res.status(502).json({ error: msg });
    return;
  }

  res.json({ success: true, sent_to: customer.email });
});

router.get("/customers/:id/portal-status", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const visibleInvoiceStatuses = ["sent", "paid", "overdue", "accepted", "declined", "converted"] as const;

  const { data: pendingRequest } = await supabaseAdmin
    .from("customer_portal_access_requests")
    .select("id, requested_email, requested_postcode, requested_at")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: portalUser } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, auth_user_id, is_active, invite_token, invite_expires_at, created_at")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("id, status, invoice_number, issue_date")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .order("issue_date", { ascending: false })
    .limit(200);

  const rows = (invoices || []) as Array<{ id: string; status: string | null; invoice_number: string | null; issue_date: string | null }>;
  const visibleInvoices = rows.filter((row) => !!row.status && visibleInvoiceStatuses.includes(row.status as (typeof visibleInvoiceStatuses)[number]));
  const hiddenByStatus = new Map<string, number>();
  for (const row of rows) {
    const status = row.status || "unknown";
    if (!visibleInvoiceStatuses.includes(status as (typeof visibleInvoiceStatuses)[number])) {
      hiddenByStatus.set(status, (hiddenByStatus.get(status) || 0) + 1);
    }
  }

  const portalDiagnostics = {
    visible_invoice_statuses: [...visibleInvoiceStatuses],
    invoice_totals: {
      total: rows.length,
      visible_in_portal: visibleInvoices.length,
      hidden_from_portal: rows.length - visibleInvoices.length,
    },
    hidden_status_breakdown: Array.from(hiddenByStatus.entries()).map(([status, count]) => ({ status, count })),
    latest_invoices: rows.slice(0, 5).map((row) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      status: row.status,
      issue_date: row.issue_date,
      visible_in_portal: !!row.status && visibleInvoiceStatuses.includes(row.status as (typeof visibleInvoiceStatuses)[number]),
    })),
  };

  if (!portalUser) {
    res.json({
      has_portal: false,
      is_active: false,
      is_registered: false,
      pending_access_request: pendingRequest || null,
      diagnostics: portalDiagnostics,
    });
    return;
  }

  const inviteExpiresAt = portalUser.invite_expires_at ? new Date(portalUser.invite_expires_at).getTime() : null;
  const inviteExpired = inviteExpiresAt !== null && inviteExpiresAt < Date.now();

  res.json({
    has_portal: true,
    portal_user_id: portalUser.id,
    is_active: portalUser.is_active,
    is_registered: !!portalUser.auth_user_id,
    has_auth_user_id: !!portalUser.auth_user_id,
    has_invite_token: !!portalUser.invite_token,
    invite_expires_at: portalUser.invite_expires_at,
    invite_expired: inviteExpired,
    created_at: portalUser.created_at,
    pending_access_request: pendingRequest || null,
    diagnostics: portalDiagnostics,
  });
});

router.post("/customers/:id/portal-access-requests/:requestId/approve", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id, requestId } = req.params;

  const { data: requestRow, error: requestErr } = await supabaseAdmin
    .from("customer_portal_access_requests")
    .select("id, customer_id, tenant_id, status")
    .eq("id", requestId)
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .single();

  if (requestErr || !requestRow) {
    res.status(404).json({ error: "Portal access request not found" });
    return;
  }

  if (requestRow.status !== "pending") {
    res.status(400).json({ error: "Portal access request has already been processed" });
    return;
  }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, first_name, last_name, email, tenant_id")
    .eq("id", id)
    .eq("tenant_id", req.tenantId!)
    .single();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  if (!customer.email) {
    res.status(400).json({ error: "Customer does not have an email address. Add an email first." });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, auth_user_id, is_active, invite_token, invite_expires_at")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  const nowMs = Date.now();
  const hasReusableInvite = !!(
    existing?.invite_token
    && existing?.invite_expires_at
    && new Date(existing.invite_expires_at).getTime() > nowMs
    && existing.is_active
    && !existing.auth_user_id
  );

  const token = hasReusableInvite ? String(existing!.invite_token) : generateInviteToken();
  const expiresAt = hasReusableInvite
    ? String(existing!.invite_expires_at)
    : new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    await supabaseAdmin
      .from("customer_portal_users")
      .update({
        invite_token: token,
        invite_email: customer.email.toLowerCase().trim(),
        invite_expires_at: expiresAt,
        is_active: true,
        auth_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    const { error: insertErr } = await supabaseAdmin
      .from("customer_portal_users")
      .insert({
        customer_id: id,
        tenant_id: req.tenantId!,
        invite_token: token,
        invite_email: customer.email.toLowerCase().trim(),
        invite_expires_at: expiresAt,
      });

    if (insertErr) {
      res.status(500).json({ error: "Failed to create portal invite" });
      return;
    }
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_name")
    .eq("id", req.tenantId!)
    .single();

  const { data: cs } = await supabaseAdmin
    .from("company_settings")
    .select("name, trading_name, phone, email, notification_emails, website, logo_url, email_from_name, email_reply_to, email_templates")
    .eq("tenant_id", req.tenantId!)
    .eq("singleton_id", "default")
    .maybeSingle();

  const companyName = (cs as any)?.name || (cs as any)?.trading_name || tenant?.company_name || "Your Service Provider";

  const baseUrl = process.env.APP_URL
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://tradeworkdesk.co.uk");
  const registerUrl = `${baseUrl}/portal/register?token=${token}`;

  const customerName = `${customer.first_name} ${customer.last_name}`;

  try {
    await sendPortalInviteEmail(customer.email, customerName, companyName, registerUrl, {
      name: (cs as any)?.name,
      trading_name: (cs as any)?.trading_name,
      email: (cs as any)?.email,
      notification_emails: (cs as any)?.notification_emails,
      logo_url: (cs as any)?.logo_url,
      phone: (cs as any)?.phone,
      website: (cs as any)?.website,
      email_from_name: (cs as any)?.email_from_name,
      email_reply_to: (cs as any)?.email_reply_to,
      email_templates: (cs as any)?.email_templates,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send invite email";
    console.error("[portal] Failed to send invite email on request approval:", e);
    res.status(502).json({ error: msg });
    return;
  }

  await supabaseAdmin
    .from("customer_portal_access_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.userId,
      review_notes: "Approved and portal invite sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("tenant_id", req.tenantId!);

  res.json({ success: true, sent_to: customer.email });
});

router.post("/customers/:id/portal-access-requests/:requestId/reject", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id, requestId } = req.params;
  const reviewNotes = typeof req.body?.review_notes === "string" ? req.body.review_notes.trim() : "";

  const { data: requestRow, error: requestErr } = await supabaseAdmin
    .from("customer_portal_access_requests")
    .select("id, customer_id, tenant_id, status")
    .eq("id", requestId)
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .single();

  if (requestErr || !requestRow) {
    res.status(404).json({ error: "Portal access request not found" });
    return;
  }

  if (requestRow.status !== "pending") {
    res.status(400).json({ error: "Portal access request has already been processed" });
    return;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("customer_portal_access_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.userId,
      review_notes: reviewNotes || "Rejected by staff",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("tenant_id", req.tenantId!);

  if (updateErr) {
    res.status(500).json({ error: updateErr.message });
    return;
  }

  res.json({ success: true });
});

router.patch("/customers/:id/portal-toggle", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== "boolean") {
    res.status(400).json({ error: "is_active must be a boolean" });
    return;
  }

  const { data: portalUser, error } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (!portalUser) {
    res.status(404).json({ error: "No portal record found for this customer" });
    return;
  }

  const { data: fullPortalUser } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, auth_user_id")
    .eq("id", portalUser.id)
    .single();

  await supabaseAdmin
    .from("customer_portal_users")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", portalUser.id);

  if (fullPortalUser?.auth_user_id) {
    portalUserCache.delete(fullPortalUser.auth_user_id);
  }

  res.json({ success: true, is_active });
});

router.post("/customers/:id/portal-invite/extend", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  const { data: portalUser } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, auth_user_id, is_active, invite_token")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (!portalUser) {
    res.status(404).json({ error: "No portal record found for this customer" });
    return;
  }

  if (portalUser.auth_user_id) {
    res.status(400).json({ error: "Customer already has a registered portal account" });
    return;
  }

  if (!portalUser.is_active) {
    res.status(400).json({ error: "Portal access is disabled. Enable access before extending invite." });
    return;
  }

  const token = portalUser.invite_token || generateInviteToken();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabaseAdmin
    .from("customer_portal_users")
    .update({
      invite_token: token,
      invite_expires_at: inviteExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", portalUser.id);

  if (updateErr) {
    res.status(500).json({ error: updateErr.message });
    return;
  }

  res.json({ success: true, invite_expires_at: inviteExpiresAt });
});

// ─── GET /customers/:id/email-log ─────────────────────────────────────────────
// All email logs for this customer, newest first.
router.get("/customers/:id/email-log", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  // Verify customer belongs to this tenant
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, email")
    .eq("id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  const customerEmail = String((customer as { email?: string | null })?.email || "").trim();

  // Step 1: collect all job IDs for this customer
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id, job_ref")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!);

  // Step 1b: collect all invoice/quote IDs for this customer so quote/invoice emails
  // are included even when they are not linked to a job.
  const { data: docs, error: docsError } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, type, status, sent_at")
    .eq("customer_id", id)
    .eq("tenant_id", req.tenantId!);

  if (docsError) { res.status(500).json({ error: docsError.message }); return; }

  const jobIds = (jobs || []).map((j: { id: string }) => j.id);
  const docRows = (docs || []) as Array<{ id: string; invoice_number: string | null; type: string | null; status: string | null; sent_at: string | null }>;
  const docIdSet = new Set(docRows.map((d) => String(d.id)));
  const jobRefMap: Record<string, string | null> = {};
  for (const j of jobs as { id: string; job_ref: string | null }[]) {
    jobRefMap[j.id] = j.job_ref;
  }

  // Step 2: email logs for those jobs
  const { data: logs, error } = jobIds.length > 0
    ? await supabaseAdmin
        .from("job_email_logs")
        .select("id, job_id, sent_to, subject, forms_included, body_text, created_at, profiles!sent_by(full_name)")
        .in("job_id", jobIds)
        .eq("tenant_id", req.tenantId!)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [], error: null };

  if (error) { res.status(500).json({ error: error.message }); return; }

  const mappedJobEmails = (logs || []).map((log: Record<string, unknown>) => ({
    id: log.id,
    job_id: log.job_id,
    job_ref: jobRefMap[log.job_id as string] ?? null,
    sent_to: log.sent_to,
    subject: log.subject,
    forms_included: log.forms_included,
    body_text: log.body_text,
    sent_by_name: (log.profiles as Record<string, unknown> | null)?.full_name ?? null,
    created_at: log.created_at,
  }));

  // Step 2b: invoice/quote emails can exist with no job_id; include them by matching
  // the logged form_id against invoices/quotes owned by this customer.
  const { data: docLogs, error: docLogsError } = await supabaseAdmin
    .from("job_email_logs")
    .select("id, job_id, sent_to, subject, forms_included, body_text, created_at, profiles!sent_by(full_name)")
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: false })
    .limit(500);

  if (docLogsError) { res.status(500).json({ error: docLogsError.message }); return; }

  const mappedDocEmails = (docLogs || [])
    .filter((log: Record<string, unknown>) => {
      const formsIncluded = Array.isArray(log.forms_included) ? log.forms_included as Array<Record<string, unknown>> : [];
      return formsIncluded.some((f) => {
        const formType = String(f.form_type || "").toLowerCase();
        const formId = String(f.form_id || "");
        return (formType === "invoice" || formType === "quote") && docIdSet.has(formId);
      });
    })
    .map((log: Record<string, unknown>) => ({
      id: log.id,
      job_id: log.job_id,
      job_ref: log.job_id ? (jobRefMap[String(log.job_id)] ?? null) : null,
      sent_to: log.sent_to,
      subject: log.subject,
      forms_included: log.forms_included,
      body_text: log.body_text,
      sent_by_name: (log.profiles as Record<string, unknown> | null)?.full_name ?? null,
      created_at: log.created_at,
    }));

  // Step 2c: fallback entries for sent docs that never got a log row
  // (e.g. quote/invoice not linked to a job where job_email_logs insert failed).
  const docIdsWithLogs = new Set<string>();
  for (const log of mappedDocEmails) {
    const formsIncluded = Array.isArray(log.forms_included) ? log.forms_included as Array<Record<string, unknown>> : [];
    for (const f of formsIncluded) {
      const formType = String(f.form_type || "").toLowerCase();
      const formId = String(f.form_id || "");
      if ((formType === "invoice" || formType === "quote") && formId) {
        docIdsWithLogs.add(formId);
      }
    }
  }

  const mappedDocFallbackEmails = docRows
    .filter((doc) => !!doc.sent_at && (doc.status === "sent" || doc.status === "paid" || doc.status === "accepted" || doc.status === "converted") && !docIdsWithLogs.has(String(doc.id)))
    .map((doc) => {
      const docType = String(doc.type || "invoice").toLowerCase() === "quote" ? "Quote" : "Invoice";
      const docNumber = String(doc.invoice_number || doc.id);
      return {
        id: `doc-fallback-${doc.id}`,
        job_id: null,
        job_ref: null,
        sent_to: customerEmail || "",
        subject: `${docType} ${docNumber}`,
        forms_included: [{ form_type: String(doc.type || "invoice"), form_label: `${docType} ${docNumber}`, form_id: String(doc.id) }],
        body_text: null,
        sent_by_name: null,
        created_at: String(doc.sent_at),
      };
    });

  const emailById = new Map<string, {
    id: unknown;
    job_id: unknown;
    job_ref: unknown;
    sent_to: unknown;
    subject: unknown;
    forms_included: unknown;
    body_text: unknown;
    sent_by_name: unknown;
    created_at: unknown;
  }>();
  for (const entry of [...mappedJobEmails, ...mappedDocEmails, ...mappedDocFallbackEmails]) {
    emailById.set(String(entry.id), entry);
  }
  const mappedCustomerEmails = Array.from(emailById.values());

  const reviewRequestsById = new Map<string, Record<string, unknown>>();

  if (jobIds.length > 0) {
    const { data: jobLinkedRequests, error: jobLinkedRequestsError } = await supabaseAdmin
      .from("review_requests")
      .select("id, job_id, customer_email, sent_at, created_at, status, channel")
      .eq("tenant_id", req.tenantId!)
      .eq("channel", "email")
      .in("status", ["sent", "opened", "clicked"])
      .in("job_id", jobIds)
      .order("sent_at", { ascending: false })
      .limit(200);

    if (jobLinkedRequestsError) { res.status(500).json({ error: jobLinkedRequestsError.message }); return; }
    for (const request of jobLinkedRequests || []) {
      reviewRequestsById.set(String((request as Record<string, unknown>).id), request as Record<string, unknown>);
    }
  }

  if (customerEmail) {
    const { data: emailLinkedRequests, error: emailLinkedRequestsError } = await supabaseAdmin
      .from("review_requests")
      .select("id, job_id, customer_email, sent_at, created_at, status, channel")
      .eq("tenant_id", req.tenantId!)
      .eq("channel", "email")
      .in("status", ["sent", "opened", "clicked"])
      .eq("customer_email", customerEmail)
      .order("sent_at", { ascending: false })
      .limit(200);

    if (emailLinkedRequestsError) { res.status(500).json({ error: emailLinkedRequestsError.message }); return; }
    for (const request of emailLinkedRequests || []) {
      reviewRequestsById.set(String((request as Record<string, unknown>).id), request as Record<string, unknown>);
    }
  }

  const mappedReviewEmails = Array.from(reviewRequestsById.values()).map((request) => ({
    id: `review-${request.id}`,
    job_id: request.job_id,
    job_ref: request.job_id ? (jobRefMap[String(request.job_id)] ?? null) : null,
    sent_to: request.customer_email,
    subject: "Review request email",
    forms_included: [],
    body_text: null,
    sent_by_name: null,
    created_at: request.sent_at || request.created_at,
  }));

  let mappedEnquiryAcknowledgements: Array<{
    id: string;
    job_id: null;
    job_ref: null;
    sent_to: string;
    subject: string;
    forms_included: Array<{ form_type: string; form_label: string; form_id: string }>;
    body_text: string | null;
    sent_by_name: null;
    created_at: string;
  }> = [];

  if (customerEmail) {
    const { data: enquiryEmailAuditRows, error: enquiryEmailAuditError } = await supabaseAdmin
      .from("tenant_email_audit_log")
      .select("id, to_email, subject, metadata, created_at, status")
      .eq("tenant_id", req.tenantId!)
      .eq("email_type", "enquiry_acknowledgement")
      .eq("to_email", customerEmail)
      .in("status", ["accepted", "delivered", "sent"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (enquiryEmailAuditError) { res.status(500).json({ error: enquiryEmailAuditError.message }); return; }

    mappedEnquiryAcknowledgements = (enquiryEmailAuditRows || []).map((row: Record<string, unknown>) => {
      const metadata = (row.metadata as Record<string, unknown> | null) || null;
      const enquiryId = metadata?.enquiryId ? String(metadata.enquiryId) : String(row.id);
      return {
        id: `enquiry-ack-${String(row.id)}`,
        job_id: null,
        job_ref: null,
        sent_to: String(row.to_email || customerEmail),
        subject: String(row.subject || "Enquiry acknowledgement"),
        forms_included: [{ form_type: "enquiry_acknowledgement", form_label: "Enquiry Acknowledgement", form_id: enquiryId }],
        body_text: null,
        sent_by_name: null,
        created_at: String(row.created_at),
      };
    });
  }

  const combined = [...mappedCustomerEmails, ...mappedReviewEmails, ...mappedEnquiryAcknowledgements]
    .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
    .slice(0, 200);

  res.json(combined);
});

export default router;
