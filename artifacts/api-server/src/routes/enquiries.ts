import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { verifyMultipleTenantOwnership } from "../lib/tenant-validation";

const router: IRouter = Router();

router.get("/enquiries", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { status, source, search } = req.query;

  let q = supabaseAdmin
    .from("enquiries")
    .select("*, created_by_profile:profiles!enquiries_created_by_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  if (status && typeof status === "string") q = q.eq("status", status);
  if (source && typeof source === "string") q = q.eq("source", source);
  if (search && typeof search === "string") {
    const s = `%${search}%`;
    q = q.or(`contact_name.ilike.${s},contact_phone.ilike.${s},contact_email.ilike.${s},description.ilike.${s},notes.ilike.${s},address.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/enquiries", requireAuth, requireTenant, requirePlanFeature("job_management"), requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { contact_name, contact_phone, contact_email, source, description, notes, address, priority } = req.body;

  if (!contact_name || typeof contact_name !== "string" || !contact_name.trim()) {
    res.status(400).json({ error: "contact_name is required" }); return;
  }

  const validSources = ["phone", "email", "text", "facebook", "whatsapp", "messenger", "website", "referral", "other"];
  const validPriorities = ["low", "medium", "high", "urgent"];

  const { data, error } = await supabaseAdmin
    .from("enquiries")
    .insert({
      tenant_id: req.tenantId,
      contact_name: contact_name.trim(),
      contact_phone: contact_phone?.trim() || null,
      contact_email: contact_email?.trim() || null,
      source: validSources.includes(source) ? source : "phone",
      description: description?.trim() || null,
      notes: notes?.trim() || null,
      address: address?.trim() || null,
      priority: validPriorities.includes(priority) ? priority : "medium",
      status: "new",
      created_by: req.userId,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.get("/enquiries/:id", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin
    .from("enquiries")
    .select("*, created_by_profile:profiles!enquiries_created_by_fkey(full_name), customer:customers!enquiries_linked_customer_id_fkey(id, first_name, last_name), job:jobs!enquiries_linked_job_id_fkey(id, status, job_type)")
    .eq("id", id);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.single();
  if (error || !data) { res.status(404).json({ error: "Enquiry not found" }); return; }
  res.json(data);
});

router.patch("/enquiries/:id", requireAuth, requireTenant, requirePlanFeature("job_management"), requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { contact_name, contact_phone, contact_email, source, description, notes, address, status, priority } = req.body;

  const validStatuses = ["new", "contacted", "quoted", "converted", "lost"];
  const validSources = ["phone", "email", "text", "facebook", "whatsapp", "messenger", "website", "referral", "other"];
  const validPriorities = ["low", "medium", "high", "urgent"];

  const updates: Record<string, unknown> = {};
  if (contact_name !== undefined) updates.contact_name = contact_name.trim();
  if (contact_phone !== undefined) updates.contact_phone = contact_phone?.trim() || null;
  if (contact_email !== undefined) updates.contact_email = contact_email?.trim() || null;
  if (source !== undefined && validSources.includes(source)) updates.source = source;
  if (description !== undefined) updates.description = description?.trim() || null;
  if (notes !== undefined) updates.notes = notes?.trim() || null;
  if (address !== undefined) updates.address = address?.trim() || null;
  if (status !== undefined && validStatuses.includes(status)) updates.status = status;
  if (priority !== undefined && validPriorities.includes(priority)) updates.priority = priority;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" }); return;
  }

  let q = supabaseAdmin.from("enquiries").update(updates).eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error || !data) { res.status(404).json({ error: "Enquiry not found" }); return; }
  res.json(data);
});

router.delete("/enquiries/:id", requireAuth, requireTenant, requirePlanFeature("job_management"), requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin.from("enquiries").delete().eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  await q;
  res.sendStatus(204);
});

router.get("/enquiries/:id/notes", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin
    .from("enquiry_notes")
    .select("*, author:profiles!enquiry_notes_author_id_fkey(full_name)")
    .eq("enquiry_id", id)
    .order("created_at", { ascending: true });

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/enquiries/:id/notes", requireAuth, requireTenant, requirePlanFeature("job_management"), requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" }); return;
  }

  let enqCheck = supabaseAdmin.from("enquiries").select("id").eq("id", id);
  if (req.tenantId) enqCheck = enqCheck.eq("tenant_id", req.tenantId);
  const { data: enqExists } = await enqCheck.single();
  if (!enqExists) { res.status(404).json({ error: "Enquiry not found" }); return; }

  const { data, error } = await supabaseAdmin
    .from("enquiry_notes")
    .insert({
      enquiry_id: id,
      tenant_id: req.tenantId,
      author_id: req.userId,
      content: content.trim(),
    })
    .select("*, author:profiles!enquiry_notes_author_id_fkey(full_name)")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.post("/enquiries/:id/convert", requireAuth, requireTenant, requirePlanFeature("job_management"), requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { customer_id, new_customer, property_id, new_property, job_type, job_type_id, priority, scheduled_date, scheduled_time, description } = req.body;

  let enqQ = supabaseAdmin.from("enquiries").select("*").eq("id", id);
  if (req.tenantId) enqQ = enqQ.eq("tenant_id", req.tenantId);
  const { data: enquiry, error: enqErr } = await enqQ.single();
  if (enqErr || !enquiry) { res.status(404).json({ error: "Enquiry not found" }); return; }
  if (enquiry.status === "converted") { res.status(400).json({ error: "Enquiry already converted" }); return; }

  const ownershipChecks: { table: string; id: string }[] = [];
  if (customer_id) ownershipChecks.push({ table: "customers", id: customer_id });
  if (property_id) ownershipChecks.push({ table: "properties", id: property_id });
  if (job_type_id) ownershipChecks.push({ table: "job_types", id: String(job_type_id) });

  if (ownershipChecks.length > 0) {
    const ownershipCheck = await verifyMultipleTenantOwnership(ownershipChecks, req.tenantId);
    if (!ownershipCheck.valid) {
      res.status(403).json({ error: `Invalid reference: ${ownershipCheck.failedTable} does not belong to your organisation` }); return;
    }
  }

  if (!customer_id && !new_customer) {
    res.status(400).json({ error: "Customer is required (provide customer_id or new_customer)" }); return;
  }
  if (!property_id && !new_property) {
    res.status(400).json({ error: "Property is required (provide property_id or new_property)" }); return;
  }

  const createdIds: { customer?: string; property?: string; job?: string } = {};

  try {
    let finalCustomerId = customer_id;
    if (new_customer && !customer_id) {
      const { first_name, last_name, phone, email } = new_customer;
      if (!first_name || !last_name) {
        res.status(400).json({ error: "Customer first_name and last_name required" }); return;
      }
      const { data: cust, error: custErr } = await supabaseAdmin
        .from("customers")
        .insert({ first_name, last_name, phone: phone || null, email: email || null, tenant_id: req.tenantId })
        .select()
        .single();
      if (custErr) throw new Error(`Customer creation failed: ${custErr.message}`);
      finalCustomerId = cust.id;
      createdIds.customer = cust.id;
    }

    let finalPropertyId = property_id;
    if (new_property && !property_id) {
      const { address_line1, city, postcode } = new_property;
      if (!address_line1 || !postcode) {
        res.status(400).json({ error: "Property address_line1 and postcode required" }); return;
      }
      const { data: prop, error: propErr } = await supabaseAdmin
        .from("properties")
        .insert({ customer_id: finalCustomerId, address_line1, city: city || null, postcode, tenant_id: req.tenantId })
        .select()
        .single();
      if (propErr) throw new Error(`Property creation failed: ${propErr.message}`);
      finalPropertyId = prop.id;
      createdIds.property = prop.id;
    }

    if (!finalCustomerId || !finalPropertyId) {
      res.status(400).json({ error: "Customer and property are required" }); return;
    }

    const validJobTypes = ["service", "breakdown", "installation", "inspection", "follow_up"];
    const validPriorities = ["low", "medium", "high", "urgent"];

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .insert({
        customer_id: finalCustomerId,
        property_id: finalPropertyId,
        job_type: validJobTypes.includes(job_type) ? job_type : "service",
        job_type_id: job_type_id || null,
        priority: validPriorities.includes(priority) ? priority : enquiry.priority || "medium",
        scheduled_date: scheduled_date || new Date().toISOString().split("T")[0],
        scheduled_time: scheduled_time || null,
        description: description || enquiry.description || null,
        status: "scheduled",
        tenant_id: req.tenantId,
      })
      .select()
      .single();

    if (jobErr) throw new Error(`Job creation failed: ${jobErr.message}`);
    createdIds.job = job.id;

    const { error: updateErr, count: updateCount } = await supabaseAdmin
      .from("enquiries")
      .update({ status: "converted", linked_customer_id: finalCustomerId, linked_job_id: job.id })
      .eq("id", id)
      .eq("tenant_id", req.tenantId);

    if (updateErr || updateCount === 0) {
      throw new Error("Failed to mark enquiry as converted");
    }

    res.status(201).json({ enquiry_id: id, job_id: job.id, customer_id: finalCustomerId, property_id: finalPropertyId });
  } catch (err) {
    if (createdIds.job) await supabaseAdmin.from("jobs").delete().eq("id", createdIds.job);
    if (createdIds.property) await supabaseAdmin.from("properties").delete().eq("id", createdIds.property);
    if (createdIds.customer) await supabaseAdmin.from("customers").delete().eq("id", createdIds.customer);
    res.status(500).json({ error: err instanceof Error ? err.message : "Conversion failed" }); return;
  }
});

router.get("/enquiries-count", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin
    .from("enquiries")
    .select("id", { count: "exact", head: true })
    .in("status", ["new", "contacted", "quoted"]);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { count, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ count: count || 0 });
});

export default router;
