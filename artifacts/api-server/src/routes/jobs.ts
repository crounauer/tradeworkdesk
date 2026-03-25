import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, jobTypes } from "@workspace/db";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { verifyMultipleTenantOwnership } from "../lib/tenant-validation";
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

interface SupabaseJobRow {
  id: string;
  customer_id: string;
  property_id: string;
  appliance_id: string | null;
  assigned_technician_id: string | null;
  job_type: string;
  job_type_id: number | null;
  status: string;
  priority: string;
  description: string | null;
  notes: string | null;
  scheduled_date: string;
  scheduled_end_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  arrival_time: string | null;
  departure_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customers?: { first_name: string; last_name: string } | null;
  properties?: { address_line1: string } | null;
  profiles?: { full_name: string } | null;
}

async function verifyTechnicianOwnership(
  jobId: string,
  userId: string | undefined,
  tenantId: string | undefined | null,
): Promise<boolean> {
  let tq = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: j } = await tq.single();
  return !!j && j.assigned_technician_id === userId;
}

async function enrichJobsWithTypeNames(
  jobs: SupabaseJobRow[]
): Promise<(SupabaseJobRow & { job_type_name: string | null })[]> {
  if (!jobs.length) return jobs.map((j) => ({ ...j, job_type_name: null }));

  const typeIds = [...new Set(jobs.map((j) => j.job_type_id).filter((id): id is number => id != null))];
  if (!typeIds.length) return jobs.map((j) => ({ ...j, job_type_name: null }));

  const types = await db
    .select({ id: jobTypes.id, name: jobTypes.name })
    .from(jobTypes)
    .where(inArray(jobTypes.id, typeIds));

  const typeMap = new Map(types.map((t) => [t.id, t.name]));

  return jobs.map((j) => ({
    ...j,
    job_type_name: j.job_type_id != null ? (typeMap.get(j.job_type_id) ?? null) : null,
  }));
}

const VALID_JOB_TYPE_ENUMS = new Set(["service", "breakdown", "installation", "inspection", "follow_up"]);

function deriveJobTypeEnum(
  category: string,
  slug: string
): "service" | "breakdown" | "installation" | "inspection" | "follow_up" {
  if (VALID_JOB_TYPE_ENUMS.has(category)) {
    return category as "service" | "breakdown" | "installation" | "inspection" | "follow_up";
  }
  const s = slug.toLowerCase();
  if (s.includes("follow")) return "follow_up";
  if (s.includes("install")) return "installation";
  if (s.includes("inspect")) return "inspection";
  if (s.includes("breakdown") || s.includes("repair") || s.includes("emergency")) return "breakdown";
  return "service";
}

const router: IRouter = Router();

router.get("/jobs", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  let q = supabaseAdmin
    .from("jobs")
    .select("*, customers(first_name, last_name), properties(address_line1), profiles(full_name)")
    .eq("is_active", true)
    .order("scheduled_date", { ascending: false });

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  if (query.success) {
    if (query.data.status) q = q.eq("status", query.data.status);
    if (query.data.job_type) q = q.eq("job_type", query.data.job_type);
    if (query.data.technician_id) q = q.eq("assigned_technician_id", query.data.technician_id);
    if (query.data.customer_id) q = q.eq("customer_id", query.data.customer_id);
    if (query.data.property_id) q = q.eq("property_id", query.data.property_id);
    if (query.data.date_from) {
      const df = query.data.date_from instanceof Date
        ? query.data.date_from.toISOString().slice(0, 10)
        : String(query.data.date_from);
      q = q.or(`scheduled_date.gte.${df},scheduled_end_date.gte.${df}`);
    }
    if (query.data.date_to) {
      const dt = query.data.date_to instanceof Date
        ? query.data.date_to.toISOString().slice(0, 10)
        : String(query.data.date_to);
      q = q.lte("scheduled_date", dt);
    }
  }

  if (req.userRole === "technician") {
    q = q.eq("assigned_technician_id", req.userId!);
  }

  const [{ data, error }, allTypes] = await Promise.all([
    q,
    db.select({ id: jobTypes.id, name: jobTypes.name }).from(jobTypes),
  ]);
  if (error) { res.status(500).json({ error: error.message }); return; }

  const typeMap = new Map(allTypes.map((t) => [t.id, t.name]));
  const rawMapped = (data as SupabaseJobRow[] || []).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    job_type_name: j.job_type_id != null ? (typeMap.get(j.job_type_id) ?? null) : null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  }));

  res.set("Cache-Control", "private, no-cache");
  res.json(ListJobsResponse.parse(rawMapped));
});

