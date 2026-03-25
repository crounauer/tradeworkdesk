import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  ListJobNotesParams,
  ListJobNotesResponse,
  CreateJobNoteParams,
  CreateJobNoteBody,
} from "@workspace/api-zod";

interface NoteRow {
  id: string;
  job_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const router: IRouter = Router();

router.get("/jobs/:jobId/notes", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = ListJobNotesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let jobQ = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", params.data.jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job } = await jobQ.single();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const { data, error } = await supabaseAdmin
    .from("job_notes")
    .select("*, profiles(full_name)")
    .eq("job_id", params.data.jobId)
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data as NoteRow[] || []).map((n) => ({
    ...n,
    author_name: n.profiles?.full_name || null,
    profiles: undefined,
  }));

  res.json(ListJobNotesResponse.parse(mapped));
});

router.post("/jobs/:jobId/notes", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = CreateJobNoteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = CreateJobNoteBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let jobQ = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", params.data.jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job } = await jobQ.single();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const { data, error } = await supabaseAdmin
    .from("job_notes")
    .insert({ job_id: params.data.jobId, author_id: req.userId!, content: body.data.content, tenant_id: req.tenantId })
    .select("*, profiles(full_name)")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const noteData = data as NoteRow;
  const mapped = { ...noteData, author_name: noteData.profiles?.full_name || null, profiles: undefined };
  res.status(201).json(mapped);
});

router.patch("/jobs/:jobId/notes/:noteId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { jobId, noteId } = req.params;
  if (!jobId || !noteId) { res.status(400).json({ error: "Missing ids" }); return; }

  const { content } = req.body;
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" }); return;
  }

  let jobQ = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job } = await jobQ.single();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  let noteQ = supabaseAdmin.from("job_notes").select("author_id").eq("id", noteId).eq("job_id", jobId);
  if (req.tenantId) noteQ = noteQ.eq("tenant_id", req.tenantId);
  const { data: note } = await noteQ.single();
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  if (note.author_id !== req.userId) {
    res.status(403).json({ error: "You can only edit your own comments" }); return;
  }

  const { data, error } = await supabaseAdmin
    .from("job_notes")
    .update({ content: content.trim() })
    .eq("id", noteId)
    .select("*, profiles(full_name)")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  const noteData = data as NoteRow;
  res.json({ ...noteData, author_name: noteData.profiles?.full_name || null, profiles: undefined });
});

router.delete("/jobs/:jobId/notes/:noteId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { jobId, noteId } = req.params;
  if (!jobId || !noteId) { res.status(400).json({ error: "Missing ids" }); return; }

  let jobQ = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job } = await jobQ.single();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  let noteQ = supabaseAdmin.from("job_notes").select("author_id").eq("id", noteId).eq("job_id", jobId);
  if (req.tenantId) noteQ = noteQ.eq("tenant_id", req.tenantId);
  const { data: note } = await noteQ.single();
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  if (note.author_id !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ error: "Only the author or an admin can delete comments" }); return;
  }

  await supabaseAdmin.from("job_notes").delete().eq("id", noteId);
  res.sendStatus(204);
});

export default router;
