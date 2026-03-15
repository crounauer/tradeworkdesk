import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateFireValveTestRecordBody,
  GetFireValveTestRecordParams,
  GetFireValveTestRecordResponse,
  UpdateFireValveTestRecordParams,
  UpdateFireValveTestRecordBody,
  UpdateFireValveTestRecordResponse,
  GetFireValveTestRecordByJobParams,
  GetFireValveTestRecordByJobResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function verifyJobAccess(req: AuthenticatedRequest, jobId: string): Promise<{ allowed: boolean; error?: string }> {
  let q = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: job } = await q.single();
  if (!job) return { allowed: false, error: "Job not found" };
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    return { allowed: false, error: "You can only access records for jobs assigned to you" };
  }
  return { allowed: true };
}

router.post("/fire-valve-test-records", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateFireValveTestRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("fire_valve_test_records").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetFireValveTestRecordResponse.parse(data));
});

router.get("/fire-valve-test-records/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetFireValveTestRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("fire_valve_test_records").select("*").eq("id", params.data.id).single();
  if (error || !data) { res.status(404).json({ error: "Fire valve test record not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetFireValveTestRecordResponse.parse(data));
});

router.patch("/fire-valve-test-records/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateFireValveTestRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateFireValveTestRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data: existing } = await supabaseAdmin.from("fire_valve_test_records").select("job_id").eq("id", params.data.id).single();
  if (!existing) { res.status(404).json({ error: "Fire valve test record not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("fire_valve_test_records").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Fire valve test record not found" }); return; }
  res.json(UpdateFireValveTestRecordResponse.parse(data));
});

router.get("/fire-valve-test-records/job/:jobId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetFireValveTestRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("fire_valve_test_records").select("*").eq("job_id", params.data.jobId).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No fire valve test record for this job" }); return; }
  res.json(GetFireValveTestRecordByJobResponse.parse(data));
});

export default router;
