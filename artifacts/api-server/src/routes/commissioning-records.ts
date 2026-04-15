import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateCommissioningRecordBody,
  GetCommissioningRecordParams,
  GetCommissioningRecordResponse,
  UpdateCommissioningRecordParams,
  UpdateCommissioningRecordBody,
  UpdateCommissioningRecordResponse,
  GetCommissioningRecordByJobParams,
  GetCommissioningRecordByJobResponse,
} from "@workspace/api-zod";
import { verifyJobAccess } from "../lib/verify-job-access";

const router: IRouter = Router();


router.get("/commissioning-records", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let query = supabaseAdmin.from("commissioning_records").select("*").order("created_at", { ascending: false });

  if (req.tenantId) query = query.eq("tenant_id", req.tenantId);

  if (req.userRole === "technician") {
    let jobQ = supabaseAdmin.from("jobs").select("id").eq("assigned_technician_id", req.userId!);
    if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
    const { data: techJobs } = await jobQ;
    const jobIds = (techJobs || []).map((j: { id: string }) => j.id);
    if (jobIds.length === 0) { res.json([]); return; }
    query = query.in("job_id", jobIds);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/commissioning-records", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCommissioningRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("commissioning_records").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json(GetCommissioningRecordResponse.parse(data));
});

router.get("/commissioning-records/:id", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCommissioningRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let getQ = supabaseAdmin.from("commissioning_records").select("*").eq("id", params.data.id);
  if (req.tenantId) getQ = getQ.eq("tenant_id", req.tenantId);
  const { data, error } = await getQ.single();
  if (error || !data) { res.status(404).json({ error: "Commissioning record not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetCommissioningRecordResponse.parse(data));
});

router.put("/commissioning-records/:id", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateCommissioningRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateCommissioningRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let existQ = supabaseAdmin.from("commissioning_records").select("job_id").eq("id", params.data.id);
  if (req.tenantId) existQ = existQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existQ.single();
  if (!existing) { res.status(404).json({ error: "Commissioning record not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("commissioning_records").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Commissioning record not found" }); return; }
  res.json(UpdateCommissioningRecordResponse.parse(data));
});

router.get("/jobs/:jobId/commissioning-record", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCommissioningRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let jobQ2 = supabaseAdmin.from("commissioning_records").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) jobQ2 = jobQ2.eq("tenant_id", req.tenantId);
  const { data, error } = await jobQ2.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.json(null); return; }
  res.json(GetCommissioningRecordByJobResponse.parse(data));
});

router.delete("/commissioning-records/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = req.params.id;
  let q = supabaseAdmin.from("commissioning_records").select("job_id").eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: existing } = await q.single();
  if (!existing) { res.status(404).json({ error: "Commissioning record not found" }); return; }
  const { error } = await supabaseAdmin.from("commissioning_records").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
