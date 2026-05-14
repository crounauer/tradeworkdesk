import { Router, type IRouter } from "express";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { requireTenantInvoicing, bustInvoicingCache } from "../middlewares/require-tenant-invoicing";
import { supabaseAdmin } from "../lib/supabase";
import { generateInvoicePdf, type InvoicePdfData } from "../lib/invoice-pdf";
import { sendInvoiceDocumentEmail } from "../lib/invoice-email";
import { buildInvoiceData } from "./jobs";
import { requireStripe } from "../lib/stripe";
import { gcRequest, GC_API_BASE } from "./gocardless";
import { decryptToken } from "../lib/accounting/crypto";
import { getPayPalAccessToken, PP_BASE } from "./paypal-payments";
import { getTrueLayerToken, TL_API_BASE, TL_PAY_BASE } from "./truelayer";
import { getPlatformSetting } from "../lib/geocode";

const router: IRouter = Router();

// ─── Auth middleware chain shared by all invoice endpoints ───────────────────
const protect = [
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requirePlanFeature("invoicing"),
  requireTenantInvoicing,
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  item_type?: string;
  sort_order?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Short-lived in-process cache for company settings (30s TTL) to avoid repeated
// DB hits on the same tenant across invoice list / send / PDF operations.
const settingsCache = new Map<string, { data: Record<string, unknown> | null; ts: number }>();
const SETTINGS_TTL_MS = 30_000;

async function getCompanySettings(tenantId: string) {
  const cached = settingsCache.get(tenantId);
  if (cached && Date.now() - cached.ts < SETTINGS_TTL_MS) return cached.data;
  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();
  settingsCache.set(tenantId, { data: data as Record<string, unknown> | null, ts: Date.now() });
  return data;
}

async function getNextInvoiceNumber(tenantId: string, type: "invoice" | "quote"): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("next_invoice_number", {
    p_tenant_id: tenantId,
    p_type: type,
  });
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);
  return data as string;
}

function computeTotals(lines: LineItemInput[], vatRate: number) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const vat_amount = Math.round(subtotal * vatRate) / 100;
  const total = subtotal + vat_amount;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat_amount: Math.round(vat_amount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

async function verifyInvoiceOwnership(
  invoiceId: string,
  tenantId: string,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "Invoice not found" };
  return { data, error: null };
}

async function buildPdfData(
  invoice: Record<string, unknown>,
  lineItems: Record<string, unknown>[],
  tenantId: string,
): Promise<InvoicePdfData> {
  const settings = await getCompanySettings(tenantId);

  // Load customer
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name, email, phone, mobile, address_line1, address_line2, city, county, postcode")
    .eq("id", invoice.customer_id as string)
    .maybeSingle();

  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : "Unknown Customer";

  // Load job for human-readable ref and property_id
  const { data: job } = invoice.job_id
    ? await supabaseAdmin
        .from("jobs")
        .select("job_ref, property_id, description")
        .eq("id", invoice.job_id as string)
        .maybeSingle()
    : { data: null };

  // Load property address as fallback when customer record has no address
  const { data: property } = job?.property_id
    ? await supabaseAdmin
        .from("properties")
        .select("address_line1, address_line2, city, county, postcode")
        .eq("id", job.property_id as string)
        .maybeSingle()
    : { data: null };

  return {
    type: invoice.type as "invoice" | "quote",
    invoice_number: invoice.invoice_number as string,
    issue_date: invoice.issue_date as string,
    due_date: invoice.due_date as string | null,
    expiry_date: invoice.expiry_date as string | null,
    currency: (invoice.currency as string) || settings?.currency || "GBP",
    // Company
    company_name: settings?.name,
    company_trading_name: settings?.trading_name,
    company_address_line1: settings?.address_line1,
    company_address_line2: settings?.address_line2,
    company_city: settings?.city,
    company_county: settings?.county,
    company_postcode: settings?.postcode,
    company_phone: settings?.phone,
    company_email: settings?.email,
    company_website: settings?.website,
    company_vat_number: settings?.vat_number,
    company_gas_safe_number: settings?.gas_safe_number,
    company_oftec_number: settings?.oftec_number,
    company_logo_url: settings?.logo_url,
    company_footer_text: settings?.invoice_footer_text,
    company_bank_details: settings?.invoice_bank_details,
    company_rates_url: settings?.rates_url,
    company_trading_terms_url: settings?.trading_terms_url,
    // Customer
    customer_name: customerName,
    customer_address_line1: customer?.address_line1 || property?.address_line1,
    customer_address_line2: customer?.address_line2 || property?.address_line2,
    customer_city: customer?.city || property?.city,
    customer_county: customer?.county || property?.county,
    customer_postcode: customer?.postcode || property?.postcode,
    customer_email: customer?.email,
    customer_phone: customer?.phone || customer?.mobile,
    // Job
    job_reference: (job?.job_ref as string | null) || null,
    job_description: (job?.description as string | null) || null,
    // Line items
    line_items: lineItems.map((l) => ({
      description: l.description as string,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      total: Number(l.total),
      item_type: l.item_type as string,
    })),
    subtotal: Number(invoice.subtotal),
    vat_rate: Number(invoice.vat_rate),
    vat_amount: Number(invoice.vat_amount),
    total: Number(invoice.total),
    works_order: invoice.works_order as string | null,
    customer_notes: invoice.customer_notes as string | null,
  };
}

