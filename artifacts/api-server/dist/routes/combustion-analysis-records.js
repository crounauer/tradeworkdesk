import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { CreateCombustionAnalysisRecordBody, GetCombustionAnalysisRecordParams, GetCombustionAnalysisRecordResponse, UpdateCombustionAnalysisRecordParams, UpdateCombustionAnalysisRecordBody, UpdateCombustionAnalysisRecordResponse, GetCombustionAnalysisRecordByJobParams, GetCombustionAnalysisRecordByJobResponse, } from "@workspace/api-zod";
const router = Router();
async function verifyJobAccess(req, jobId) {
    const { data: job } = await supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId).single();
    if (!job)
        return { allowed: false, error: "Job not found" };
    if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
        return { allowed: false, error: "You can only access records for jobs assigned to you" };
    }
    return { allowed: true };
}
router.post("/combustion-analysis-records", requireAuth, async (req, res) => {
    const parsed = CreateCombustionAnalysisRecordBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const access = await verifyJobAccess(req, parsed.data.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin.from("combustion_analysis_records").insert(parsed.data).select().single();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.status(201).json(GetCombustionAnalysisRecordResponse.parse(data));
});
router.get("/combustion-analysis-records/:id", requireAuth, async (req, res) => {
    const params = GetCombustionAnalysisRecordParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin.from("combustion_analysis_records").select("*").eq("id", params.data.id).single();
    if (error || !data) {
        res.status(404).json({ error: "Combustion analysis record not found" });
        return;
    }
    const access = await verifyJobAccess(req, data.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    res.json(GetCombustionAnalysisRecordResponse.parse(data));
});
router.patch("/combustion-analysis-records/:id", requireAuth, async (req, res) => {
    const params = UpdateCombustionAnalysisRecordParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const body = UpdateCombustionAnalysisRecordBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: body.error.message });
        return;
    }
    const { data: existing } = await supabaseAdmin.from("combustion_analysis_records").select("job_id").eq("id", params.data.id).single();
    if (!existing) {
        res.status(404).json({ error: "Combustion analysis record not found" });
        return;
    }
    const access = await verifyJobAccess(req, existing.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("combustion_analysis_records").update(body.data).eq("id", params.data.id).select().single();
    if (error || !data) {
        res.status(404).json({ error: "Combustion analysis record not found" });
        return;
    }
    res.json(UpdateCombustionAnalysisRecordResponse.parse(data));
});
router.get("/combustion-analysis-records/job/:jobId", requireAuth, async (req, res) => {
    const params = GetCombustionAnalysisRecordByJobParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const access = await verifyJobAccess(req, params.data.jobId);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin.from("combustion_analysis_records").select("*").eq("job_id", params.data.jobId).maybeSingle();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    if (!data) {
        res.status(404).json({ error: "No combustion analysis record for this job" });
        return;
    }
    res.json(GetCombustionAnalysisRecordByJobResponse.parse(data));
});
export default router;