router.post("/jobs", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const fkChecks: Array<{ table: string; id: string | undefined | null }> = [
    { table: "customers", id: parsed.data.customer_id },
    { table: "properties", id: parsed.data.property_id },
    { table: "appliances", id: parsed.data.appliance_id },
    { table: "profiles", id: parsed.data.assigned_technician_id },
  ];
  const { valid, failedTable } = await verifyMultipleTenantOwnership(fkChecks, req.tenantId);
  if (!valid) { res.status(403).json({ error: `Referenced ${failedTable} does not belong to your company.` }); return; }

  const { job_type_id: rawJobTypeId, ...jobCoreData } = parsed.data;

  const postStartIso = new Date(jobCoreData.scheduled_date as unknown as string).toISOString().slice(0, 10);
  if (jobCoreData.scheduled_end_date && jobCoreData.scheduled_end_date < postStartIso) {
    res.status(400).json({ error: "End date cannot be before start date" }); return;
  }

  const jobTypeId = typeof rawJobTypeId === "number" && Number.isInteger(rawJobTypeId) && rawJobTypeId > 0
    ? rawJobTypeId : undefined;

  let verifiedJobTypeId: number | undefined;
  let resolvedJobType: "service" | "breakdown" | "installation" | "inspection" | "follow_up" =
    jobCoreData.job_type ?? "service";

  if (jobTypeId && req.tenantId) {
    const [jt] = await db
      .select()
      .from(jobTypes)
      .where(eq(jobTypes.id, jobTypeId));
    if (jt && jt.tenant_id === req.tenantId && jt.is_active) {
      verifiedJobTypeId = jt.id;
      resolvedJobType = deriveJobTypeEnum(jt.category, jt.slug);
    } else {
      resolvedJobType = "service";
    }
  }

  const insertPayload = {
    ...jobCoreData,
    job_type: resolvedJobType,
    tenant_id: req.tenantId,
    ...(verifiedJobTypeId ? { job_type_id: verifiedJobTypeId } : {}),
  };

  const { data, error } = await supabaseAdmin.from("jobs").insert(insertPayload).select().single();
  if (error) {
    if (error.code === "23514") {
      res.status(400).json({ error: "End date cannot be before start date" }); return;
    }
    res.status(500).json({ error: error.message }); return;
  }

  res.status(201).json(data);
});