// ─── LIST ──────────────────────────────────────────────────────────────────
// GET /invoices
router.get("/invoices", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const {
    type,
    status,
    statuses,
    job_id,
    customer_id,
    date_from,
    date_to,
    page = "1",
    limit = "50",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  let q = supabaseAdmin
    .from("invoices")
    .select("id, tenant_id, job_id, customer_id, type, status, invoice_number, issue_date, due_date, total, vat_amount, subtotal, currency, paid_amount, payment_date, created_at, customers(first_name, last_name), jobs(description, scheduled_date)", { count: "exact" })
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (type) q = q.eq("type", type);
  if (statuses) {
    const statusList = statuses.split(",").map(s => s.trim()).filter(Boolean);
    if (statusList.length === 1) {
      q = q.eq("status", statusList[0]);
    } else if (statusList.length > 1) {
      q = q.in("status", statusList);
    }
  } else if (status) {
    q = q.eq("status", status);
  }
  if (job_id) q = q.eq("job_id", job_id);
  if (customer_id) q = q.eq("customer_id", customer_id);
  if (date_from) q = q.gte("issue_date", date_from);
  if (date_to) q = q.lte("issue_date", date_to);

  const { data, error, count } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.set("Cache-Control", "private, max-age=30");
  res.json({
    invoices: data || [],
    pagination: {
      total: count ?? 0,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil((count ?? 0) / limitNum),
    },
  });
});

// ─── CREATE ────────────────────────────────────────────────────────────────
// POST /invoices
router.post("/invoices", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const {
    job_id,
    customer_id: direct_customer_id,
    type = "invoice",
    line_items = [],
    issue_date,
    due_date,
    expiry_date,
    notes,
    customer_notes,
    vat_rate,
  } = req.body as {
    job_id?: string;
    customer_id?: string;
    type?: string;
    line_items?: LineItemInput[];
    issue_date?: string;
    due_date?: string;
    expiry_date?: string;
    notes?: string;
    customer_notes?: string;
    vat_rate?: number;
  };

  if (!job_id && !direct_customer_id) { res.status(400).json({ error: "job_id or customer_id is required" }); return; }
  if (!["invoice", "quote"].includes(type)) { res.status(400).json({ error: "type must be invoice or quote" }); return; }

  // Resolve customer_id — either from a job or directly supplied
  let resolvedCustomerId: string;
  if (job_id) {
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id, customer_id, tenant_id")
      .eq("id", job_id)
      .eq("tenant_id", req.tenantId!)
      .maybeSingle();
    if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }
    resolvedCustomerId = (job as { customer_id: string }).customer_id;
  } else {
    // Verify customer belongs to tenant
    const { data: customer, error: custErr } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", direct_customer_id!)
      .eq("tenant_id", req.tenantId!)
      .maybeSingle();
    if (custErr || !customer) { res.status(404).json({ error: "Customer not found" }); return; }
    resolvedCustomerId = direct_customer_id!;
  }

  // Resolve VAT rate
  const settings = await getCompanySettings(req.tenantId!);
  const resolvedVatRate = vat_rate ?? settings?.default_vat_rate ?? 20;
  const currency = settings?.currency || "GBP";
  const resolvedIssueDate = issue_date || new Date().toISOString().slice(0, 10);

  // Due / expiry date defaults
  let resolvedDueDate = due_date || null;
  let resolvedExpiryDate = expiry_date || null;
  if (!resolvedDueDate && type === "invoice" && settings?.default_payment_terms_days) {
    const d = new Date(resolvedIssueDate);
    d.setDate(d.getDate() + settings.default_payment_terms_days);
    resolvedDueDate = d.toISOString().slice(0, 10);
  }
  if (!resolvedExpiryDate && type === "quote") {
    const validityDays = settings?.quote_validity_days ?? 30;
    const d = new Date(resolvedIssueDate);
    d.setDate(d.getDate() + validityDays);
    resolvedExpiryDate = d.toISOString().slice(0, 10);
  }

  const invoiceNumber = await getNextInvoiceNumber(req.tenantId!, type as "invoice" | "quote").catch(
    (e) => { res.status(500).json({ error: e.message }); return null; },
  );
  if (!invoiceNumber) return;

  const { subtotal, vat_amount, total } = computeTotals(line_items, resolvedVatRate);

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from("invoices")
    .insert({
      tenant_id: req.tenantId,
      job_id: job_id || null,
      customer_id: resolvedCustomerId,
      type,
      status: "draft",
      invoice_number: invoiceNumber,
      issue_date: resolvedIssueDate,
      due_date: resolvedDueDate,
      expiry_date: resolvedExpiryDate,
      notes: notes || null,
      customer_notes: customer_notes || null,
      subtotal,
      vat_rate: resolvedVatRate,
      vat_amount,
      total,
      currency,
      created_by: req.userId,
    })
    .select()
    .single();

  if (invErr || !invoice) { res.status(500).json({ error: invErr?.message || "Failed to create invoice" }); return; }

  // Insert line items
  if (line_items.length > 0) {
    const items = line_items.map((l, i) => ({
      invoice_id: (invoice as { id: string }).id,
      tenant_id: req.tenantId,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total: Math.round(l.quantity * l.unit_price * 100) / 100,
      item_type: l.item_type || "other",
      sort_order: l.sort_order ?? i,
    }));
    await supabaseAdmin.from("invoice_line_items").insert(items);
  }

  res.status(201).json(invoice);
});

