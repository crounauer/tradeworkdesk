import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateHeatPumpCommissioningRecordBody,
  GetHeatPumpCommissioningRecordParams,
  GetHeatPumpCommissioningRecordResponse,
  UpdateHeatPumpCommissioningRecordParams,
  UpdateHeatPumpCommissioningRecordBody,
  UpdateHeatPumpCommissioningRecordResponse,
  GetHeatPumpCommissioningRecordByJobParams,
  GetHeatPumpCommissioningRecordByJobResponse,
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

router.get("/heat-pump-commissioning-records", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  let query = supabaseAdmin.from("heat_pump_commissioning_records").select("*").order("created_at", { ascending: false });

  if (req.userRole === "technician") {
    const { data: techJobs } = await supabaseAdmin
      .from("jobs").select("id").eq("assigned_technician_id", req.userId!);
    const jobIds = (techJobs || []).map((j: { id: string }) => j.id);
    if (jobIds.length === 0) { res.json([]); return; }
    query = query.in("job_id", jobIds);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/heat-pump-commissioning-records", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateHeatPumpCommissioningRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("heat_pump_commissioning_records").insert(parsed.data).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json(GetHeatPumpCommissioningRecordResponse.parse(data));
});

router.get("/heat-pump-commissioning-records/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpCommissioningRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("heat_pump_commissioning_records").select("*").eq("id", params.data.id).single();
  if (error || !data) { res.status(404).json({ error: "Heat pump commissioning record not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetHeatPumpCommissioningRecordResponse.parse(data));
});

router.put("/heat-pump-commissioning-records/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateHeatPumpCommissioningRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateHeatPumpCommissioningRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data: existing } = await supabaseAdmin.from("heat_pump_commissioning_records").select("job_id").eq("id", params.data.id).single();
  if (!existing) { res.status(404).json({ error: "Heat pump commissioning record not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("heat_pump_commissioning_records").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Heat pump commissioning record not found" }); return; }
  res.json(UpdateHeatPumpCommissioningRecordResponse.parse(data));
});

router.get("/jobs/:jobId/heat-pump-commissioning-record", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpCommissioningRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("heat_pump_commissioning_records").select("*").eq("job_id", params.data.jobId).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No heat pump commissioning record for this job" }); return; }
  res.json(GetHeatPumpCommissioningRecordByJobResponse.parse(data));
});

export default router;
