import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateCombustionAnalysisRecordBody,
  GetCombustionAnalysisRecordParams,
  GetCombustionAnalysisRecordResponse,
  UpdateCombustionAnalysisRecordParams,
  UpdateCombustionAnalysisRecordBody,
  UpdateCombustionAnalysisRecordResponse,
  GetCombustionAnalysisRecordByJobParams,
  GetCombustionAnalysisRecordByJobResponse,
} from "@workspace/api-zod";
import { verifyJobAccess } from "../lib/verify-job-access";

const router: IRouter = Router();


router.post("/combustion-analysis-records", requireAuth, requireTenant, requirePlanFeature("combustion_analysis"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCombustionAnalysisRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin.from("combustion_analysis_records").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetCombustionAnalysisRecordResponse.parse(data));
});

router.get("/combustion-analysis-records/:id", requireAuth, requireTenant, requirePlanFeature("combustion_analysis"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCombustionAnalysisRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let getQ = supabaseAdmin.from("combustion_analysis_records").select("*").eq("id", params.data.id);
  if (req.tenantId) getQ = getQ.eq("tenant_id", req.tenantId);
  const { data, error } = await getQ.single();
  if (error || !data) { res.status(404).json({ error: "Combustion analysis record not found" }); return; }

  const access = await verifyJobAccess(req, data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  res.json(GetCombustionAnalysisRecordResponse.parse(data));
});

router.patch("/combustion-analysis-records/:id", requireAuth, requireTenant, requirePlanFeature("combustion_analysis"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateCombustionAnalysisRecordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateCombustionAnalysisRecordBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let existQ = supabaseAdmin.from("combustion_analysis_records").select("job_id").eq("id", params.data.id);
  if (req.tenantId) existQ = existQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existQ.single();
  if (!existing) { res.status(404).json({ error: "Combustion analysis record not found" }); return; }

  const access = await verifyJobAccess(req, existing.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("combustion_analysis_records").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Combustion analysis record not found" }); return; }
  res.json(UpdateCombustionAnalysisRecordResponse.parse(data));
});

router.get("/combustion-analysis-records/job/:jobId", requireAuth, requireTenant, requirePlanFeature("combustion_analysis"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCombustionAnalysisRecordByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let jobQ = supabaseAdmin.from("combustion_analysis_records").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data, error } = await jobQ.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.json(null); return; }
  res.json(GetCombustionAnalysisRecordByJobResponse.parse(data));
});

router.delete("/combustion-analysis-records/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = req.params.id;
  let q = supabaseAdmin.from("combustion_analysis_records").select("job_id").eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: existing } = await q.single();
  if (!existing) { res.status(404).json({ error: "Record not found" }); return; }
  const { error } = await supabaseAdmin.from("combustion_analysis_records").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
