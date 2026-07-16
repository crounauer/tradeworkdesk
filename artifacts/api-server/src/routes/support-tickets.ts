import multer from "multer";
import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { notifySuperAdminsTicketRaised, notifyTenantTicketUpdated } from "../lib/support-ticket-notifications";

const router: IRouter = Router();
const SUPPORT_BUCKET = "support-ticket-attachments";

type SupportTicketRow = {
  id: string;
  tenant_id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
      return;
    }
    cb(null, true);
  },
});

function uploadImages(req: AuthenticatedRequest, res: any, next: any) {
  upload.array("images", 5)(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}

async function storeAttachments(opts: {
  ticketId: string;
  messageId: string;
  tenantId: string;
  files: Express.Multer.File[];
}) {
  const attachments: Array<Record<string, unknown>> = [];
  for (const file of opts.files) {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const storagePath = `${opts.tenantId}/${opts.ticketId}/${opts.messageId}/${safeName}`;

    const { error } = await supabaseAdmin.storage
      .from(SUPPORT_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (error) throw new Error(error.message);

    const { data: urlData } = supabaseAdmin.storage.from(SUPPORT_BUCKET).getPublicUrl(storagePath);
    attachments.push({
      ticket_id: opts.ticketId,
      message_id: opts.messageId,
      tenant_id: opts.tenantId,
      file_name: file.originalname,
      file_url: urlData.publicUrl,
      storage_path: storagePath,
      content_type: file.mimetype,
      file_size: file.size,
    });
  }

  if (attachments.length > 0) {
    const { error } = await supabaseAdmin.from("support_ticket_attachments").insert(attachments);
    if (error) throw new Error(error.message);
  }
}

async function getTicketDetail(ticketId: string, tenantId?: string) {
  let ticketQuery = supabaseAdmin
    .from("support_tickets")
    .select("id, tenant_id, requester_name, requester_email, requester_phone, subject, category, priority, status, created_at, updated_at, tenants(company_name, contact_email, contact_phone), created_by_user_id")
    .eq("id", ticketId);
  if (tenantId) ticketQuery = ticketQuery.eq("tenant_id", tenantId);

  const { data: ticket, error: ticketError } = await ticketQuery.single();
  if (ticketError || !ticket) throw new Error(ticketError?.message || "Ticket not found");

  const [{ data: messages }, { data: attachments }] = await Promise.all([
    supabaseAdmin
      .from("support_ticket_messages")
      .select("id, ticket_id, author_name, author_email, author_role, body, status_after, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("support_ticket_attachments")
      .select("id, ticket_id, message_id, file_name, file_url, content_type, file_size, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
  ]);

  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const attachment of attachments || []) {
    const key = String((attachment as { message_id?: string | null }).message_id || "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(attachment as Record<string, unknown>);
  }

  return {
    ...(ticket as Record<string, unknown>),
    messages: (messages || []).map((message) => ({
      ...message,
      attachments: grouped.get(String((message as { id: string }).id)) || [],
    })),
  };
}

router.get("/support/tickets", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("id, subject, category, priority, status, created_at, updated_at")
    .eq("tenant_id", req.tenantId!)
    .order("updated_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data || []);
});

router.get("/support/tickets/:ticketId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const ticketId = String(req.params.ticketId || "");
    const detail = await getTicketDetail(ticketId, req.tenantId!);
    res.json(detail);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Ticket not found" });
  }
});

router.post("/support/tickets", requireAuth, requireTenant, uploadImages, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { subject, category = "support_issue", priority = "normal", body } = req.body as Record<string, string>;
  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: "subject and body are required" });
    return;
  }

  const files = (req.files as Express.Multer.File[] | undefined) || [];
  const [{ data: profile }, { data: tenantSettings }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", req.userId!)
      .maybeSingle(),
    supabaseAdmin
      .from("tenants")
      .select("company_name, contact_email, contact_phone")
      .eq("id", req.tenantId!)
      .single(),
  ]);

  const requesterName = (profile as { full_name?: string | null } | null)?.full_name || req.userEmail || "Tenant User";
  const requesterPhone = (profile as { phone?: string | null } | null)?.phone || null;

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      tenant_id: req.tenantId!,
      created_by_user_id: req.userId!,
      requester_name: requesterName,
      requester_email: req.userEmail,
      requester_phone: requesterPhone,
      subject: subject.trim(),
      category,
      priority,
      status: "open",
    })
    .select()
    .single();

  if (ticketError || !ticket) {
    res.status(500).json({ error: ticketError?.message || "Failed to create ticket" });
    return;
  }

  const { data: message, error: messageError } = await supabaseAdmin
    .from("support_ticket_messages")
    .insert({
      ticket_id: (ticket as SupportTicketRow).id,
      tenant_id: req.tenantId!,
      author_user_id: req.userId!,
      author_name: requesterName,
      author_email: req.userEmail,
      author_role: "tenant",
      body: body.trim(),
      status_after: "open",
    })
    .select()
    .single();

  if (messageError || !message) {
    res.status(500).json({ error: messageError?.message || "Failed to create ticket message" });
    return;
  }

  try {
    await storeAttachments({
      ticketId: (ticket as SupportTicketRow).id,
      messageId: (message as { id: string }).id,
      tenantId: req.tenantId!,
      files,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload attachments" });
    return;
  }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: "support_ticket_created",
    entity_type: "tenant",
    entity_id: req.tenantId,
    detail: { ticket_id: (ticket as SupportTicketRow).id, category, priority },
  });

  void notifySuperAdminsTicketRaised({
    ticketId: (ticket as SupportTicketRow).id,
    tenantId: req.tenantId!,
    companyName: (tenantSettings as { company_name?: string | null } | null)?.company_name ?? null,
    subject: subject.trim(),
    category,
    priority,
    requesterName,
    requesterEmail: req.userEmail ?? null,
  });

  res.status(201).json(await getTicketDetail((ticket as SupportTicketRow).id, req.tenantId!));
});

