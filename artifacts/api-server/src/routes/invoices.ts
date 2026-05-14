import { Router, type IRouter } from "express";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { requireTenantInvoicing, bustInvoicingCache } from "../middlewares/require-tenant-invoicing";
import { supabaseAdmin } from "../lib/supabase";
import { generateInvoicePdf, type InvoicePdfData } from "../lib/invoice-pdf";
import { sendInvoiceDocumentEmail } from "../lib/invoice-email";
import { buildInvoiceData } from "./jobs";

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

async function getCompanySettings(tenantId: string) {
  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();
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
    .select("*, customers(first_name, last_name), jobs(description, scheduled_date)", { count: "exact" })
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (type) q = q.eq("type", type);
  if (status) q = q.eq("status", status);
  if (job_id) q = q.eq("job_id", job_id);
  if (customer_id) q = q.eq("customer_id", customer_id);
  if (date_from) q = q.gte("issue_date", date_from);
  if (date_to) q = q.lte("issue_date", date_to);

  const { data, error, count } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

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
    .select("description, scheduled_date, job_type")
    .eq("id", invoice.job_id as string)
    .maybeSingle();

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

  const voidableStatuses = ["draft", "cancelled"];
  if (!voidableStatuses.includes(existing.status as string)) {
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

export default router;
