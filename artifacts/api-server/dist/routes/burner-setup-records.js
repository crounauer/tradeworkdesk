import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { CreateBurnerSetupRecordBody, GetBurnerSetupRecordParams, GetBurnerSetupRecordResponse, UpdateBurnerSetupRecordParams, UpdateBurnerSetupRecordBody, UpdateBurnerSetupRecordResponse, GetBurnerSetupRecordByJobParams, GetBurnerSetupRecordByJobResponse, } from "@workspace/api-zod";
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
router.post("/burner-setup-records", requireAuth, async (req, res) => {
    const parsed = CreateBurnerSetupRecordBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const access = await verifyJobAccess(req, parsed.data.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin.from("burner_setup_records").insert(parsed.data).select().single();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.status(201).json(GetBurnerSetupRecordResponse.parse(data));
});
router.get("/burner-setup-records/:id", requireAuth, async (req, res) => {
    const params = GetBurnerSetupRecordParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin.from("burner_setup_records").select("*").eq("id", params.data.id).single();
    if (error || !data) {
        res.status(404).json({ error: "Burner setup record not found" });
        return;
    }
    const access = await verifyJobAccess(req, data.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    res.json(GetBurnerSetupRecordResponse.parse(data));
});
router.patch("/burner-setup-records/:id", requireAuth, async (req, res) => {
    const params = UpdateBurnerSetupRecordParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const body = UpdateBurnerSetupRecordBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: body.error.message });
        return;
    }
    const { data: existing } = await supabaseAdmin.from("burner_setup_records").select("job_id").eq("id", params.data.id).single();
    if (!existing) {
        res.status(404).json({ error: "Burner setup record not found" });
        return;
    }
    const access = await verifyJobAccess(req, existing.job_id);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("burner_setup_records").update(body.data).eq("id", params.data.id).select().single();
    if (error || !data) {
        res.status(404).json({ error: "Burner setup record not found" });
        return;
    }
    res.json(UpdateBurnerSetupRecordResponse.parse(data));
});
router.get("/burner-setup-records/job/:jobId", requireAuth, async (req, res) => {
    const params = GetBurnerSetupRecordByJobParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const access = await verifyJobAccess(req, params.data.jobId);
    if (!access.allowed) {
        res.status(403).json({ error: access.error });
        return;
    }
    const { data, error } = await supabaseAdmin.from("burner_setup_records").select("*").eq("job_id", params.data.jobId).maybeSingle();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    if (!data) {
        res.status(404).json({ error: "No burner setup record for this job" });
        return;
    }
    res.json(GetBurnerSetupRecordByJobResponse.parse(data));
});
export default router;
