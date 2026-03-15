import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateHeatPumpServiceRecordBody,
  UpdateHeatPumpServiceRecordBody,
  GetHeatPumpServiceRecordResponse,
  GetHeatPumpServiceRecordByJobParams,
  GetHeatPumpServiceRecordByJobResponse,
  UpdateHeatPumpServiceRecordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function verifyJobAccess(req: AuthenticatedRequest, jobId: string): Promise<{ allowed: boolean; error?: string }> {
  const { data: job } = await supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId).single();
  if (!job) return { allowed: false, error: "Job not found" };
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    return { allowed: false, error: "You can only modify records for jobs assigned to you" };
  }
  return { allowed: true };
}

// GET /jobs/:jobId/heat-pump-service — fetch existing record for this job
router.get("/jobs/:jobId/heat-pump-service", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpServiceRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("heat_pump_service_records").select("*").eq("job_id", params.data.jobId).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No heat pump service record for this job" }); return; }
  res.json(GetHeatPumpServiceRecordByJobResponse.parse(data));
});

// POST /jobs/:jobId/heat-pump-service — create record for this job
router.post("/jobs/:jobId/heat-pump-service", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpServiceRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const parsed = CreateHeatPumpServiceRecordBody.safeParse({
    ...req.body,
    job_id: params.data.jobId,
    technician_id: req.body.technician_id || req.userId,
  });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("heat_pump_service_records").insert(parsed.data).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetHeatPumpServiceRecordResponse.parse(data));
});

// PATCH /jobs/:jobId/heat-pump-service — update existing record for this job
router.patch("/jobs/:jobId/heat-pump-service", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpServiceRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const body = UpdateHeatPumpServiceRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data: existing } = await supabaseAdmin
    .from("heat_pump_service_records").select("id").eq("job_id", params.data.jobId).maybeSingle();
  if (!existing) { res.status(404).json({ error: "No heat pump service record for this job" }); return; }

  const { data, error } = await supabaseAdmin
    .from("heat_pump_service_records").update(body.data).eq("id", existing.id).select().single();
  if (error || !data) { res.status(500).json({ error: error?.message || "Update failed" }); return; }
  res.json(UpdateHeatPumpServiceRecordResponse.parse(data));
});

export default router;
