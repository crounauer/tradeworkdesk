import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requireRole, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { requireTenantInvoicing } from "../middlewares/require-tenant-invoicing";
import { hasActiveAddon, deductAddonCredit, getAddonCredits } from "../lib/tenant-limits";
import { supabaseAdmin } from "../lib/supabase";
import { notifyUsersForEvent } from "../lib/push-events";
import { z } from "zod";
import { verifyMultipleTenantOwnership } from "../lib/tenant-validation";
import { createInvoiceSmsToken } from "../lib/invoice-sms-token";
import { syncSentInvoiceJob } from "../lib/invoice-job-status";
import type { Response, NextFunction } from "express";

const router: IRouter = Router();

// ──────────────────────────────────────────────────────────────
// SMS Works helpers
// ──────────────────────────────────────────────────────────────

async function getSmsWorksCredentials(): Promise<{ key: string; secret: string } | null> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["sms_works_api_key", "sms_works_secret"]);

  if (!data || data.length < 2) return null;

  const map: Record<string, string> = {};
  for (const row of data as { key: string; value: string }[]) {
    map[row.key] = row.value;
  }

  if (!map["sms_works_api_key"] || !map["sms_works_secret"]) return null;
  return { key: map["sms_works_api_key"], secret: map["sms_works_secret"] };
}