// ─── CREATE FROM JOB (pre-populated line items) ────────────────────────────
// POST /jobs/:id/create-internal-invoice
router.post("/jobs/:id/create-internal-invoice", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;

  const { data: jobRow } = await supabaseAdmin
    .from("jobs")
    .select("id, status, customer_id")
    .eq("id", jobId)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (!jobRow) { res.status(404).json({ error: "Job not found" }); return; }
  if (jobRow.status !== "completed" && jobRow.status !== "invoiced") {
    res.status(400).json({ error: "Only completed or invoiced jobs can be invoiced" }); return;
  }

  const invoiceData = await buildInvoiceData(jobId, req.tenantId);
  if (!invoiceData) { res.status(500).json({ error: "Failed to load job data" }); return; }

  const settings = await getCompanySettings(req.tenantId!);
  const resolvedVatRate = invoiceData.vat_rate ?? settings?.default_vat_rate ?? 20;
  const currency = invoiceData.currency || settings?.currency || "GBP";
  const issueDate = new Date().toISOString().slice(0, 10);

  let dueDate: string | null = null;
  if (settings?.default_payment_terms_days) {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + settings.default_payment_terms_days);
    dueDate = d.toISOString().slice(0, 10);
  }

  const invoiceNumber = await getNextInvoiceNumber(req.tenantId!, "invoice").catch(
    (e) => { res.status(500).json({ error: (e as Error).message }); return null; },
  );
  if (!invoiceNumber) return;

  // Map buildInvoiceData lines → invoice line item inputs
  const lineItems: LineItemInput[] = invoiceData.lines.map((l, i) => {
    let item_type = "labour";
    if (l.item_name === "product") item_type = "product";
    else if (l.item_name === "service") item_type = "service";
    else if (l.description.toLowerCase().includes("call-out")) item_type = "callout";
    return { description: l.description, quantity: l.quantity, unit_price: l.unit_price, item_type, sort_order: i };
  });

  const { subtotal, vat_amount, total } = computeTotals(lineItems, resolvedVatRate);

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from("invoices")
    .insert({
      tenant_id: req.tenantId,
      job_id: jobId,
      customer_id: (jobRow as { customer_id: string }).customer_id,
      type: "invoice",
      status: "draft",
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      due_date: dueDate,
      customer_notes: invoiceData.attendance_summary || null,
      subtotal,
      vat_rate: resolvedVatRate,
      vat_amount,
      total,
      currency,
      created_by: req.userId,
    })
    .select()
    .single();

  if (invErr || !invoice) { res.status(500).json({ error: invErr?.message || "Failed to create invoice" }); return; }

  if (lineItems.length > 0) {
    const items = lineItems.map((l, i) => ({
      invoice_id: (invoice as { id: string }).id,
      tenant_id: req.tenantId,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total: Math.round(l.quantity * l.unit_price * 100) / 100,
      item_type: l.item_type || "other",
      sort_order: l.sort_order ?? i,
    }));
    await supabaseAdmin.from("invoice_line_items").insert(items);
  }

  bustInvoicingCache(req.tenantId!);
  res.status(201).json({ id: (invoice as { id: string }).id, invoice_number: invoiceNumber });
});

// ─── GET ONE ───────────────────────────────────────────────────────────────
// GET /invoices/:id
router.get("/invoices/:id", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (error || !invoice) { res.status(404).json({ error: error || "Invoice not found" }); return; }

  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .order("sort_order");

  // Enrich with customer + job info
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name, email, phone, mobile, address_line1, city, postcode")
    .eq("id", invoice.customer_id as string)
    .maybeSingle();

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("description, scheduled_date, job_type, property_id")
    .eq("id", invoice.job_id as string)
    .maybeSingle();

  res.set("Cache-Control", "no-cache");
  res.json({ ...invoice, line_items: lineItems || [], customer, job });
});

