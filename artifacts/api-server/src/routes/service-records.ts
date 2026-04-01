import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateServiceRecordBody,
  GetServiceRecordParams,
  GetServiceRecordResponse,
  UpdateServiceRecordParams,
  UpdateServiceRecordBody,
  UpdateServiceRecordResponse,
  GetServiceRecordByJobParams,
  GetServiceRecordByJobResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function verifyJobAccess(req: AuthenticatedRequest, jobId: string): Promise<{ allowed: boolean; error?: string }> {
  let q = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: job } = await q.single();
  if (!job) return { allowed: false, error: "Job not found" };
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    return { allowed: false, error: "You can only modify service records for jobs assigned to you" };
  }
  return { allowed: true };
}

router.post("/service-records", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateServiceRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("service_records").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  if (parsed.data.next_service_due) {
    const { data: job } = await supabaseAdmin.from("jobs").select("appliance_id").eq("id", parsed.data.job_id).single();
    if (job?.appliance_id) {
      await supabaseAdmin.from("appliances").update({
        last_service_date: new Date().toISOString().split("T")[0],
        next_service_due: parsed.data.next_service_due,
      }).eq("id", job.appliance_id);
    }
  }

  res.status(201).json(GetServiceRecordResponse.parse(data));
});

router.get("/service-records/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetServiceRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let getQ = supabaseAdmin.from("service_records").select("*").eq("id", params.data.id);
  if (req.tenantId) getQ = getQ.eq("tenant_id", req.tenantId);
  const { data, error } = await getQ.single();
  if (error || !data) { res.status(404).json({ error: "Service record not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetServiceRecordResponse.parse(data));
});

router.patch("/service-records/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateServiceRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateServiceRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let existQ = supabaseAdmin.from("service_records").select("job_id").eq("id", params.data.id);
  if (req.tenantId) existQ = existQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existQ.single();
  if (!existing) { res.status(404).json({ error: "Service record not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("service_records").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Service record not found" }); return; }
  res.json(UpdateServiceRecordResponse.parse(data));
});

router.get("/service-records/job/:jobId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetServiceRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let jobRecQ = supabaseAdmin.from("service_records").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) jobRecQ = jobRecQ.eq("tenant_id", req.tenantId);
  const { data, error } = await jobRecQ.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.json(null); return; }
  res.json(GetServiceRecordByJobResponse.parse(data));
});

export default router;
