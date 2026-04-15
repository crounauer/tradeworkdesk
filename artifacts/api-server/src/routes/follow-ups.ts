import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/follow-ups", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const page = parseInt(req.query.page as string) || 1;
  const offset = (page - 1) * limit;

  let q = supabaseAdmin
    .from("follow_ups")
    .select("*, customers(first_name, last_name), properties(address_line1, postcode), original_job:jobs!follow_ups_original_job_id_fkey(id, job_ref, status, job_type), creator:profiles!follow_ups_created_by_fkey(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  if (status && ["awaiting_parts", "parts_arrived", "booked", "cancelled"].includes(status)) {
    q = q.eq("status", status);
  }

  const { data, error, count } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((f: Record<string, unknown>) => {
    const cust = f.customers as { first_name: string; last_name: string } | null;
    const prop = f.properties as { address_line1: string; postcode?: string } | null;
    const origJob = f.original_job as { id: string; job_ref?: string; status: string; job_type: string } | null;
    const creator = f.creator as { full_name: string } | null;
    return {
      ...f,
      customer_name: cust ? `${cust.first_name} ${cust.last_name}` : null,
      property_address: prop?.address_line1 || null,
      property_postcode: prop?.postcode || null,
      original_job_ref: origJob?.job_ref || null,
      original_job_status: origJob?.status || null,
      original_job_type: origJob?.job_type || null,
      creator_name: creator?.full_name || null,
      customers: undefined,
      properties: undefined,
      original_job: undefined,
      creator: undefined,
    };
  });

  res.json({
    follow_ups: mapped,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  });
});

router.get("/follow-ups/overdue-count", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  let q = supabaseAdmin
    .from("follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("status", "awaiting_parts")
    .lt("expected_parts_date", today);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { count, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ count: count || 0 });
});

router.get("/follow-ups/:id", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  let q = supabaseAdmin
    .from("follow_ups")
    .select("*, customers(first_name, last_name, phone, email), properties(address_line1, postcode), original_job:jobs!follow_ups_original_job_id_fkey(id, job_ref, status, job_type, description), creator:profiles!follow_ups_created_by_fkey(full_name)")
    .eq("id", id);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q.single();
  if (error || !data) { res.status(404).json({ error: "Follow-up not found" }); return; }
  res.json(data);
});

router.post("/follow-ups", requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { original_job_id, work_description, parts_description, expected_parts_date, notes } = req.body;

  if (!original_job_id) {
    res.status(400).json({ error: "original_job_id is required" }); return;
  }

  let jobQ = supabaseAdmin.from("jobs").select("id, customer_id, property_id, tenant_id").eq("id", original_job_id);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error: jobErr } = await jobQ.single();

  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  const insertPayload: Record<string, unknown> = {
    tenant_id: req.tenantId || job.tenant_id,
    original_job_id: job.id,
    customer_id: job.customer_id,
    property_id: job.property_id,
    work_description: work_description || null,
    parts_description: parts_description || null,
    expected_parts_date: expected_parts_date || null,
    notes: notes || null,
    status: "awaiting_parts",
    created_by: req.userId,
  };

  const { data, error } = await supabaseAdmin.from("follow_ups").insert(insertPayload).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/follow-ups/:id", requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { status, work_description, parts_description, expected_parts_date, notes, new_job_id } = req.body;

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status && ["awaiting_parts", "parts_arrived", "booked", "cancelled"].includes(status)) updatePayload.status = status;
  if (work_description !== undefined) updatePayload.work_description = work_description || null;
  if (parts_description !== undefined) updatePayload.parts_description = parts_description || null;
  if (expected_parts_date !== undefined) updatePayload.expected_parts_date = expected_parts_date || null;
  if (notes !== undefined) updatePayload.notes = notes || null;
  if (new_job_id !== undefined) updatePayload.new_job_id = new_job_id || null;

  let q = supabaseAdmin.from("follow_ups").update(updatePayload).eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q.select().single();
  if (error) { res.status(error.code === "PGRST116" ? 404 : 500).json({ error: error.message }); return; }
  res.json(data);
});

router.post("/follow-ups/:id/convert-to-job", requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { scheduled_date, scheduled_time, assigned_technician_id } = req.body;

  let fuQ = supabaseAdmin.from("follow_ups").select("*, original_job:jobs!follow_ups_original_job_id_fkey(id, job_ref)").eq("id", id);
  if (req.tenantId) fuQ = fuQ.eq("tenant_id", req.tenantId);
  const { data: followUp, error: fuErr } = await fuQ.single();

  if (fuErr || !followUp) { res.status(404).json({ error: "Follow-up not found" }); return; }
  if (followUp.status === "booked" || followUp.status === "cancelled") {
    res.status(400).json({ error: `Follow-up is already ${followUp.status}` }); return;
  }

  const tenantId = req.tenantId || followUp.tenant_id;
  const origJob = followUp.original_job as { id: string; job_ref?: string } | null;
  const origRef = origJob?.job_ref || followUp.original_job_id;

  let generatedJobRef: string | undefined;
  const { data: cs } = await supabaseAdmin
    .from("company_settings")
    .select("job_number_prefix, job_number_next")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();
  const prefix = (cs?.job_number_prefix ?? "").trim().toUpperCase();
  const nextNum = cs?.job_number_next ?? 1;
  generatedJobRef = prefix
    ? `${prefix}${String(nextNum).padStart(4, "0")}`
    : `JOB-${String(nextNum).padStart(4, "0")}`;
  await supabaseAdmin
    .from("company_settings")
    .update({ job_number_next: nextNum + 1 })
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default");

  const descriptionParts = [
    `Follow-up from ${origRef} (original job ID: ${followUp.original_job_id})`,
    followUp.work_description ? `Work: ${followUp.work_description}` : null,
    followUp.parts_description ? `Parts: ${followUp.parts_description}` : null,
    followUp.notes ? `Notes: ${followUp.notes}` : null,
  ].filter(Boolean).join("\n");

  const jobInsert: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_id: followUp.customer_id,
    property_id: followUp.property_id,
    job_type: "follow_up",
    status: "scheduled",
    priority: "medium",
    scheduled_date: scheduled_date || new Date().toISOString().split("T")[0],
    scheduled_time: scheduled_time || null,
    assigned_technician_id: assigned_technician_id || null,
    description: descriptionParts,
    job_ref: generatedJobRef,
  };

  const { data: newJob, error: jobErr } = await supabaseAdmin.from("jobs").insert(jobInsert).select("id, job_ref").single();
  if (jobErr) { res.status(500).json({ error: jobErr.message }); return; }

  let updateQ = supabaseAdmin.from("follow_ups").update({
    status: "booked",
    new_job_id: newJob.id,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (req.tenantId) updateQ = updateQ.eq("tenant_id", req.tenantId);
  const { error: updateErr } = await updateQ;
  if (updateErr) {
    await supabaseAdmin.from("jobs").delete().eq("id", newJob.id);
    res.status(500).json({ error: "Failed to link follow-up to new job" }); return;
  }

  res.status(201).json({ follow_up_id: id, job_id: newJob.id, job_ref: newJob.job_ref });
});

router.delete("/follow-ups/:id", requireAuth, requireTenant, requireRole("admin", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin.from("follow_ups").delete().eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