// ─── UPDATE ────────────────────────────────────────────────────────────────
// PUT /invoices/:id
router.put("/invoices/:id", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: existing, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !existing) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  if (existing.status !== "draft") {
    res.status(400).json({ error: "Only draft invoices/quotes can be edited" });
    return;
  }

  const {
    line_items,
    works_order,
    notes,
    customer_notes,
    issue_date,
    due_date,
    expiry_date,
    vat_rate,
  } = req.body as {
    line_items?: LineItemInput[];
    works_order?: string;
    notes?: string;
    customer_notes?: string;
    issue_date?: string;
    due_date?: string;
    expiry_date?: string;
    vat_rate?: number;
  };

  const resolvedVatRate = vat_rate ?? Number(existing.vat_rate);
  const resolvedLines = line_items ?? [];
  const { subtotal, vat_amount, total } = computeTotals(resolvedLines, resolvedVatRate);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (works_order !== undefined) updates.works_order = works_order || null;
  if (notes !== undefined) updates.notes = notes || null;
  if (customer_notes !== undefined) updates.customer_notes = customer_notes || null;
  if (issue_date !== undefined) updates.issue_date = issue_date;
  if (due_date !== undefined) updates.due_date = due_date || null;
  if (expiry_date !== undefined) updates.expiry_date = expiry_date || null;
  if (vat_rate !== undefined) updates.vat_rate = vat_rate;
  if (line_items !== undefined) {
    updates.subtotal = subtotal;
    updates.vat_amount = vat_amount;
    updates.total = total;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("invoices")
    .update(updates)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (updateErr) { res.status(500).json({ error: updateErr.message }); return; }

  // Replace line items if provided
  if (line_items !== undefined) {
    await supabaseAdmin.from("invoice_line_items").delete().eq("invoice_id", req.params.id);
    if (line_items.length > 0) {
      const items = line_items.map((l, i) => ({
        invoice_id: req.params.id,
        tenant_id: req.tenantId,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total: Math.round(l.quantity * l.unit_price * 100) / 100,
        item_type: l.item_type || "other",
        sort_order: l.sort_order ?? i,
      }));
      await supabaseAdmin.from("invoice_line_items").insert(items);
    }
  }

  res.json(updated);
});

// ─── DELETE / VOID ─────────────────────────────────────────────────────────
// DELETE /invoices/:id
router.delete("/invoices/:id", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: existing, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !existing) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  const hardDeleteStatuses = ["draft", "cancelled", "converted"];
  if (!hardDeleteStatuses.includes(existing.status as string)) {
    // Sent/paid invoices are voided rather than hard-deleted
    const { error } = await supabaseAdmin
      .from("invoices")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("tenant_id", req.tenantId!);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ voided: true });
    return;
  }

  // Hard delete drafts and already-cancelled
  // First: clear any quote that references this invoice as its converted result
  await supabaseAdmin
    .from("invoices")
    .update({ converted_to_invoice_id: null })
    .eq("converted_to_invoice_id", req.params.id)
    .eq("tenant_id", req.tenantId!);

  await supabaseAdmin.from("invoice_line_items").delete().eq("invoice_id", req.params.id);
  const { error } = await supabaseAdmin.from("invoices").delete().eq("id", req.params.id).eq("tenant_id", req.tenantId!);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

