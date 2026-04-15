import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateOilTankRiskAssessmentBody,
  GetOilTankRiskAssessmentParams,
  GetOilTankRiskAssessmentResponse,
  UpdateOilTankRiskAssessmentParams,
  UpdateOilTankRiskAssessmentBody,
  UpdateOilTankRiskAssessmentResponse,
  GetOilTankRiskAssessmentByJobParams,
  GetOilTankRiskAssessmentByJobResponse,
} from "@workspace/api-zod";
import { verifyJobAccess } from "../lib/verify-job-access";

const router: IRouter = Router();


router.post("/oil-tank-risk-assessments", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateOilTankRiskAssessmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("oil_tank_risk_assessments").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetOilTankRiskAssessmentResponse.parse(data));
});

router.get("/oil-tank-risk-assessments/:id", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetOilTankRiskAssessmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let getQ = supabaseAdmin.from("oil_tank_risk_assessments").select("*").eq("id", params.data.id);
  if (req.tenantId) getQ = getQ.eq("tenant_id", req.tenantId);
  const { data, error } = await getQ.single();
  if (error || !data) { res.status(404).json({ error: "Oil tank risk assessment not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetOilTankRiskAssessmentResponse.parse(data));
});

router.patch("/oil-tank-risk-assessments/:id", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateOilTankRiskAssessmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateOilTankRiskAssessmentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let existQ = supabaseAdmin.from("oil_tank_risk_assessments").select("job_id").eq("id", params.data.id);
  if (req.tenantId) existQ = existQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existQ.single();
  if (!existing) { res.status(404).json({ error: "Oil tank risk assessment not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("oil_tank_risk_assessments").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Oil tank risk assessment not found" }); return; }
  res.json(UpdateOilTankRiskAssessmentResponse.parse(data));
});

router.get("/oil-tank-risk-assessments/job/:jobId", requireAuth, requireTenant, requirePlanFeature("oil_tank_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetOilTankRiskAssessmentByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let jobQ = supabaseAdmin.from("oil_tank_risk_assessments").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data, error } = await jobQ.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.json(null); return; }
  res.json(GetOilTankRiskAssessmentByJobResponse.parse(data));
});

router.delete("/oil-tank-risk-assessments/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = req.params.id;
  let q = supabaseAdmin.from("oil_tank_risk_assessments").select("job_id").eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: existing } = await q.single();
  if (!existing) { res.status(404).json({ error: "Record not found" }); return; }
  const { error } = await supabaseAdmin.from("oil_tank_risk_assessments").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
