import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { CreateOilTankRiskAssessmentBody, GetOilTankRiskAssessmentParams, GetOilTankRiskAssessmentResponse, UpdateOilTankRiskAssessmentParams, UpdateOilTankRiskAssessmentBody, UpdateOilTankRiskAssessmentResponse, GetOilTankRiskAssessmentByJobParams, GetOilTankRiskAssessmentByJobResponse, } from "@workspace/api-zod";
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
router.post("/oil-tank-risk-assessments", requireAuth, async (req, res) => {
    const parsed = CreateOilTankRiskAssessmentBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const access = await verifyJobAccess(req, parsed.data.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin.from("oil_tank_risk_assessments").insert(parsed.data).select().single();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.status(201).json(GetOilTankRiskAssessmentResponse.parse(data));
});
router.get("/oil-tank-risk-assessments/:id", requireAuth, async (req, res) => {
    const params = GetOilTankRiskAssessmentParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin.from("oil_tank_risk_assessments").select("*").eq("id", params.data.id).single();
    if (error || !data) {
        res.status(404).json({ error: "Oil tank risk assessment not found" });
        return;
    }
    const access = await verifyJobAccess(req, data.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    res.json(GetOilTankRiskAssessmentResponse.parse(data));
});
router.patch("/oil-tank-risk-assessments/:id", requireAuth, async (req, res) => {
    const params = UpdateOilTankRiskAssessmentParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const body = UpdateOilTankRiskAssessmentBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: body.error.message });
        return;
    }
    const { data: existing } = await supabaseAdmin.from("oil_tank_risk_assessments").select("job_id").eq("id", params.data.id).single();
    if (!existing) {
        res.status(404).json({ error: "Oil tank risk assessment not found" });
        return;
    }
    const access = await verifyJobAccess(req, existing.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("oil_tank_risk_assessments").update(body.data).eq("id", params.data.id).select().single();
    if (error || !data) {
        res.status(404).json({ error: "Oil tank risk assessment not found" });
        return;
    }
    res.json(UpdateOilTankRiskAssessmentResponse.parse(data));
});
router.get("/oil-tank-risk-assessments/job/:jobId", requireAuth, async (req, res) => {
    const params = GetOilTankRiskAssessmentByJobParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const access = await verifyJobAccess(req, params.data.jobId);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin.from("oil_tank_risk_assessments").select("*").eq("job_id", params.data.jobId).maybeSingle();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    if (!data) {
        res.status(404).json({ error: "No oil tank risk assessment for this job" });
        return;
    }
    res.json(GetOilTankRiskAssessmentByJobResponse.parse(data));
});
export default router;