// ─── SEND ──────────────────────────────────────────────────────────────────
// POST /invoices/:id/send
router.post("/invoices/:id/send", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  if (!["draft", "sent"].includes(invoice.status as string)) {
    res.status(400).json({ error: "Cannot send an invoice that is already paid, cancelled or converted" });
    return;
  }

  // Resolve email recipient
  const recipientEmail: string | undefined = req.body.override_email || undefined;
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name, email")
    .eq("id", invoice.customer_id as string)
    .maybeSingle();

  const toEmail = recipientEmail || customer?.email;
  if (!toEmail) {
    res.status(400).json({ error: "No email address found for this customer. Add one or provide override_email in the request body." });
    return;
  }

  // Load line items
  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", req.params.id)
    .order("sort_order");

  // Build PDF
  let pdfBuffer: Buffer;
  try {
    const pdfData = await buildPdfData(invoice, lineItems || [], req.tenantId!);
    pdfBuffer = generateInvoicePdf(pdfData);
  } catch (e) {
    res.status(500).json({ error: `PDF generation failed: ${(e as Error).message}` });
    return;
  }

  // Store PDF in Supabase Storage
  const storagePath = `invoices/${req.tenantId}/${req.params.id}.pdf`;
  const { error: storageErr } = await supabaseAdmin.storage
    .from("invoice-pdfs")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (storageErr) {
    console.error("[invoices] PDF storage error:", storageErr.message);
    // Non-fatal — continue with email
  }

  // Send email
  const settings = await getCompanySettings(req.tenantId!);
  try {
    await sendInvoiceDocumentEmail({
      to: toEmail,
      type: invoice.type as "invoice" | "quote",
      invoiceNumber: invoice.invoice_number as string,
      customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Customer",
      total: Number(invoice.total),
      currency: (invoice.currency as string) || settings?.currency || "GBP",
      dueDate: invoice.due_date as string | null,
      paymentTermsDays: settings?.default_payment_terms_days ?? null,
      expiryDate: invoice.expiry_date as string | null,
      customerNotes: invoice.customer_notes as string | null,
      worksOrder: invoice.works_order as string | null,
      bankDetails: settings?.invoice_bank_details ?? null,
      pdfBuffer,
      portalUrl: invoice.type === "invoice"
        ? `${process.env.APP_URL || "https://tradeworkdesk.co.uk"}/portal/invoices`
        : null,
      company: settings ? {
        name: settings.name,
        trading_name: settings.trading_name,
        logo_url: settings.logo_url,
        email: settings.email,
        phone: settings.phone,
        website: settings.website,
        address_line1: settings.address_line1,
        address_line2: settings.address_line2,
        city: settings.city,
        county: settings.county,
        postcode: settings.postcode,
        vat_number: settings.vat_number,
        rates_url: settings.rates_url,
        trading_terms_url: settings.trading_terms_url,
      } : undefined,
    });
  } catch (e) {
    res.status(500).json({ error: `Email send failed: ${(e as Error).message}` });
    return;
  }

  // Update status + timestamps
  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("invoices")
    .update({
      status: "sent",
      sent_at: nowIso,
      pdf_storage_path: storageErr ? null : storagePath,
      updated_at: nowIso,
    })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (updateErr) { res.status(500).json({ error: updateErr.message }); return; }

  // ── Create Stripe Checkout Session if tenant has Connect account ────────
  // Only for invoices (not quotes) with a positive balance
  if (invoice.type === "invoice" && Number(invoice.total) > 0) {
    try {
      const stripe = requireStripe(false);
      const { data: tenantRow } = await supabaseAdmin
        .from("tenants")
        .select("stripe_connect_account_id, stripe_connect_charges_enabled")
        .eq("id", req.tenantId!)
        .single();
      const connectAccountId = (tenantRow as any)?.stripe_connect_account_id as string | null;
      const chargesEnabled = !!(tenantRow as any)?.stripe_connect_charges_enabled;

      if (stripe && connectAccountId && chargesEnabled) {
        const amountCents = Math.round(Number(invoice.total) * 100);
        const currency = ((invoice.currency as string) || "gbp").toLowerCase();
        const invoiceLabel = `Invoice ${invoice.invoice_number as string}`;
        const customerName = customer
          ? `${customer.first_name} ${customer.last_name}`.trim()
          : "Customer";
        const portalUrl = `${process.env.APP_URL || "https://tradeworkdesk.co.uk"}/portal/invoices`;

        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency,
                  unit_amount: amountCents,
                  product_data: { name: `${invoiceLabel} — ${customerName}` },
                },
                quantity: 1,
              },
            ],
            metadata: {
              invoice_id: req.params.id,
              tenant_id: req.tenantId!,
            },
            customer_email: toEmail,
            success_url: `${portalUrl}?payment_success=1`,
            cancel_url: `${portalUrl}`,
          },
          { stripeAccount: connectAccountId }
        );

        await supabaseAdmin
          .from("invoices")
          .update({
            stripe_payment_link_url: session.url,
            stripe_checkout_session_id: session.id,
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq("id", req.params.id)
          .eq("tenant_id", req.tenantId!);
      }
    } catch (err) {
      // Non-fatal — log but don't fail the send
      console.error("[invoices] Failed to create Stripe Checkout Session:", (err as Error).message);
    }

    // ── GoCardless Billing Request ───────────────────────────────────────────
    try {
      const { data: gcTenant } = await supabaseAdmin
        .from("tenants")
        .select("gocardless_access_token, gocardless_organisation_id")
        .eq("id", req.tenantId!)
        .single();
      const gcToken = (gcTenant as any)?.gocardless_access_token as string | null;
      const gcOrgId = (gcTenant as any)?.gocardless_organisation_id as string | null;

      if (gcToken && gcOrgId) {
        const decryptedToken = decryptToken(gcToken);
        const amountPence = Math.round(Number(invoice.total) * 100);
        const currency = ((invoice.currency as string) || "GBP").toUpperCase();
        const portalUrl = `${process.env.APP_URL || "https://tradeworkdesk.co.uk"}/portal/invoices`;

        // Create BillingRequest
        const brRes = await gcRequest<{ billing_requests: { id: string } }>(
          decryptedToken, "POST", "/billing_requests",
          {
            billing_requests: {
              payment_request: {
                description: `Invoice ${invoice.invoice_number as string}`,
                amount: amountPence,
                currency,
              },
            },
          },
        );
        const billingRequestId = brRes.billing_requests.id;

        // Create BillingRequestFlow to get the hosted URL
        const flowRes = await gcRequest<{ billing_request_flows: { authorisation_url: string } }>(
          decryptedToken, "POST", "/billing_request_flows",
          {
            billing_request_flows: {
              redirect_uri: `${portalUrl}?gc_success=1`,
              exit_uri: portalUrl,
              links: { billing_request: billingRequestId },
            },
          },
        );

        await supabaseAdmin
          .from("invoices")
          .update({
            gocardless_payment_link_url: flowRes.billing_request_flows.authorisation_url,
            gocardless_billing_request_id: billingRequestId,
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq("id", req.params.id)
          .eq("tenant_id", req.tenantId!);
      }
    } catch (err) {
      console.error("[invoices] Failed to create GoCardless Billing Request:", (err as Error).message);
    }

    // ── PayPal Order ─────────────────────────────────────────────────────────
    try {
      const { data: ppTenant } = await supabaseAdmin
        .from("tenants")
        .select("paypal_client_id, paypal_client_secret")
        .eq("id", req.tenantId!)
        .single();
      const ppClientIdEnc = (ppTenant as any)?.paypal_client_id as string | null;
      const ppSecretEnc = (ppTenant as any)?.paypal_client_secret as string | null;

      if (ppClientIdEnc && ppSecretEnc) {
        const ppClientId = decryptToken(ppClientIdEnc);
        const ppSecret = decryptToken(ppSecretEnc);
        const ppToken = await getPayPalAccessToken(ppClientId, ppSecret);
        const portalUrl = `${process.env.APP_URL || "https://tradeworkdesk.co.uk"}/portal/invoices`;
        const amount = Number(invoice.total).toFixed(2);
        const currency = ((invoice.currency as string) || "GBP").toUpperCase();

        const orderRes = await fetch(`${PP_BASE}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ppToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
              reference_id: req.params.id,
              description: `Invoice ${invoice.invoice_number as string}`,
              amount: { currency_code: currency, value: amount },
              custom_id: `${req.tenantId}:${req.params.id}`,
            }],
            application_context: {
              return_url: `${portalUrl}?pp_success=1`,
              cancel_url: portalUrl,
              brand_name: (invoice as any).company_name || "TradeWorkDesk",
              user_action: "PAY_NOW",
            },
          }),
        });

        if (orderRes.ok) {
          const orderData = await orderRes.json() as {
            id: string;
            links: Array<{ rel: string; href: string }>;
          };
          const approveUrl = orderData.links.find((l) => l.rel === "approve")?.href ?? null;
          if (approveUrl) {
            await supabaseAdmin
              .from("invoices")
              .update({
                paypal_payment_link_url: approveUrl,
                paypal_order_id: orderData.id,
                updated_at: new Date().toISOString(),
              } as Record<string, unknown>)
              .eq("id", req.params.id)
              .eq("tenant_id", req.tenantId!);
          }
        } else {
          const errBody = await orderRes.json().catch(() => ({}));
          console.error("[invoices] PayPal order creation failed:", JSON.stringify(errBody));
        }
      }
    } catch (err) {
      console.error("[invoices] Failed to create PayPal Order:", (err as Error).message);
    }

    // ── TrueLayer Open Banking Payment ───────────────────────────────────────
    try {
      const { data: tlTenant } = await supabaseAdmin
        .from("tenants")
        .select("truelayer_sort_code, truelayer_account_number, truelayer_account_holder_name, truelayer_enabled")
        .eq("id", req.tenantId!)
        .single();
      const tl = tlTenant as any;

      const tlClientId = await getPlatformSetting("truelayer_client_id", "TRUELAYER_CLIENT_ID").catch(() => null);
      if (tl?.truelayer_enabled && tl?.truelayer_sort_code && tl?.truelayer_account_number && tlClientId) {
        const tlToken = await getTrueLayerToken();
        const amountMinor = Math.round(Number(invoice.total) * 100);
        const currency = ((invoice.currency as string) || "GBP").toUpperCase();
        const portalUrl = `${process.env.APP_URL || "https://tradeworkdesk.co.uk"}/portal/invoices`;
        const customerName = customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Customer";

        const paymentRes = await fetch(`${TL_API_BASE}/v3/payments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tlToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount_in_minor: amountMinor,
            currency,
            payment_method: {
              type: "bank_transfer",
              provider_selection: { type: "user_selected" },
              beneficiary: {
                type: "external_account",
                account_holder_name: tl.truelayer_account_holder_name,
                account_identifier: {
                  type: "sort_code_account_number",
                  sort_code: tl.truelayer_sort_code,
                  account_number: tl.truelayer_account_number,
                },
                reference: `Invoice ${invoice.invoice_number as string}`,
              },
            },
            user: {
              name: customerName,
              email: toEmail ?? undefined,
            },
            metadata: {
              invoice_id: req.params.id,
              tenant_id: req.tenantId!,
            },
            return_uri: `${portalUrl}?tl_success=1`,
          }),
        });

        if (paymentRes.ok) {
          const paymentData = await paymentRes.json() as { id: string; resource_token: string };
          const paymentLink = `${TL_PAY_BASE}/payments#${paymentData.resource_token}`;

          await supabaseAdmin
            .from("invoices")
            .update({
              truelayer_payment_link_url: paymentLink,
              truelayer_payment_id: paymentData.id,
              updated_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq("id", req.params.id)
            .eq("tenant_id", req.tenantId!);
        } else {
          const errBody = await paymentRes.json().catch(() => ({}));
          console.error("[invoices] TrueLayer payment creation failed:", JSON.stringify(errBody));
        }
      }
    } catch (err) {
      console.error("[invoices] Failed to create TrueLayer payment:", (err as Error).message);
    }
  }

  // Log to job_email_logs
  const docLabel = invoice.type === "quote"
    ? `Quote ${invoice.invoice_number}`
    : `Invoice ${invoice.invoice_number}`;
  const { error: logErr } = await supabaseAdmin.from("job_email_logs").insert({
    job_id: invoice.job_id,
    tenant_id: req.tenantId,
    sent_by: req.userId,
    sent_to: toEmail,
    subject: `${docLabel} — ${customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Customer"}`,
    forms_included: [{ form_type: invoice.type, form_label: docLabel, form_id: req.params.id }],
  });
  if (logErr) console.error("[invoices] Failed to log email:", logErr.message);

  res.json({ ...updated, sent_to: toEmail });
});

