import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
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

const router: IRouter = Router();

async function verifyJobAccess(req: AuthenticatedRequest, jobId: string): Promise<{ allowed: boolean; error?: string }> {
  const { data: job } = await supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId).single();
  if (!job) return { allowed: false, error: "Job not found" };
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    return { allowed: false, error: "You can only modify commissioning records for jobs assigned to you" };
  }
  return { allowed: true };
}

router.get("/commissioning-records", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  let query = supabaseAdmin.from("commissioning_records").select("*").order("created_at", { ascending: false });

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

router.post("/commissioning-records", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCommissioningRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("commissioning_records").insert(parsed.data).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json(GetCommissioningRecordResponse.parse(data));
});

router.get("/commissioning-records/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCommissioningRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("commissioning_records").select("*").eq("id", params.data.id).single();
  if (error || !data) { res.status(404).json({ error: "Commissioning record not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetCommissioningRecordResponse.parse(data));
});

router.put("/commissioning-records/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateCommissioningRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateCommissioningRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data: existing } = await supabaseAdmin.from("commissioning_records").select("job_id").eq("id", params.data.id).single();
  if (!existing) { res.status(404).json({ error: "Commissioning record not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("commissioning_records").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Commissioning record not found" }); return; }
  res.json(UpdateCommissioningRecordResponse.parse(data));
});

router.get("/jobs/:jobId/commissioning-record", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCommissioningRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("commissioning_records").select("*").eq("job_id", params.data.jobId).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No commissioning record for this job" }); return; }
  res.json(GetCommissioningRecordByJobResponse.parse(data));
});

export default router;
