import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import {
  ListJobsQueryParams,
  ListJobsResponse,
  CreateJobBody,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  DeleteJobParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jobs", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  let q = supabaseAdmin
    .from("jobs")
    .select("*, customers(first_name, last_name), properties(address_line1), profiles(full_name)")
    .eq("is_active", true)
    .order("scheduled_date", { ascending: false });

  if (query.success) {
    if (query.data.status) q = q.eq("status", query.data.status);
    if (query.data.job_type) q = q.eq("job_type", query.data.job_type);
    if (query.data.technician_id) q = q.eq("assigned_technician_id", query.data.technician_id);
    if (query.data.customer_id) q = q.eq("customer_id", query.data.customer_id);
    if (query.data.property_id) q = q.eq("property_id", query.data.property_id);
    if (query.data.date_from) q = q.gte("scheduled_date", query.data.date_from);
    if (query.data.date_to) q = q.lte("scheduled_date", query.data.date_to);
  }

  if (req.userRole === "technician") {
    q = q.eq("assigned_technician_id", req.userId!);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((j: any) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  }));

  res.json(ListJobsResponse.parse(mapped));
});

router.post("/jobs", requireAuth, requireRole("admin", "office_staff"), async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("jobs").insert(parsed.data).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.get("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data: job, error } = await supabaseAdmin
    .from("jobs").select("*").eq("id", params.data.id).single();
  if (error || !job) { res.status(404).json({ error: "Job not found" }); return; }

  const [customerRes, propertyRes, applianceRes, techRes, srRes, brRes, notesRes, filesRes, sigsRes] = await Promise.all([
    supabaseAdmin.from("customers").select("*").eq("id", job.customer_id).single(),
    supabaseAdmin.from("properties").select("*").eq("id", job.property_id).single(),
    job.appliance_id ? supabaseAdmin.from("appliances").select("*").eq("id", job.appliance_id).single() : { data: null },
    job.assigned_technician_id ? supabaseAdmin.from("profiles").select("*").eq("id", job.assigned_technician_id).single() : { data: null },
    supabaseAdmin.from("service_records").select("*").eq("job_id", params.data.id).maybeSingle(),
    supabaseAdmin.from("breakdown_reports").select("*").eq("job_id", params.data.id).maybeSingle(),
    supabaseAdmin.from("job_notes").select("*, profiles(full_name)").eq("job_id", params.data.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("file_attachments").select("*").eq("entity_type", "job").eq("entity_id", params.data.id),
    supabaseAdmin.from("signatures").select("*").eq("job_id", params.data.id),
  ]);

  const mappedNotes = (notesRes.data || []).map((n: any) => ({
    ...n,
    author_name: n.profiles?.full_name || null,
    profiles: undefined,
  }));

  const filesWithUrls = await Promise.all(
    (filesRes.data || []).map(async (f: any) => {
      const bucket = f.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
      const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(f.storage_path, 3600);
      return { ...f, signed_url: urlData?.signedUrl || null };
    })
  );

  const sigsWithUrls = await Promise.all(
    (sigsRes.data || []).map(async (s: any) => {
      const { data: urlData } = await supabaseAdmin.storage.from("signatures").createSignedUrl(s.storage_path, 3600);
      return { ...s, signed_url: urlData?.signedUrl || null };
    })
  );

  res.json(GetJobResponse.parse({
    ...job,
    customer: customerRes.data || undefined,
    property: propertyRes.data || undefined,
    appliance: applianceRes.data || undefined,
    technician: techRes.data || undefined,
    service_record: srRes.data || undefined,
    breakdown_report: brRes.data || undefined,
    notes: mappedNotes,
    files: filesWithUrls,
    signatures: sigsWithUrls,
  }));
});

router.patch("/jobs/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateJobBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("jobs").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(UpdateJobResponse.parse(data));
});

router.delete("/jobs/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await supabaseAdmin.from("jobs").update({ is_active: false }).eq("id", params.data.id);
  res.sendStatus(204);
});

export default router;