router.get("/jobs/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let jobQ = supabaseAdmin.from("jobs").select("*").eq("id", params.data.id);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error } = await jobQ.single();
  if (error || !job) { res.status(404).json({ error: "Job not found" }); return; }

  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    res.status(403).json({ error: "You can only view jobs assigned to you" });
    return;
  }

  interface NoteRow {
    id: string;
    job_id: string;
    author_id: string;
    content: string;
    created_at: string;
    profiles?: { full_name: string } | null;
  }

  interface FileRow {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    entity_type: string;
    entity_id: string;
    uploaded_by: string;
    description: string | null;
    created_at: string;
  }

  interface SignatureRow {
    id: string;
    job_id: string;
    signer_type: string;
    signer_name: string;
    storage_path: string;
    created_at: string;
  }

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

  const mappedNotes = (notesRes.data as NoteRow[] || []).map((n) => ({
    ...n,
    author_name: n.profiles?.full_name || null,
    profiles: undefined,
  }));

  const filesWithUrls = await Promise.all(
    (filesRes.data as FileRow[] || []).map(async (f) => {
      const bucket = f.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
      const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(f.storage_path, 3600);
      return { ...f, signed_url: urlData?.signedUrl || null };
    })
  );

  const sigsWithUrls = await Promise.all(
    (sigsRes.data as SignatureRow[] || []).map(async (s) => {
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

router.patch("/jobs/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateJobBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const TECH_ALLOWED_FIELDS = new Set(["arrival_time", "departure_time", "status"]);
  if (req.userRole === "technician") {
    const bodyKeys = Object.keys(req.body).filter((k) => req.body[k] !== undefined);
    const forbidden = bodyKeys.filter((k) => !TECH_ALLOWED_FIELDS.has(k));
    if (forbidden.length > 0) {
      res.status(403).json({ error: "Technicians can only update arrival/departure time and status" });
      return;
    }
    const isOwner = await verifyTechnicianOwnership(params.data.id, req.userId, req.tenantId);
    if (!isOwner) {
      res.status(403).json({ error: "You can only update jobs assigned to you" });
      return;
    }
  }

  const fkChecks: Array<{ table: string; id: string | undefined | null }> = [
    { table: "customers", id: body.data.customer_id },
    { table: "properties", id: body.data.property_id },
    { table: "appliances", id: body.data.appliance_id },
    { table: "profiles", id: body.data.assigned_technician_id },
  ];
  const { valid, failedTable } = await verifyMultipleTenantOwnership(fkChecks, req.tenantId);
  if (!valid) { res.status(403).json({ error: `Referenced ${failedTable} does not belong to your company.` }); return; }

  const { job_type_id: rawUpdateJobTypeId, ...updateCoreData } = body.data as typeof body.data & { job_type_id?: number };

  if (updateCoreData.scheduled_end_date != null) {
    let effectiveStartDate: string;
    if (updateCoreData.scheduled_date) {
      effectiveStartDate = new Date(updateCoreData.scheduled_date as unknown as string).toISOString().slice(0, 10);
    } else {
      let existingQ = supabaseAdmin.from("jobs").select("scheduled_date").eq("id", params.data.id);
      if (req.tenantId) existingQ = existingQ.eq("tenant_id", req.tenantId);
      const { data: existing, error: existingErr } = await existingQ.single();
      if (existingErr || !existing) { res.status(404).json({ error: "Job not found" }); return; }
      effectiveStartDate = String(existing.scheduled_date).slice(0, 10);
    }
    if (updateCoreData.scheduled_end_date < effectiveStartDate) {
      res.status(400).json({ error: "End date cannot be before start date" }); return;
    }
  }

  const updatePayload: Record<string, unknown> = { ...updateCoreData };

  if (rawUpdateJobTypeId != null && req.tenantId) {
    const [jt] = await db.select().from(jobTypes).where(eq(jobTypes.id, rawUpdateJobTypeId));
    if (!jt || jt.tenant_id !== req.tenantId || !jt.is_active) {
      res.status(400).json({ error: "Invalid or inactive job type for this company" }); return;
    }
    updatePayload.job_type_id = jt.id;
    updatePayload.job_type = deriveJobTypeEnum(jt.category, jt.slug);
  }

  let q = supabaseAdmin.from("jobs").update(updatePayload).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error) {
    if (error.code === "23514") {
      res.status(400).json({ error: "End date cannot be before start date" }); return;
    }
    res.status(!data ? 404 : 500).json({ error: error.message }); return;
  }
  if (!data) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(UpdateJobResponse.parse(data));
});

router.get("/jobs/:id/parts", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let q = supabaseAdmin.from("job_parts").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/jobs/:id/parts", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  const { part_name, quantity, serial_number } = req.body;
  if (!part_name || typeof part_name !== "string") {
    res.status(400).json({ error: "part_name is required" }); return;
  }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let jobCheck = supabaseAdmin.from("jobs").select("id").eq("id", jobId);
  if (req.tenantId) jobCheck = jobCheck.eq("tenant_id", req.tenantId);
  const { data: jobExists } = await jobCheck.single();
  if (!jobExists) { res.status(404).json({ error: "Job not found" }); return; }

  const { data, error } = await supabaseAdmin.from("job_parts").insert({
    job_id: jobId,
    part_name: part_name.trim(),
    quantity: typeof quantity === "number" && quantity > 0 ? quantity : 1,
    serial_number: serial_number || null,
    tenant_id: req.tenantId,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.delete("/jobs/:id/parts/:partId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id: jobId, partId } = req.params;
  if (!jobId || !partId) { res.status(400).json({ error: "Missing ids" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let q = supabaseAdmin.from("job_parts").delete().eq("id", partId).eq("job_id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  await q;
  res.sendStatus(204);
});

router.get("/jobs/:id/time-entries", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let q = supabaseAdmin.from("job_time_entries").select("*, created_by_profile:profiles!job_time_entries_created_by_fkey(full_name)").eq("job_id", jobId).order("arrival_time", { ascending: true });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q;
  if (error) {
    let q2 = supabaseAdmin.from("job_time_entries").select("*").eq("job_id", jobId).order("arrival_time", { ascending: true });
    if (req.tenantId) q2 = q2.eq("tenant_id", req.tenantId);
    const { data: data2, error: error2 } = await q2;
    if (error2) { res.status(500).json({ error: error2.message }); return; }
    const entries = (data2 || []).map((e: Record<string, unknown>) => ({ ...e, created_by_name: null }));
    res.json(entries);
    return;
  }
  const entries = (data || []).map((e: Record<string, unknown>) => {
    const profile = e.created_by_profile as Record<string, unknown> | null;
    return { ...e, created_by_profile: undefined, created_by_name: profile?.full_name || null };
  });
  res.json(entries);
});

router.post("/jobs/:id/time-entries", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  const { arrival_time, departure_time, notes } = req.body;
  if (!arrival_time) {
    res.status(400).json({ error: "arrival_time is required" }); return;
  }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let jobCheck = supabaseAdmin.from("jobs").select("id").eq("id", jobId);
  if (req.tenantId) jobCheck = jobCheck.eq("tenant_id", req.tenantId);
  const { data: jobExists } = await jobCheck.single();
  if (!jobExists) { res.status(404).json({ error: "Job not found" }); return; }

  const { data, error } = await supabaseAdmin.from("job_time_entries").insert({
    job_id: jobId,
    arrival_time,
    departure_time: departure_time || null,
    notes: notes || null,
    created_by: req.userId,
    tenant_id: req.tenantId,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.delete("/jobs/:id/time-entries/:entryId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id: jobId, entryId } = req.params;
  if (!jobId || !entryId) { res.status(400).json({ error: "Missing ids" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let entryQ = supabaseAdmin.from("job_time_entries").select("created_by").eq("id", entryId).eq("job_id", jobId);
  if (req.tenantId) entryQ = entryQ.eq("tenant_id", req.tenantId);
  const { data: entry } = await entryQ.single();
  if (!entry) { res.status(404).json({ error: "Time entry not found" }); return; }

  const isAdmin = req.userRole === "admin" || req.userRole === "super_admin";
  const isAuthor = (entry as Record<string, unknown>).created_by === req.userId;
  if (!isAdmin && !isAuthor) {
    res.status(403).json({ error: "You can only delete your own time entries" }); return;
  }

  let delQ = supabaseAdmin.from("job_time_entries").delete().eq("id", entryId).eq("job_id", jobId);
  if (req.tenantId) delQ = delQ.eq("tenant_id", req.tenantId);
  await delQ;
  res.sendStatus(204);
});

router.delete("/jobs/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("jobs").update({ is_active: false }).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  await q;
  res.sendStatus(204);
});

export default router;
