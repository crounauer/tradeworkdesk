import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
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
import { verifyJobAccess } from "../lib/verify-job-access";

const router: IRouter = Router();


router.post("/oil-line-vacuum-tests", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateOilLineVacuumTestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("oil_line_vacuum_tests").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetOilLineVacuumTestResponse.parse(data));
});

router.get("/oil-line-vacuum-tests/:id", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetOilLineVacuumTestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let getQ = supabaseAdmin.from("oil_line_vacuum_tests").select("*").eq("id", params.data.id);
  if (req.tenantId) getQ = getQ.eq("tenant_id", req.tenantId);
  const { data, error } = await getQ.single();
  if (error || !data) { res.status(404).json({ error: "Oil line vacuum test not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetOilLineVacuumTestResponse.parse(data));
});

router.patch("/oil-line-vacuum-tests/:id", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateOilLineVacuumTestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateOilLineVacuumTestBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let existQ = supabaseAdmin.from("oil_line_vacuum_tests").select("job_id").eq("id", params.data.id);
  if (req.tenantId) existQ = existQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existQ.single();
  if (!existing) { res.status(404).json({ error: "Oil line vacuum test not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("oil_line_vacuum_tests").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Oil line vacuum test not found" }); return; }
  res.json(UpdateOilLineVacuumTestResponse.parse(data));
});

router.get("/oil-line-vacuum-tests/job/:jobId", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetOilLineVacuumTestByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let jobQ = supabaseAdmin.from("oil_line_vacuum_tests").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data, error } = await jobQ.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.json(null); return; }
  res.json(GetOilLineVacuumTestByJobResponse.parse(data));
});

router.delete("/oil-line-vacuum-tests/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = req.params.id;
  let q = supabaseAdmin.from("oil_line_vacuum_tests").select("job_id").eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: existing } = await q.single();
  if (!existing) { res.status(404).json({ error: "Record not found" }); return; }
  const { error } = await supabaseAdmin.from("oil_line_vacuum_tests").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
