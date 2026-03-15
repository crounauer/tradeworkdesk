import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateOilLineVacuumTestBody,
  GetOilLineVacuumTestParams,
  GetOilLineVacuumTestResponse,
  UpdateOilLineVacuumTestParams,
  UpdateOilLineVacuumTestBody,
  UpdateOilLineVacuumTestResponse,
  GetOilLineVacuumTestByJobParams,
  GetOilLineVacuumTestByJobResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function verifyJobAccess(req: AuthenticatedRequest, jobId: string): Promise<{ allowed: boolean; error?: string }> {
  const { data: job } = await supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId).single();
  if (!job) return { allowed: false, error: "Job not found" };
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    return { allowed: false, error: "You can only access records for jobs assigned to you" };
  }
  return { allowed: true };
}

router.post("/oil-line-vacuum-tests", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateOilLineVacuumTestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("oil_line_vacuum_tests").insert(parsed.data).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetOilLineVacuumTestResponse.parse(data));
});

router.get("/oil-line-vacuum-tests/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetOilLineVacuumTestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("oil_line_vacuum_tests").select("*").eq("id", params.data.id).single();
  if (error || !data) { res.status(404).json({ error: "Oil line vacuum test not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetOilLineVacuumTestResponse.parse(data));
});

router.patch("/oil-line-vacuum-tests/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateOilLineVacuumTestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateOilLineVacuumTestBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data: existing } = await supabaseAdmin.from("oil_line_vacuum_tests").select("job_id").eq("id", params.data.id).single();
  if (!existing) { res.status(404).json({ error: "Oil line vacuum test not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("oil_line_vacuum_tests").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Oil line vacuum test not found" }); return; }
  res.json(UpdateOilLineVacuumTestResponse.parse(data));
});

router.get("/oil-line-vacuum-tests/job/:jobId", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetOilLineVacuumTestByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("oil_line_vacuum_tests").select("*").eq("job_id", params.data.jobId).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No oil line vacuum test for this job" }); return; }
  res.json(GetOilLineVacuumTestByJobResponse.parse(data));
});

export default router;
