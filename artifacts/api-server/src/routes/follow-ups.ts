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
    .in("status", ["awaiting_parts", "parts_arrived"])
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

router.delete("/follow-ups/:id", requireAuth, requireTenant, requireRole("admin", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin.from("follow_ups").delete().eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