async function getSmsWorksJwt(key: string, secret: string): Promise<string> {
  const res = await fetch("https://api.thesmsworks.co.uk/v1/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SMS Works auth failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { token: string };
  if (!data.token) throw new Error("SMS Works returned no token");
  return data.token;
}

// ──────────────────────────────────────────────────────────────
// POST /api/sms/send
// ──────────────────────────────────────────────────────────────
interface InvoiceSmsRequest extends AuthenticatedRequest {
  invoiceSms?: { id: string; status: string; sentAt: string; updatedAt: string; needsUpdate: boolean; logContent: string };
}

router.post("/invoices/:id/send-sms", requireAuth, requireTenant,
  requireRole("admin", "office_staff", "bookkeeper", "accountant"),
  requirePlanFeature("invoicing"), requireTenantInvoicing,
  async (req: InvoiceSmsRequest, res: Response, next: NextFunction): Promise<void> => {
    const invoiceId = z.string().uuid().safeParse(req.params.id);
    if (!invoiceId.success) { res.status(400).json({ error: "Invalid invoice ID" }); return; }
    const { data: invoice, error } = await supabaseAdmin.from("invoices")
      .select("id, type, status, customer_id, job_id, sent_at, updated_at")
      .eq("id", invoiceId.data).eq("tenant_id", req.tenantId!).maybeSingle();
    if (error) { res.status(500).json({ error: "Unable to load invoice" }); return; }
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (invoice.type !== "invoice" || !["draft", "sent", "overdue", "paid"].includes(invoice.status)) {
      res.status(400).json({ error: "This invoice cannot be sent by SMS" }); return;
    }
    const sentAt = invoice.status === "draft" || !invoice.sent_at ? new Date().toISOString() : invoice.sent_at;
    const token = createInvoiceSmsToken(invoice.id, sentAt);
    const link = `${(process.env.APP_URL || "https://tradeworkdesk.co.uk").replace(/\/+$/, "")}/api/public/invoice-view#${token}`;
    const message = typeof req.body.content === "string" ? req.body.content.trim() : "";
    req.invoiceSms = {
      id: invoice.id, status: invoice.status, sentAt, updatedAt: invoice.updated_at,
      needsUpdate: invoice.status === "draft" || !invoice.sent_at,
      logContent: `${message}\n[secure invoice link]`,
    };
    req.body = {
      ...req.body,
      content: message ? `${message}\n${link}` : "",
      job_id: invoice.job_id || undefined,
      customer_id: invoice.customer_id,
      enquiry_id: undefined,
    };
    next();
  }, sendSms);

router.post("/sms/send", requireAuth, requireTenant, sendSms);

async function sendSms(req: InvoiceSmsRequest, res: Response): Promise<void> {
  const { destination, content, sender_id, job_id, customer_id, enquiry_id } = req.body as {
    destination?: string;
    content?: string;
    sender_id?: string;
    job_id?: string;
    customer_id?: string;
    enquiry_id?: string;
  };

  if (!destination || typeof destination !== "string") {
    res.status(400).json({ error: "destination is required" });
    return;
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  // Tenant-level addon check — usage addons don't require per-user assignment
  const tenantHasAddon = await hasActiveAddon(req.tenantId!, "sms_messaging");
  if (!tenantHasAddon) {
    res.status(402).json({ error: "SMS Messaging add-on required. Contact your administrator to activate this feature." });
    return;
  }

  // Credit check
  let creditInfo: Awaited<ReturnType<typeof getAddonCredits>>;
  try {
    creditInfo = await getAddonCredits(req.tenantId!, "sms_messaging", !!req.invoiceSms);
  } catch (error) {
    console.error("[invoice-sms] Credit check failed:", error);
    res.status(503).json({ error: "Unable to verify SMS credits. Please try again." });
    return;
  }
  if (creditInfo !== null && creditInfo.credits_remaining <= 0) {
    res.status(402).json({
      error: "No SMS credits remaining. Purchase more credits on the Billing page.",
      credits_remaining: 0,
      bundle_size: creditInfo.bundle_size,
      bundle_price: creditInfo.bundle_price,
    });
    return;
  }

  const links = z.object({
    enquiry_id: z.string().uuid().optional(),
    job_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),
  }).safeParse({ enquiry_id, job_id, customer_id });
  if (!links.success) {
    res.status(400).json({ error: "Invalid enquiry, job or customer id." });
    return;
  }

  let linkedJobId = job_id;
  let linkedCustomerId = customer_id;
  if (enquiry_id) {
    const { data: enquiry, error } = await supabaseAdmin
      .from("enquiries")
      .select("linked_job_id, linked_customer_id")
      .eq("id", enquiry_id)
      .eq("tenant_id", req.tenantId!)
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!enquiry) { res.status(404).json({ error: "Enquiry not found" }); return; }
    linkedJobId = enquiry.linked_job_id || undefined;
    linkedCustomerId = enquiry.linked_customer_id || undefined;
  }
  const ownership = await verifyMultipleTenantOwnership([
    { table: "jobs", id: linkedJobId },
    { table: "customers", id: linkedCustomerId },
  ], req.tenantId);
  if (!ownership.valid) {
    res.status(403).json({ error: "Job or customer does not belong to your company." });
    return;
  }

  const creds = await getSmsWorksCredentials();
  if (!creds) {
    res.status(503).json({ error: "SMS not configured. Contact platform support." });
    return;
  }

  const senderId = (sender_id || "TradeWork").slice(0, 11); // SMS Works max 11 chars

  let messageId: string | null = null;
  let status = "sent";
  let creditsUsed: number | null = null;
  let sendError: string | null = null;

  try {
    const token = await getSmsWorksJwt(creds.key, creds.secret);
    // token is already "JWT eyJ..." — use it directly as the Authorization header value

    const smsRes = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
      },
      body: JSON.stringify({
        sender: senderId,
        destination: destination.replace(/\s/g, ""),
        content: content.trim(),
      }),
    });

    if (!smsRes.ok) {
      const body = await smsRes.text();
      status = "failed";
      sendError = req.invoiceSms ? `SMS provider rejected the message (HTTP ${smsRes.status})` : body || `HTTP ${smsRes.status}`;
    } else {
      const smsBody = await smsRes.json() as { messageid?: string; credits?: number; status?: string; error?: string };
      messageId = smsBody.messageid ?? null;
      creditsUsed = smsBody.credits ?? null;
    }
  } catch (err) {
    status = "failed";
    sendError = err instanceof Error ? err.message : "Send failed";
  }

  let invoiceWarning: string | undefined;
  if (status === "sent" && req.invoiceSms?.needsUpdate) {
    const { data: updated, error: invoiceError } = await supabaseAdmin.from("invoices")
      .update({
        ...(req.invoiceSms.status === "draft" ? { status: "sent" } : {}),
        sent_at: req.invoiceSms.sentAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.invoiceSms.id).eq("tenant_id", req.tenantId!)
      .eq("status", req.invoiceSms.status).eq("updated_at", req.invoiceSms.updatedAt)
      .select("id, type, status, job_id").maybeSingle();
    if (invoiceError || !updated) {
      console.error("[invoice-sms] SMS sent but invoice update failed:", invoiceError?.message || "Invoice changed");
      invoiceWarning = "The SMS was sent, but the invoice changed or could not be updated. The link may not work. Review the invoice before sending again.";
    } else {
      const jobStatus = await syncSentInvoiceJob(supabaseAdmin, req.tenantId!, updated);
      invoiceWarning = jobStatus.job_status_warning;
    }
  }

  // Record in sms_messages regardless of send success
  const { data: record, error: insertError } = await supabaseAdmin
    .from("sms_messages")
    .insert({
      tenant_id: req.tenantId!,
      sent_by_user_id: req.userId!,
      destination: destination.trim(),
      content: req.invoiceSms ? req.invoiceSms.logContent : content.trim(),
      sender_id: senderId,
      sms_works_message_id: messageId,
      status,
      credits_used: creditsUsed,
      job_id: linkedJobId || null,
      customer_id: linkedCustomerId || null,
      ...(enquiry_id ? { enquiry_id } : {}),
    } as Record<string, unknown>)
    .select("id, status, sms_works_message_id")
    .single();

  if ((insertError || !record) && !(req.invoiceSms && status === "sent")) {
    res.status(500).json({ error: status === "failed" ? "SMS failed and could not be recorded." : "Message sent but failed to record" });
    return;
  }
  if (insertError || !record) {
    console.error("[invoice-sms] SMS sent but message log failed:", insertError?.message || "No message record returned");
    invoiceWarning = [invoiceWarning, "The SMS was sent but could not be saved in the message history."].filter(Boolean).join(" ");
  }

  if (status === "failed") {
    if (!record) { res.status(500).json({ error: "SMS failed and could not be recorded." }); return; }
    void notifyUsersForEvent({
      tenantId: req.tenantId!,
      eventType: "system_reliability",
      title: "SMS Delivery Failure",
      body: `Failed to send SMS to ${destination.trim()}.`,
      url: "/admin/company-settings?tab=notifications",
      eventKey: `sms_failed:${record.id}`,
      targetRoles: ["admin"],
      data: { smsRecordId: record.id, reason: sendError ?? "send_failed" },
    }).catch((err) => console.error("[push-events] sms failure alert failed:", err));

    res.status(502).json({ error: sendError ?? "Send failed", record });
    return;
  }

  // Deduct one credit on success
  let smsCredits: Awaited<ReturnType<typeof getAddonCredits>> = null;
  if (req.invoiceSms) {
    try {
      const deducted = await deductAddonCredit(req.tenantId!, "sms_messaging", true);
      if (!deducted) throw new Error("SMS credit could not be deducted");
      smsCredits = await getAddonCredits(req.tenantId!, "sms_messaging", true);
    } catch (error) {
      console.error("[invoice-sms] SMS sent but credit update failed:", error);
      invoiceWarning = [invoiceWarning, "The SMS was sent but the credit balance could not be updated. Contact support."].filter(Boolean).join(" ");
    }
  } else {
    await deductAddonCredit(req.tenantId!, "sms_messaging");
    smsCredits = await getAddonCredits(req.tenantId!, "sms_messaging");
  }
  res.json({
    ok: true,
    message_id: messageId,
    record,
    invoice_warning: invoiceWarning,
    credits_remaining: smsCredits ? smsCredits.credits_remaining : null,
    bundle_size: smsCredits?.bundle_size ?? null,
  });
}

