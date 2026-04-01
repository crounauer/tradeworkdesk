import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateHeatPumpCommissioningRecordBody,
  UpdateHeatPumpCommissioningRecordBody,
  GetHeatPumpCommissioningRecordResponse,
  GetHeatPumpCommissioningRecordByJobParams,
  GetHeatPumpCommissioningRecordByJobResponse,
  UpdateHeatPumpCommissioningRecordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function verifyJobAccess(req: AuthenticatedRequest, jobId: string): Promise<{ allowed: boolean; error?: string }> {
  let q = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: job } = await q.single();
  if (!job) return { allowed: false, error: "Job not found" };
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    return { allowed: false, error: "You can only modify records for jobs assigned to you" };
  }
  return { allowed: true };
}

router.get("/jobs/:jobId/heat-pump-commissioning", requireAuth, requireTenant, requirePlanFeature("heat_pump_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpCommissioningRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let recQ = supabaseAdmin.from("heat_pump_commissioning_records").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) recQ = recQ.eq("tenant_id", req.tenantId);
  const { data, error } = await recQ.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.json(null); return; }
  res.json(GetHeatPumpCommissioningRecordByJobResponse.parse(data));
});

router.post("/jobs/:jobId/heat-pump-commissioning", requireAuth, requireTenant, requirePlanFeature("heat_pump_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpCommissioningRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const parsed = CreateHeatPumpCommissioningRecordBody.safeParse({
    ...req.body,
    job_id: params.data.jobId,
    technician_id: req.body.technician_id || req.userId,
  });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("heat_pump_commissioning_records").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetHeatPumpCommissioningRecordResponse.parse(data));
});

router.patch("/jobs/:jobId/heat-pump-commissioning", requireAuth, requireTenant, requirePlanFeature("heat_pump_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpCommissioningRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const body = UpdateHeatPumpCommissioningRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let existQ = supabaseAdmin.from("heat_pump_commissioning_records").select("id").eq("job_id", params.data.jobId);
  if (req.tenantId) existQ = existQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existQ.maybeSingle();
  if (!existing) { res.status(404).json({ error: "No heat pump commissioning record for this job" }); return; }

  const { data, error } = await supabaseAdmin
    .from("heat_pump_commissioning_records").update(body.data).eq("id", existing.id).select().single();
  if (error || !data) { res.status(500).json({ error: error?.message || "Update failed" }); return; }
  res.json(UpdateHeatPumpCommissioningRecordResponse.parse(data));
});

export default router;
