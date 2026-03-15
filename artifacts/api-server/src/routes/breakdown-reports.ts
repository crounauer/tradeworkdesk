import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  CreateBreakdownReportBody,
  GetBreakdownReportParams,
  GetBreakdownReportResponse,
  UpdateBreakdownReportParams,
  UpdateBreakdownReportBody,
  UpdateBreakdownReportResponse,
  GetBreakdownReportByJobParams,
  GetBreakdownReportByJobResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/breakdown-reports", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBreakdownReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("breakdown_reports").insert(parsed.data).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(GetBreakdownReportResponse.parse(data));
});

router.get("/breakdown-reports/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetBreakdownReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("breakdown_reports").select("*").eq("id", params.data.id).single();
  if (error || !data) { res.status(404).json({ error: "Breakdown report not found" }); return; }
  res.json(GetBreakdownReportResponse.parse(data));
});

router.patch("/breakdown-reports/:id", requireAuth, requireRole("admin", "office_staff", "technician"), async (req, res): Promise<void> => {
  const params = UpdateBreakdownReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateBreakdownReportBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("breakdown_reports").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Breakdown report not found" }); return; }
  res.json(UpdateBreakdownReportResponse.parse(data));
});

router.get("/breakdown-reports/job/:jobId", requireAuth, async (req, res): Promise<void> => {
  const params = GetBreakdownReportByJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("breakdown_reports").select("*").eq("job_id", params.data.jobId).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "No breakdown report for this job" }); return; }
  res.json(GetBreakdownReportByJobResponse.parse(data));
});

export default router;