// ─── GET PDF ───────────────────────────────────────────────────────────────
// GET /invoices/:id/pdf
router.get("/invoices/:id/pdf", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", req.params.id)
    .order("sort_order");

  let pdfBuffer: Buffer;
  try {
    const pdfData = await buildPdfData(invoice, lineItems || [], req.tenantId!);
    pdfBuffer = generateInvoicePdf(pdfData);
  } catch (e) {
    res.status(500).json({ error: `PDF generation failed: ${(e as Error).message}` });
    return;
  }

  const type = (invoice.type as string) === "quote" ? "quote" : "invoice";
  const number = invoice.invoice_number as string;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${type}-${number}.pdf"`);
  res.send(pdfBuffer);
});

// ─── UNSEND (revert sent → draft) ─────────────────────────────────────────
// POST /invoices/:id/unsend
router.post("/invoices/:id/unsend", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  if (invoice.status !== "sent") {
    res.status(400).json({ error: "Only sent invoices/quotes can be unsent" }); return;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("invoices")
    .update({ status: "draft", sent_at: null, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(updated);
});

// ─── MARK SENT (no email) ──────────────────────────────────────────────────
// POST /invoices/:id/mark-sent
router.post("/invoices/:id/mark-sent", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  if (invoice.status !== "draft") {
    res.status(400).json({ error: "Only draft invoices can be marked as sent" }); return;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("invoices")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(updated);
});

// ─── MARK PAID ─────────────────────────────────────────────────────────────
// POST /invoices/:id/mark-paid
router.post("/invoices/:id/mark-paid", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  if (invoice.type !== "invoice") {
    res.status(400).json({ error: "Only invoices can be marked as paid (not quotes)" });
    return;
  }
  if (!["sent", "overdue"].includes(invoice.status as string)) {
    res.status(400).json({ error: "Only sent or overdue invoices can be marked as paid" });
    return;
  }

  const { paid_amount, payment_date, payment_method, payment_reference } = req.body as {
    paid_amount?: number;
    payment_date?: string;
    payment_method?: string;
    payment_reference?: string;
  };

  const { data: updated, error } = await supabaseAdmin
    .from("invoices")
    .update({
      status: "paid",
      paid_amount: paid_amount ?? invoice.total,
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
      payment_method: payment_method || null,
      payment_reference: payment_reference || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(updated);
});

// ─── ACCEPT QUOTE ──────────────────────────────────────────────────────────
// POST /invoices/:id/accept
router.post("/invoices/:id/accept", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  if (invoice.type !== "quote") {
    res.status(400).json({ error: "Only quotes can be accepted" });
    return;
  }
  if (invoice.status !== "sent") {
    res.status(400).json({ error: "Only sent quotes can be accepted" });
    return;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("invoices")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(updated);
});

// ─── DECLINE QUOTE ─────────────────────────────────────────────────────────
// POST /invoices/:id/decline
router.post("/invoices/:id/decline", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  if (invoice.type !== "quote") {
    res.status(400).json({ error: "Only quotes can be declined" });
    return;
  }
  if (!["sent", "accepted"].includes(invoice.status as string)) {
    res.status(400).json({ error: "Only sent or accepted quotes can be declined" });
    return;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("invoices")
    .update({ status: "declined", declined_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(updated);
});

// ─── EMAIL LOG ──────────────────────────────────────────────────────────────
// GET /invoices/:id/email-log
router.get("/invoices/:id/email-log", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: invoice, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !invoice) { res.status(404).json({ error: lookupErr || "Invoice not found" }); return; }

  let q = supabaseAdmin
    .from("job_email_logs")
    .select("*, profiles(full_name)")
    .filter("forms_included", "cs", JSON.stringify([{ form_id: req.params.id }]))
    .order("created_at", { ascending: false });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((entry: Record<string, unknown>) => ({
    id: entry.id,
    sent_by_name: (entry.profiles as Record<string, unknown>)?.full_name || null,
    sent_to: entry.sent_to,
    created_at: entry.created_at,
  }));

  res.json(mapped);
});

// ─── CONVERT QUOTE → INVOICE ───────────────────────────────────────────────
// POST /invoices/:id/convert
router.post("/invoices/:id/convert", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data: quote, error: lookupErr } = await verifyInvoiceOwnership(req.params.id, req.tenantId!);
  if (lookupErr || !quote) { res.status(404).json({ error: lookupErr || "Quote not found" }); return; }

  if (quote.type !== "quote") {
    res.status(400).json({ error: "Only quotes can be converted to invoices" });
    return;
  }
  if (quote.status !== "accepted") {
    res.status(400).json({ error: "Only accepted quotes can be converted to invoices" });
    return;
  }
  if (quote.converted_to_invoice_id) {
    res.status(400).json({ error: "This quote has already been converted to an invoice" });
    return;
  }

  // Load existing line items
  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", req.params.id)
    .order("sort_order");

  const settings = await getCompanySettings(req.tenantId!);
  const issueDate = new Date().toISOString().slice(0, 10);
  let dueDate: string | null = null;
  if (settings?.default_payment_terms_days) {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + settings.default_payment_terms_days);
    dueDate = d.toISOString().slice(0, 10);
  }

  const invoiceNumber = await getNextInvoiceNumber(req.tenantId!, "invoice").catch(
    (e) => { res.status(500).json({ error: e.message }); return null; },
  );
  if (!invoiceNumber) return;

  // Create new invoice from quote data
  const { data: newInvoice, error: invErr } = await supabaseAdmin
    .from("invoices")
    .insert({
      tenant_id: req.tenantId,
      job_id: quote.job_id,
      customer_id: quote.customer_id,
      type: "invoice",
      status: "draft",
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      due_date: dueDate,
      notes: quote.notes,
      customer_notes: quote.customer_notes,
      works_order: quote.works_order,
      subtotal: quote.subtotal,
      vat_rate: quote.vat_rate,
      vat_amount: quote.vat_amount,
      total: quote.total,
      currency: quote.currency,
      created_by: req.userId,
    })
    .select()
    .single();

  if (invErr || !newInvoice) { res.status(500).json({ error: invErr?.message || "Failed to create invoice" }); return; }

  // Copy line items
  if ((lineItems || []).length > 0) {
    const newItems = (lineItems || []).map((l: Record<string, unknown>) => ({
      invoice_id: (newInvoice as { id: string }).id,
      tenant_id: req.tenantId,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total: l.total,
      item_type: l.item_type,
      sort_order: l.sort_order,
    }));
    await supabaseAdmin.from("invoice_line_items").insert(newItems);
  }

  // Mark quote as converted
  await supabaseAdmin
    .from("invoices")
    .update({
      status: "converted",
      converted_to_invoice_id: (newInvoice as { id: string }).id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!);

  res.status(201).json(newInvoice);
});

// ─── CSV EXPORT ────────────────────────────────────────────────────────────
// GET /invoices/export.csv
// Optional query params: type, status, date_from, date_to, customer_id
// Returns a Xero-compatible CSV file.
router.get("/invoices/export.csv", ...protect, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { type, status, date_from, date_to, customer_id } = req.query as Record<string, string>;

  let q = supabaseAdmin
    .from("invoices")
    .select("id, type, status, invoice_number, issue_date, due_date, payment_date, subtotal, vat_amount, total, currency, customers(first_name, last_name), jobs(description)")
    .eq("tenant_id", req.tenantId!)
    .order("issue_date", { ascending: false });

  if (type) q = q.eq("type", type);
  if (status) q = q.eq("status", status);
  if (customer_id) q = q.eq("customer_id", customer_id);
  if (date_from) q = q.gte("issue_date", date_from);
  if (date_to) q = q.lte("issue_date", date_to);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const rows = (data || []) as Array<{
    type: string; status: string; invoice_number: string; issue_date: string;
    due_date: string | null; payment_date: string | null;
    subtotal: number; vat_amount: number; total: number; currency: string;
    customers: { first_name: string; last_name: string } | null;
    jobs: { description: string } | null;
  }>;

  function csvEscape(v: string | null | undefined): string {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const headers = ["Type", "Invoice Number", "Customer", "Issue Date", "Due Date", "Description", "Net Amount", "VAT Amount", "Total", "Currency", "Status", "Paid Date"];
  const lines: string[] = [headers.join(",")];

  for (const row of rows) {
    const customerName = row.customers
      ? `${row.customers.first_name} ${row.customers.last_name}`.trim()
      : "";
    const cols = [
      csvEscape(row.type === "quote" ? "Quote" : "Invoice"),
      csvEscape(row.invoice_number),
      csvEscape(customerName),
      csvEscape(row.issue_date),
      csvEscape(row.due_date),
      csvEscape(row.jobs?.description),
      csvEscape(Number(row.subtotal).toFixed(2)),
      csvEscape(Number(row.vat_amount).toFixed(2)),
      csvEscape(Number(row.total).toFixed(2)),
      csvEscape(row.currency?.toUpperCase() || "GBP"),
      csvEscape(row.status),
      csvEscape(row.payment_date),
    ];
    lines.push(cols.join(","));
  }

  const csv = lines.join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="invoices-export-${date}.csv"`);
  res.send("\uFEFF" + csv); // BOM for Excel compatibility
});

export default router;