// ──────────────────────────────────────────────────────────────
// GET /api/sms/messages — paginated history for this tenant
// ──────────────────────────────────────────────────────────────
router.get("/sms/messages", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await hasActiveAddon(req.tenantId!, "sms_messaging"))) {
    res.status(402).json({ error: "SMS Messaging add-on required." });
    return;
  }
  const filters = z.object({
    job_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),
    enquiry_id: z.string().uuid().optional(),
  }).safeParse(req.query);
  if (!filters.success) {
    res.status(400).json({ error: "Invalid enquiry, job or customer id." });
    return;
  }
  const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
  const offset = (page - 1) * limit;
  const { job_id: jobId, customer_id: customerId, enquiry_id: enquiryId } = filters.data;

  const ownership = await verifyMultipleTenantOwnership([
    { table: "jobs", id: jobId },
    { table: "customers", id: customerId },
    { table: "enquiries", id: enquiryId },
  ], req.tenantId);
  if (!ownership.valid) {
    res.status(404).json({ error: "Enquiry, job or customer not found." });
    return;
  }

  let linkedEnquiryIds: string[] = [];
  if (jobId) {
    const { data, error } = await supabaseAdmin
      .from("enquiries")
      .select("id")
      .eq("tenant_id", req.tenantId!)
      .eq("linked_job_id", jobId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    linkedEnquiryIds = (data || []).map(enquiry => enquiry.id);
  }

  let query = supabaseAdmin
    .from("sms_messages")
    .select("id, destination, content, sender_id, status, credits_used, sms_works_message_id, job_id, customer_id, created_at, profiles(id, full_name)", { count: "exact" })
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (jobId) {
    query = linkedEnquiryIds.length > 0
      ? query.or(`job_id.eq.${jobId},enquiry_id.in.(${linkedEnquiryIds.join(",")})`)
      : query.eq("job_id", jobId);
  }
  if (customerId) query = query.eq("customer_id", customerId);
  if (enquiryId) query = query.eq("enquiry_id", enquiryId);

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ data, total: count ?? 0, page, limit });
});

// ──────────────────────────────────────────────────────────────
// SMS Templates CRUD
// ──────────────────────────────────────────────────────────────

// GET /api/sms/templates
router.get("/sms/templates", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .select("id, name, content, created_at, updated_at")
    .eq("tenant_id", req.tenantId!)
    .order("name", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// POST /api/sms/templates
router.post("/sms/templates", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, content } = req.body as { name?: string; content?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }

  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .insert({ tenant_id: req.tenantId!, name: name.trim(), content: content.trim(), created_by: req.userId })
    .select("id, name, content, created_at, updated_at")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

// PUT /api/sms/templates/:id
router.put("/sms/templates/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { name, content } = req.body as { name?: string; content?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }

  const { data, error } = await supabaseAdmin
    .from("sms_templates")
    .update({ name: name.trim(), content: content.trim(), updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", id)
    .eq("tenant_id", req.tenantId!)
    .select("id, name, content, created_at, updated_at")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(data);
});

// DELETE /api/sms/templates/:id
router.delete("/sms/templates/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from("sms_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", req.tenantId!);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
