import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import type { Request, Response, NextFunction } from "express";
import { generateFormPdf, type PdfCompanySettings } from "../lib/pdf-forms";
import { generateInvoicePdf } from "../lib/invoice-pdf";
import { sendSimpleNotification } from "../lib/email";
import crypto from "crypto";

const router: IRouter = Router();

interface CustomerPortalRequest extends Request {
  portalUserId?: string;
  customerId?: string;
  tenantId?: string;
  customerAuthUserId?: string;
  customerEmail?: string;
}

const portalTokenCache = new Map<string, { user: { id: string; email?: string }; expiresAt: number }>();
const PORTAL_TOKEN_CACHE_TTL_MS = 60_000;

export const portalUserCache = new Map<string, { portalUserId: string; customerId: string; tenantId: string; expiresAt: number }>();
const PORTAL_USER_CACHE_TTL_MS = 120_000;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function requireCustomerAuth(
  req: CustomerPortalRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.substring(7);

  const now = Date.now();
  const cachedToken = portalTokenCache.get(token);
  let user: { id: string; email?: string } | null = null;

  if (cachedToken && cachedToken.expiresAt > now) {
    user = cachedToken.user;
  } else {
    const { data: { user: fetchedUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !fetchedUser) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    user = { id: fetchedUser.id, email: fetchedUser.email };
    portalTokenCache.set(token, { user, expiresAt: now + PORTAL_TOKEN_CACHE_TTL_MS });
    if (portalTokenCache.size > 500) {
      for (const [key, val] of portalTokenCache) {
        if (val.expiresAt <= now) portalTokenCache.delete(key);
      }
    }
  }

  const cachedPortal = portalUserCache.get(user.id);
  if (cachedPortal && cachedPortal.expiresAt > now) {
    req.portalUserId = cachedPortal.portalUserId;
    req.customerId = cachedPortal.customerId;
    req.tenantId = cachedPortal.tenantId;
    req.customerAuthUserId = user.id;
    req.customerEmail = user.email;
    next();
    return;
  }

  const { data: portalUser, error: portalErr } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, customer_id, tenant_id, is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (portalErr || !portalUser) {
    res.status(403).json({ error: "No portal access. Contact your service provider." });
    return;
  }

  portalUserCache.set(user.id, {
    portalUserId: portalUser.id,
    customerId: portalUser.customer_id,
    tenantId: portalUser.tenant_id,
    expiresAt: now + PORTAL_USER_CACHE_TTL_MS,
  });

  req.portalUserId = portalUser.id;
  req.customerId = portalUser.customer_id;
  req.tenantId = portalUser.tenant_id;
  req.customerAuthUserId = user.id;
  req.customerEmail = user.email;
  next();
}

router.post("/portal/register", async (req: CustomerPortalRequest, res): Promise<void> => {
  const { token, email, password } = req.body;
  if (!token || !email || !password) {
    res.status(400).json({ error: "Token, email and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const { data: invite, error: invErr } = await supabaseAdmin
    .from("customer_portal_users")
    .select("*")
    .eq("invite_token", token)
    .is("auth_user_id", null)
    .single();

  if (invErr || !invite) {
    res.status(400).json({ error: "Invalid or expired invite token" });
    return;
  }

  if (new Date(invite.invite_expires_at) < new Date()) {
    res.status(400).json({ error: "Invite token has expired. Please request a new invitation." });
    return;
  }

  if (!invite.is_active) {
    res.status(400).json({ error: "Portal access has been disabled. Contact your service provider." });
    return;
  }

  if (invite.invite_email && email.toLowerCase().trim() !== invite.invite_email.toLowerCase().trim()) {
    res.status(400).json({ error: "Email address must match the one the invitation was sent to." });
    return;
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { portal_user: true, customer_id: invite.customer_id },
  });

  if (authErr) {
    const isDuplicate = authErr.message?.includes("already been registered") || authErr.message?.includes("already exists");
    if (isDuplicate) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
      if (!existingUser) {
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = allUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
        if (!found) {
          res.status(400).json({ error: "An account with this email already exists but could not be resolved. Please contact support." });
          return;
        }
        const { error: linkErr } = await supabaseAdmin
          .from("customer_portal_users")
          .update({ auth_user_id: found.id, updated_at: new Date().toISOString() })
          .eq("id", invite.id);
        if (linkErr) {
          res.status(500).json({ error: "Failed to link existing account. Contact your service provider." });
          return;
        }
        res.json({ success: true, message: "Your existing account has been linked. You can now sign in with your existing password." });
        return;
      }
      const { error: linkErr } = await supabaseAdmin
        .from("customer_portal_users")
        .update({ auth_user_id: existingUser.id, updated_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (linkErr) {
        res.status(500).json({ error: "Failed to link existing account. Contact your service provider." });
        return;
      }
      res.json({ success: true, message: "Your existing account has been linked. You can now sign in with your existing password." });
      return;
    }
    res.status(400).json({ error: authErr.message || "Failed to create account" });
    return;
  }

  const { error: linkErr } = await supabaseAdmin
    .from("customer_portal_users")
    .update({ auth_user_id: authData.user.id, updated_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (linkErr) {
    res.status(500).json({ error: "Account created but failed to link. Contact your service provider." });
    return;
  }

  res.json({ success: true, message: "Account created successfully. You can now log in." });
});

router.get("/portal/invite-info", async (req: CustomerPortalRequest, res): Promise<void> => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const { data: invite, error } = await supabaseAdmin
    .from("customer_portal_users")
    .select("id, customer_id, tenant_id, invite_expires_at, is_active, auth_user_id")
    .eq("invite_token", token)
    .single();

  if (error || !invite) {
    res.status(404).json({ error: "Invalid invite token" });
    return;
  }

  if (invite.auth_user_id) {
    res.status(400).json({ error: "This invitation has already been used", already_registered: true });
    return;
  }

  if (new Date(invite.invite_expires_at) < new Date()) {
    res.status(400).json({ error: "This invite has expired. Please request a new one." });
    return;
  }

  if (!invite.is_active) {
    res.status(400).json({ error: "Portal access has been disabled" });
    return;
  }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name, email")
    .eq("id", invite.customer_id)
    .single();

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_name")
    .eq("id", invite.tenant_id)
    .single();

  res.json({
    valid: true,
    customer_name: customer ? `${customer.first_name} ${customer.last_name}` : null,
    customer_email: customer?.email || null,
    company_name: tenant?.company_name || null,
  });
});

router.get("/portal/profile", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("id, title, first_name, last_name, email, phone, mobile")
    .eq("id", req.customerId!)
    .single();

  if (error || !customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("company_name")
    .eq("id", req.tenantId!)
    .single();

  res.json({
    customer,
    company_name: tenant?.company_name || null,
    portal_user_id: req.portalUserId,
  });
});

router.get("/portal/properties", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const { data: properties, error } = await supabaseAdmin
    .from("properties")
    .select("id, address_line1, address_line2, city, county, postcode, property_type, occupancy_type")
    .eq("customer_id", req.customerId!)
    .eq("is_active", true)
    .order("address_line1");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(properties || []);
});

router.get("/portal/jobs", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("id, job_ref, job_type, status, priority, description, scheduled_date, scheduled_time, estimated_duration, created_at, property_id, properties(address_line1, postcode)")
    .eq("customer_id", req.customerId!)
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .order("scheduled_date", { ascending: false })
    .limit(100);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const mapped = (jobs || []).map((j: any) => ({
    id: j.id,
    job_ref: j.job_ref,
    job_type: j.job_type,
    status: j.status,
    priority: j.priority,
    description: j.description,
    scheduled_date: j.scheduled_date,
    scheduled_time: j.scheduled_time,
    estimated_duration: j.estimated_duration,
    created_at: j.created_at,
    property_address: j.properties?.address_line1 || null,
    property_postcode: j.properties?.postcode || null,
  }));

  res.json(mapped);
});

router.get("/portal/jobs/:jobId", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const { jobId } = req.params;

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("id, job_ref, job_type, status, priority, description, notes, scheduled_date, scheduled_time, estimated_duration, property_id, appliance_id, created_at, properties(address_line1, address_line2, city, postcode), appliances(manufacturer, model)")
    .eq("id", jobId)
    .eq("customer_id", req.customerId!)
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .single();

  if (error || !job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const { data: serviceRecords } = await supabaseAdmin
    .from("service_records")
    .select("id, arrival_time, departure_time, work_completed, appliance_safe, next_service_due, follow_up_required, additional_notes, created_at")
    .eq("job_id", jobId);

  const { data: completionReports } = await supabaseAdmin
    .from("job_completion_reports")
    .select("id, work_completed, next_service_date, follow_up_required, additional_notes, created_at")
    .eq("job_id", jobId);

  res.json({
    ...job,
    property_address: (job as any).properties?.address_line1 || null,
    appliance_name: (job as any).appliances ? `${(job as any).appliances.manufacturer || ""} ${(job as any).appliances.model || ""}`.trim() : null,
    service_records: serviceRecords || [],
    completion_reports: completionReports || [],
    properties: undefined,
    appliances: undefined,
  });
});

router.get("/portal/jobs/:jobId/certificate", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const { jobId } = req.params;
  const formType = (req.query.form as string) || "service_record";

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, job_ref, scheduled_date, customer_id, property_id, appliance_id, assigned_technician_id, tenant_id")
    .eq("id", jobId)
    .eq("customer_id", req.customerId!)
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .single();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [customerRes, propertyRes, applianceRes, techRes, settingsRes] = await Promise.all([
    supabaseAdmin.from("customers").select("first_name, last_name").eq("id", job.customer_id).single(),
    supabaseAdmin.from("properties").select("address_line1, address_line2, city, postcode").eq("id", job.property_id).single(),
    job.appliance_id ? supabaseAdmin.from("appliances").select("manufacturer, model").eq("id", job.appliance_id).single() : { data: null },
    job.assigned_technician_id ? supabaseAdmin.from("profiles").select("full_name").eq("id", job.assigned_technician_id).single() : { data: null },
    supabaseAdmin.from("company_settings").select("*").eq("tenant_id", job.tenant_id).eq("singleton_id", "default").maybeSingle(),
  ]);

  const customer = customerRes.data;
  const property = propertyRes.data;
  const appliance = applianceRes.data;
  const tech = techRes.data;
  const cs = settingsRes.data as Record<string, unknown> | null;

  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "N/A";
  const propertyParts = property ? [property.address_line1, property.address_line2, property.city, property.postcode].filter(Boolean) : [];
  const propertyAddress = propertyParts.join(", ") || "N/A";
  const applianceName = appliance ? `${appliance.manufacturer || ""} ${appliance.model || ""}`.trim() || "N/A" : "N/A";
  const technicianName = (tech as any)?.full_name || "N/A";

  const company: PdfCompanySettings | undefined = cs ? {
    name: cs.name as string | null,
    trading_name: cs.trading_name as string | null,
    address_line1: cs.address_line1 as string | null,
    address_line2: cs.address_line2 as string | null,
    city: cs.city as string | null,
    county: cs.county as string | null,
    postcode: cs.postcode as string | null,
    phone: cs.phone as string | null,
    email: cs.email as string | null,
    website: cs.website as string | null,
    gas_safe_number: cs.gas_safe_number as string | null,
    oftec_number: cs.oftec_number as string | null,
    vat_number: cs.vat_number as string | null,
  } : undefined;

  let formData: Record<string, unknown> | null = null;
  let formLabel = "Service Record";

  if (formType === "service_record") {
    const { data } = await supabaseAdmin.from("service_records").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).single();
    formData = data;
    formLabel = "Service Record";
  } else if (formType === "job_completion") {
    const { data } = await supabaseAdmin.from("job_completion_reports").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).single();
    formData = data;
    formLabel = "Job Completion Report";
  }

  if (!formData) {
    res.status(404).json({ error: `No ${formLabel} found for this job` });
    return;
  }

  const jobRef = job.job_ref || `JOB-${job.id.slice(0, 8).toUpperCase()}`;

  try {
    const pdfBuffer = await generateFormPdf(formType, formData, {
      jobRef,
      customerName,
      propertyAddress,
      technicianName,
      scheduledDate: job.scheduled_date,
    }, company);

    const filename = `${formLabel.replace(/\s+/g, "-").toLowerCase()}-${jobRef}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error("[portal] PDF generation error:", e);
    res.status(500).json({ error: "Failed to generate certificate PDF" });
  }
});

router.get("/portal/dashboard", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const [propertiesRes, jobsRes, customerRes, tenantRes, settingsRes] = await Promise.all([
    supabaseAdmin
      .from("properties")
      .select("id, address_line1, postcode, property_type")
      .eq("customer_id", req.customerId!)
      .eq("is_active", true)
      .order("address_line1"),
    supabaseAdmin
      .from("jobs")
      .select("id, job_ref, job_type, status, scheduled_date, scheduled_time, properties(address_line1)")
      .eq("customer_id", req.customerId!)
      .eq("tenant_id", req.tenantId!)
      .eq("is_active", true)
      .order("scheduled_date", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("customers")
      .select("first_name, last_name, email")
      .eq("id", req.customerId!)
      .single(),
    supabaseAdmin
      .from("tenants")
      .select("company_name")
      .eq("id", req.tenantId!)
      .single(),
    supabaseAdmin
      .from("company_settings")
      .select("payment_link_url")
      .eq("tenant_id", req.tenantId!)
      .eq("singleton_id", "default")
      .maybeSingle(),
  ]);

  const upcomingJobs = (jobsRes.data || []).filter((j: any) =>
    j.status === "scheduled" || j.status === "in_progress"
  );

  const recentJobs = (jobsRes.data || []).filter((j: any) =>
    j.status === "completed"
  ).slice(0, 5);

  res.json({
    customer: customerRes.data,
    company_name: tenantRes.data?.company_name || null,
    payment_link_url: (settingsRes.data as any)?.payment_link_url || null,
    properties_count: propertiesRes.data?.length || 0,
    properties: propertiesRes.data || [],
    upcoming_jobs: upcomingJobs.map((j: any) => ({
      ...j,
      property_address: j.properties?.address_line1 || null,
      properties: undefined,
    })),
    recent_jobs: recentJobs.map((j: any) => ({
      ...j,
      property_address: j.properties?.address_line1 || null,
      properties: undefined,
    })),
  });
});

// ─── Portal Invoices ────────────────────────────────────────────────────────

router.get("/portal/invoices", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("id, type, invoice_number, status, issue_date, due_date, expiry_date, subtotal, vat_rate, vat_amount, total, currency, customer_notes")
    .eq("customer_id", req.customerId!)
    .eq("tenant_id", req.tenantId!)
    .in("status", ["sent", "paid", "overdue", "accepted", "declined", "converted"])
    .order("issue_date", { ascending: false })
    .limit(100);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.get("/portal/invoices/:id/pdf", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  const { id } = req.params;

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("customer_id", req.customerId!)
    .eq("tenant_id", req.tenantId!)
    .in("status", ["sent", "paid", "overdue", "accepted", "declined", "converted"])
    .single();

  if (error || !invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name, email, phone, mobile, address_line1, address_line2, city, county, postcode")
    .eq("id", req.customerId!)
    .maybeSingle();

  const { data: job } = invoice.job_id
    ? await supabaseAdmin.from("jobs").select("job_ref, property_id, description").eq("id", invoice.job_id).maybeSingle()
    : { data: null };

  const { data: property } = (job as any)?.property_id
    ? await supabaseAdmin.from("properties").select("address_line1, address_line2, city, county, postcode").eq("id", (job as any).property_id).maybeSingle()
    : { data: null };

  const { data: cs } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .eq("singleton_id", "default")
    .maybeSingle();

  const customerName = customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Customer";

  const pdfData = {
    type: invoice.type as "invoice" | "quote",
    invoice_number: invoice.invoice_number as string,
    issue_date: invoice.issue_date as string,
    due_date: invoice.due_date as string | null,
    expiry_date: invoice.expiry_date as string | null,
    currency: (invoice.currency as string) || "GBP",
    company_name: (cs as any)?.name || null,
    company_trading_name: (cs as any)?.trading_name || null,
    company_address_line1: (cs as any)?.address_line1 || null,
    company_address_line2: (cs as any)?.address_line2 || null,
    company_city: (cs as any)?.city || null,
    company_county: (cs as any)?.county || null,
    company_postcode: (cs as any)?.postcode || null,
    company_phone: (cs as any)?.phone || null,
    company_email: (cs as any)?.email || null,
    company_website: (cs as any)?.website || null,
    company_vat_number: (cs as any)?.vat_number || null,
    company_gas_safe_number: (cs as any)?.gas_safe_number || null,
    company_oftec_number: (cs as any)?.oftec_number || null,
    company_footer_text: (cs as any)?.invoice_footer_text || null,
    company_bank_details: (cs as any)?.invoice_bank_details || null,
    customer_name: customerName,
    customer_address_line1: customer?.address_line1 || (property as any)?.address_line1 || null,
    customer_address_line2: customer?.address_line2 || (property as any)?.address_line2 || null,
    customer_city: customer?.city || (property as any)?.city || null,
    customer_county: customer?.county || (property as any)?.county || null,
    customer_postcode: customer?.postcode || (property as any)?.postcode || null,
    customer_email: customer?.email || null,
    customer_phone: customer?.phone || customer?.mobile || null,
    job_reference: (job as any)?.job_ref || null,
    job_description: (job as any)?.description || null,
    line_items: (lineItems || []).map((l: any) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      total: Number(l.total),
      item_type: l.item_type,
    })),
    subtotal: Number(invoice.subtotal),
    vat_rate: Number(invoice.vat_rate),
    vat_amount: Number(invoice.vat_amount),
    total: Number(invoice.total),
    works_order: invoice.works_order || null,
    customer_notes: invoice.customer_notes || null,
  };

  try {
    const pdfBuffer = generateInvoicePdf(pdfData);
    const filename = `${invoice.type === "quote" ? "quote" : "invoice"}-${invoice.invoice_number}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ─── PORTAL: Accept / Decline a quote ─────────────────────────────────────
// POST /portal/invoices/:id/accept
// POST /portal/invoices/:id/decline
async function handleQuoteAction(
  req: CustomerPortalRequest,
  res: Response,
  action: "accept" | "decline",
): Promise<void> {
  const { id } = req.params;

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("id, type, status, invoice_number, total, currency, customer_id, tenant_id")
    .eq("id", id)
    .eq("customer_id", req.customerId!)
    .eq("tenant_id", req.tenantId!)
    .eq("type", "quote")
    .eq("status", "sent")
    .single();

  if (error || !invoice) {
    res.status(404).json({ error: "Quote not found or cannot be actioned" });
    return;
  }

  const newStatus = action === "accept" ? "accepted" : "declined";

  const { error: updateError } = await supabaseAdmin
    .from("invoices")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Notify company via email (best-effort)
  try {
    const { data: cs } = await supabaseAdmin
      .from("company_settings")
      .select("email, name, trading_name")
      .eq("tenant_id", req.tenantId!)
      .eq("singleton_id", "default")
      .maybeSingle();

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("first_name, last_name")
      .eq("id", req.customerId!)
      .maybeSingle();

    const companyEmail = (cs as any)?.email;
    const companyName = (cs as any)?.name || (cs as any)?.trading_name || "Your company";
    const customerName = customer ? `${customer.first_name} ${customer.last_name}`.trim() : "A customer";
    const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: (invoice as any).currency || "GBP" }).format(Number((invoice as any).total));

    if (companyEmail) {
      await sendSimpleNotification(
        companyEmail,
        `Quote ${(invoice as any).invoice_number} ${action === "accept" ? "Accepted" : "Declined"} by Customer`,
        `${customerName} has ${action === "accept" ? "accepted" : "declined"} quote ${(invoice as any).invoice_number} for ${amount}.\n\nLog in to TradeWorkDesk to view the quote.`,
      );
    }
  } catch {
    // email notification failure is non-fatal
  }

  res.json({ success: true, status: newStatus });
}

router.post("/portal/invoices/:id/accept", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  return handleQuoteAction(req, res, "accept");
});

router.post("/portal/invoices/:id/decline", requireCustomerAuth, async (req: CustomerPortalRequest, res): Promise<void> => {
  return handleQuoteAction(req, res, "decline");
});

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export default router;
