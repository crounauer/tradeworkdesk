import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { ListJobNotesParams, ListJobNotesResponse, CreateJobNoteParams, CreateJobNoteBody, } from "@workspace/api-zod";
const router = Router();
router.get("/jobs/:jobId/notes", requireAuth, async (req, res) => {
    const params = ListJobNotesParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const { data: job } = await supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", params.data.jobId).single();
    if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
    }
    if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
        res.status(403).json({ error: "Not authorized" });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("job_notes")
        .select("*, profiles(full_name)")
        .eq("job_id", params.data.jobId)
        .order("created_at", { ascending: false });
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    const mapped = (data || []).map((n) => ({
        ...n,
        author_name: n.profiles?.full_name || null,
        profiles: undefined,
    }));
    res.json(ListJobNotesResponse.parse(mapped));
});
router.post("/jobs/:jobId/notes", requireAuth, async (req, res) => {
    const params = CreateJobNoteParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const body = CreateJobNoteBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: body.error.message });
        return;
    }
    const { data: job } = await supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", params.data.jobId).single();
    if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
    }
    if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
        res.status(403).json({ error: "Not authorized" });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("job_notes")
        .insert({ job_id: params.data.jobId, author_id: req.userId, content: body.data.content })
        .select("*, profiles(full_name)")
        .single();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    const noteData = data;
    const mapped = { ...noteData, author_name: noteData.profiles?.full_name || null, profiles: undefined };
    res.status(201).json(mapped);
});
export default router;
