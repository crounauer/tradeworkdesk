import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateHeatPumpServiceRecordBody,
  UpdateHeatPumpServiceRecordBody,
  GetHeatPumpServiceRecordResponse,
  GetHeatPumpServiceRecordByJobParams,
  GetHeatPumpServiceRecordByJobResponse,
  UpdateHeatPumpServiceRecordResponse,
} from "@workspace/api-zod";
import { verifyJobAccess } from "../lib/verify-job-access";

const router: IRouter = Router();


router.get("/jobs/:jobId/heat-pump-service", requireAuth, requireTenant, requirePlanFeature("heat_pump_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpServiceRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let recQ = supabaseAdmin.from("heat_pump_service_records").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) recQ = recQ.eq("tenant_id", req.tenantId);
  const { data, error } = await recQ.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.json(null); return; }
  res.json(GetHeatPumpServiceRecordByJobResponse.parse(data));
});

router.post("/jobs/:jobId/heat-pump-service", requireAuth, requireTenant, requirePlanFeature("heat_pump_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
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
    .from("heat_pump_service_records").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  const applianceDate = parsed.data.service_date || new Date().toISOString().slice(0, 10);
  const nextDue = parsed.data.next_service_due || null;
  const { data: job } = await supabaseAdmin.from("jobs").select("appliance_id").eq("id", params.data.jobId).single();
  if (job?.appliance_id) {
    await supabaseAdmin.from("appliances").update({
      last_service_date: applianceDate,
      next_service_due: nextDue,
    }).eq("id", job.appliance_id);
  }

  res.status(201).json(GetHeatPumpServiceRecordResponse.parse(data));
});

router.patch("/jobs/:jobId/heat-pump-service", requireAuth, requireTenant, requirePlanFeature("heat_pump_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetHeatPumpServiceRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const body = UpdateHeatPumpServiceRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let existQ = supabaseAdmin.from("heat_pump_service_records").select("id").eq("job_id", params.data.jobId);
  if (req.tenantId) existQ = existQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existQ.maybeSingle();
  if (!existing) { res.status(404).json({ error: "No heat pump service record for this job" }); return; }

  const { data, error } = await supabaseAdmin
    .from("heat_pump_service_records").update(body.data).eq("id", existing.id).select().single();
  if (error || !data) { res.status(500).json({ error: error?.message || "Update failed" }); return; }

  if (body.data.service_date || body.data.next_service_due) {
    const { data: job } = await supabaseAdmin.from("jobs").select("appliance_id").eq("id", params.data.jobId).single();
    if (job?.appliance_id) {
      await supabaseAdmin.from("appliances").update({
        last_service_date: body.data.service_date || data.service_date || new Date().toISOString().slice(0, 10),
        next_service_due: body.data.next_service_due ?? data.next_service_due ?? null,
      }).eq("id", job.appliance_id);
    }
  }

  res.json(UpdateHeatPumpServiceRecordResponse.parse(data));
});

router.delete("/jobs/:jobId/heat-pump-service/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = req.params.id;
  let q = supabaseAdmin.from("heat_pump_service_records").select("job_id").eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: existing } = await q.single();
  if (!existing) { res.status(404).json({ error: "Record not found" }); return; }
  const { error } = await supabaseAdmin.from("heat_pump_service_records").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