router.post("/support/tickets/:ticketId/messages", requireAuth, requireTenant, uploadImages, async (req: AuthenticatedRequest, res): Promise<void> => {
  const ticketId = String(req.params.ticketId || "");
  const { body } = req.body as Record<string, string>;
  if (!body?.trim()) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const { data: ticket } = await supabaseAdmin
    .from("support_tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const { data: message, error } = await supabaseAdmin
    .from("support_ticket_messages")
    .insert({
      ticket_id: ticketId,
      tenant_id: req.tenantId!,
      author_user_id: req.userId!,
      author_name: req.userEmail || "Tenant User",
      author_email: req.userEmail,
      author_role: "tenant",
      body: body.trim(),
    })
    .select()
    .single();
  if (error || !message) {
    res.status(500).json({ error: error?.message || "Failed to add message" });
    return;
  }

  await supabaseAdmin.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  try {
    await storeAttachments({
      ticketId,
      messageId: (message as { id: string }).id,
      tenantId: req.tenantId!,
      files: (req.files as Express.Multer.File[] | undefined) || [],
    });
  } catch (attachmentError) {
    res.status(500).json({ error: attachmentError instanceof Error ? attachmentError.message : "Failed to upload attachments" });
    return;
  }

  res.status(201).json(await getTicketDetail(ticketId, req.tenantId!));
});

router.get("/platform/support-tickets", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  let query = supabaseAdmin
    .from("support_tickets")
    .select("id, tenant_id, subject, category, priority, status, requester_name, requester_email, created_at, updated_at, tenants(company_name)")
    .order("updated_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data || []);
});

router.get("/platform/support-tickets/:ticketId", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const ticketId = String(req.params.ticketId || "");
    const detail = await getTicketDetail(ticketId);
    res.json(detail);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Ticket not found" });
  }
});

router.post("/platform/support-tickets/:ticketId/messages", requireAuth, requireSuperAdmin, uploadImages, async (req: AuthenticatedRequest, res): Promise<void> => {
  const ticketId = String(req.params.ticketId || "");
  const { body = "", status } = req.body as Record<string, string>;
  if (!body.trim() && !status) {
    res.status(400).json({ error: "body or status is required" });
    return;
  }

  const { data: ticket } = await supabaseAdmin
    .from("support_tickets")
    .select("id, tenant_id, subject, status, requester_name, requester_email, requester_phone")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const [{ data: tenantContext }, { data: companySettings }] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select("company_name, contact_email, contact_phone")
      .eq("id", (ticket as { tenant_id: string }).tenant_id)
      .single(),
    supabaseAdmin
      .from("company_settings")
      .select("notification_emails")
      .eq("tenant_id", (ticket as { tenant_id: string }).tenant_id)
      .eq("singleton_id", "default")
      .maybeSingle(),
  ]);

  const nextStatus = status?.trim() || (ticket as { status: string }).status;
  const { data: message, error } = await supabaseAdmin
    .from("support_ticket_messages")
    .insert({
      ticket_id: ticketId,
      tenant_id: (ticket as { tenant_id: string }).tenant_id,
      author_user_id: req.userId!,
      author_name: req.userEmail || "Super Admin",
      author_email: req.userEmail,
      author_role: "super_admin",
      body: body.trim() || `Status updated to ${nextStatus.replace(/_/g, " ")}`,
      status_after: nextStatus,
    })
    .select()
    .single();
  if (error || !message) {
    res.status(500).json({ error: error?.message || "Failed to add message" });
    return;
  }

  await supabaseAdmin
    .from("support_tickets")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  try {
    await storeAttachments({
      ticketId,
      messageId: (message as { id: string }).id,
      tenantId: (ticket as { tenant_id: string }).tenant_id,
      files: (req.files as Express.Multer.File[] | undefined) || [],
    });
  } catch (attachmentError) {
    res.status(500).json({ error: attachmentError instanceof Error ? attachmentError.message : "Failed to upload attachments" });
    return;
  }

  const typedTicket = ticket as Record<string, unknown> & {
    subject: string;
    requester_name: string | null;
    requester_email: string | null;
    requester_phone: string | null;
  };

  void notifyTenantTicketUpdated({
    ticketId,
    ticketSubject: typedTicket.subject,
    company: {
      companyName: (tenantContext as { company_name?: string | null } | null)?.company_name ?? null,
      contactEmail: (tenantContext as { contact_email?: string | null } | null)?.contact_email ?? null,
      contactPhone: (tenantContext as { contact_phone?: string | null } | null)?.contact_phone ?? null,
      notificationEmails: (companySettings as { notification_emails?: string[] | null } | null)?.notification_emails ?? null,
    },
    requester: {
      name: typedTicket.requester_name,
      email: typedTicket.requester_email,
      phone: typedTicket.requester_phone,
    },
    status: nextStatus,
    actorName: req.userEmail ?? "TradeWorkDesk Support",
    messageBody: body.trim() || null,
  });

  res.status(201).json(await getTicketDetail(ticketId));
});

export default router;