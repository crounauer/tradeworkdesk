import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, jobTypes } from "@workspace/db";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, getTenantFeatures, type AuthenticatedRequest } from "../middlewares/auth";
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
import {
  generateUniversalCSV,
  generateQuickBooksIIF,
  generateXeroCSV,
  generateSageCSV,
  generateInvoiceNumber,
  type InvoiceData,
  type InvoiceLineItem,
} from "../lib/invoice-export";
import { sendJobFormsEmail } from "../lib/email";

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
  properties?: { address_line1: string; latitude?: number | null; longitude?: number | null; postcode?: string | null } | null;
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

router.get("/jobs", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  let q = supabaseAdmin
    .from("jobs")
    .select("*, customers(first_name, last_name), properties(address_line1, latitude, longitude, postcode), profiles(full_name)")
    .eq("is_active", true)
    .order("scheduled_date", { ascending: false })
    .order("created_at", { ascending: false });

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

  const tenantFeatures = req.tenantId ? await getTenantFeatures(req.tenantId) : null;
  const hasGeoMapping = !!(tenantFeatures?.geo_mapping);

  const typeMap = new Map(allTypes.map((t) => [t.id, t.name]));
  const rawMapped = (data as SupabaseJobRow[] || []).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    job_type_name: j.job_type_id != null ? (typeMap.get(j.job_type_id) ?? null) : null,
    property_latitude: hasGeoMapping ? (j.properties?.latitude ?? null) : null,
    property_longitude: hasGeoMapping ? (j.properties?.longitude ?? null) : null,
    property_postcode: hasGeoMapping ? (j.properties?.postcode ?? null) : null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  }));

  res.set("Cache-Control", "private, no-cache");
  res.json(ListJobsResponse.parse(rawMapped));
});

router.post("/jobs", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

router.patch("/jobs/:id", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

  if (body.data.status === "invoiced") {
    const isAdmin = req.userRole === "admin" || req.userRole === "super_admin";
    if (!isAdmin) {
      res.status(403).json({ error: "Only admins can mark a job as invoiced" });
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

router.get("/jobs/:id/parts", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

router.post("/jobs/:id/parts", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  const { part_name, quantity, serial_number, unit_price } = req.body;
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
    unit_price: typeof unit_price === "number" && unit_price >= 0 ? unit_price : null,
    tenant_id: req.tenantId,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.delete("/jobs/:id/parts/:partId", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

router.get("/jobs/:id/time-entries", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let q = supabaseAdmin.from("job_time_entries").select("*").eq("job_id", jobId).order("arrival_time", { ascending: true });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const rawEntries = data || [];
  const creatorIds = [...new Set(rawEntries.map((e: Record<string, unknown>) => e.created_by).filter(Boolean))] as string[];
  let profileMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", creatorIds);
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p: Record<string, unknown>) => [p.id as string, p.full_name as string]));
    }
  }
  const entries = rawEntries.map((e: Record<string, unknown>) => ({
    ...e,
    created_by_name: (e.created_by ? profileMap[e.created_by as string] : null) || null,
  }));
  res.json(entries);
});

router.post("/jobs/:id/time-entries", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  const { arrival_time, departure_time, notes, hourly_rate } = req.body;
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
    hourly_rate: hourly_rate != null ? parseFloat(hourly_rate) : null,
    created_by: req.userId,
    tenant_id: req.tenantId,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/jobs/:id/time-entries/:entryId", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id: jobId, entryId } = req.params;
  if (!jobId || !entryId) { res.status(400).json({ error: "Missing ids" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let entryQ = supabaseAdmin.from("job_time_entries").select("created_by").eq("id", entryId).eq("job_id", jobId);
  if (req.tenantId) entryQ = entryQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await entryQ.single();
  if (!existing) { res.status(404).json({ error: "Time entry not found" }); return; }

  const isAdmin = req.userRole === "admin" || req.userRole === "super_admin";
  const isAuthor = (existing as Record<string, unknown>).created_by === req.userId;
  if (!isAdmin && !isAuthor) {
    res.status(403).json({ error: "You can only edit your own time entries" }); return;
  }

  const { arrival_time, departure_time, notes, hourly_rate } = req.body;
  const updates: Record<string, unknown> = {};
  if (arrival_time !== undefined) updates.arrival_time = arrival_time;
  if (departure_time !== undefined) updates.departure_time = departure_time || null;
  if (notes !== undefined) updates.notes = notes || null;
  if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate != null ? parseFloat(hourly_rate) : null;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  let upQ = supabaseAdmin.from("job_time_entries").update(updates).eq("id", entryId).eq("job_id", jobId);
  if (req.tenantId) upQ = upQ.eq("tenant_id", req.tenantId);
  const { data, error } = await upQ.select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete("/jobs/:id/time-entries/:entryId", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

router.patch("/jobs/:id/parts/:partId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id: jobId, partId } = req.params;
  if (!jobId || !partId) { res.status(400).json({ error: "Missing ids" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  const { part_name, quantity, serial_number, unit_price } = req.body;
  const updates: Record<string, unknown> = {};
  if (part_name !== undefined) updates.part_name = String(part_name).trim();
  if (quantity !== undefined) updates.quantity = typeof quantity === "number" && quantity > 0 ? quantity : 1;
  if (serial_number !== undefined) updates.serial_number = serial_number || null;
  if (unit_price !== undefined) updates.unit_price = typeof unit_price === "number" && unit_price >= 0 ? unit_price : null;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  let q = supabaseAdmin.from("job_parts").update(updates).eq("id", partId).eq("job_id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Part not found" }); return; }
  res.json(data);
});

async function buildInvoiceData(
  jobId: string,
  tenantId: string | null | undefined
): Promise<InvoiceData | null> {
  let jobQ = supabaseAdmin.from("jobs").select("*, customers(first_name, last_name, email, address_line1, address_line2, city, county, postcode)").eq("id", jobId);
  if (tenantId) jobQ = jobQ.eq("tenant_id", tenantId);
  const { data: job } = await jobQ.single();
  if (!job) return null;

  let settingsQ = supabaseAdmin.from("company_settings").select("*").eq("singleton_id", "default");
  if (tenantId) settingsQ = settingsQ.eq("tenant_id", tenantId);
  const { data: settings } = await settingsQ.maybeSingle();

  let partsQ = supabaseAdmin.from("job_parts").select("*").eq("job_id", jobId);
  if (tenantId) partsQ = partsQ.eq("tenant_id", tenantId);
  const { data: parts } = await partsQ;

  let timeQ = supabaseAdmin.from("job_time_entries").select("arrival_time, departure_time, hourly_rate").eq("job_id", jobId);
  if (tenantId) timeQ = timeQ.eq("tenant_id", tenantId);
  const { data: timeEntries } = await timeQ;

  const defaultHourlyRate = Number(settings?.default_hourly_rate) || 0;
  const callOutFee = Number(settings?.call_out_fee) || 0;
  const rawVat = Number(settings?.default_vat_rate);
  const vatRate = Number.isFinite(rawVat) ? rawVat : 20;
  const paymentTermsDays = Number(settings?.default_payment_terms_days) || 30;
  const currency = settings?.currency || "GBP";

  const customer = job.customers as { first_name: string; last_name: string; email?: string; address_line1?: string; address_line2?: string; city?: string; county?: string; postcode?: string } | null;
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown";
  const customerAddressParts = [customer?.address_line1, customer?.address_line2, customer?.city, customer?.county, customer?.postcode].filter(Boolean);

  const companyAddressParts = [settings?.address_line1, settings?.address_line2, settings?.city, settings?.county, settings?.postcode].filter(Boolean);

  let totalLabourHours = 0;
  let totalLabourCost = 0;
  if (timeEntries) {
    for (const e of timeEntries as { arrival_time: string; departure_time: string | null; hourly_rate: number | null }[]) {
      if (e.arrival_time && e.departure_time) {
        const diffMs = new Date(e.departure_time).getTime() - new Date(e.arrival_time).getTime();
        if (diffMs > 0) {
          const hours = diffMs / (1000 * 60 * 60);
          totalLabourHours += hours;
          const rate = e.hourly_rate != null ? Number(e.hourly_rate) : defaultHourlyRate;
          if (rate > 0) totalLabourCost += hours * rate;
        }
      }
    }
  }
  totalLabourHours = Math.round(totalLabourHours * 100) / 100;
  totalLabourCost = Math.round(totalLabourCost * 100) / 100;

  const lines: InvoiceLineItem[] = [];

  if (parts) {
    for (const p of parts as { part_name: string; quantity: number; unit_price: number | null }[]) {
      const up = Number(p.unit_price) || 0;
      lines.push({
        description: p.part_name,
        quantity: p.quantity,
        unit_price: up,
        total: up * p.quantity,
      });
    }
  }

  if (totalLabourCost > 0) {
    const effectiveRate = totalLabourHours > 0 ? Math.round(totalLabourCost / totalLabourHours * 100) / 100 : 0;
    lines.push({
      description: "Labour",
      quantity: totalLabourHours,
      unit_price: effectiveRate,
      total: totalLabourCost,
    });
  }

  if (callOutFee > 0) {
    lines.push({
      description: "Call-out Fee",
      quantity: 1,
      unit_price: callOutFee,
      total: callOutFee,
    });
  }

  const partsTotal = lines.filter(l => l.description !== "Labour" && l.description !== "Call-out Fee").reduce((sum, l) => sum + l.total, 0);
  const labourTotal = lines.filter(l => l.description === "Labour").reduce((sum, l) => sum + l.total, 0);
  const callOutTotal = callOutFee > 0 ? callOutFee : 0;

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const vatAmount = Math.round(subtotal * vatRate / 100 * 100) / 100;
  const total = subtotal + vatAmount;

  const invoiceDate = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + paymentTermsDays * 86400000).toISOString().slice(0, 10);
  const invoiceNumber = generateInvoiceNumber(job.created_at, job.id.substring(0, 6));

  return {
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    currency,
    company_name: settings?.name || settings?.trading_name || "",
    company_address: companyAddressParts.join(", "),
    company_email: settings?.email || "",
    company_phone: settings?.phone || "",
    company_vat_number: settings?.vat_number || "",
    customer_name: customerName,
    customer_email: customer?.email || "",
    customer_address: customerAddressParts.join(", "),
    job_id: job.id,
    job_type: job.job_type,
    job_description: job.description || `${job.job_type} job`,
    lines,
    parts_total: partsTotal,
    labour_total: labourTotal,
    call_out_fee: callOutTotal,
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total,
  };
}

router.get("/jobs/:id/invoice-summary", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("invoicing"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const invoiceData = await buildInvoiceData(req.params.id, req.tenantId);
  if (!invoiceData) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(invoiceData);
});

router.get("/jobs/:id/invoice-export", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("invoicing"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const format = (req.query.format as string) || "csv";

  let statusQ = supabaseAdmin.from("jobs").select("status").eq("id", req.params.id);
  if (req.tenantId) statusQ = statusQ.eq("tenant_id", req.tenantId);
  const { data: jobRow } = await statusQ.single();
  if (!jobRow) { res.status(404).json({ error: "Job not found" }); return; }
  if (jobRow.status !== "completed" && jobRow.status !== "invoiced") {
    res.status(400).json({ error: "Only completed or invoiced jobs can be exported" }); return;
  }

  const invoiceData = await buildInvoiceData(req.params.id, req.tenantId);
  if (!invoiceData) { res.status(404).json({ error: "Job not found" }); return; }

  const safeName = invoiceData.customer_name.replace(/[^a-zA-Z0-9]/g, "-");
  let content: string;
  let contentType: string;
  let ext: string;

  switch (format) {
    case "quickbooks":
      content = generateQuickBooksIIF([invoiceData]);
      contentType = "text/plain";
      ext = "iif";
      break;
    case "xero":
      content = generateXeroCSV([invoiceData]);
      contentType = "text/csv";
      ext = "csv";
      break;
    case "sage":
      content = generateSageCSV([invoiceData]);
      contentType = "text/csv";
      ext = "csv";
      break;
    default:
      content = generateUniversalCSV([invoiceData]);
      contentType = "text/csv";
      ext = "csv";
  }

  const filename = `${invoiceData.invoice_number}-${safeName}.${ext}`;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(content);
});

router.post("/jobs/bulk-invoice-export", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("invoicing"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { job_ids, format } = req.body as { job_ids?: string[]; format?: string };
  if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
    res.status(400).json({ error: "job_ids array is required" }); return;
  }
  if (job_ids.length > 100) {
    res.status(400).json({ error: "Maximum 100 jobs per export" }); return;
  }

  let statusQ = supabaseAdmin.from("jobs").select("id, status").in("id", job_ids);
  if (req.tenantId) statusQ = statusQ.eq("tenant_id", req.tenantId);
  const { data: jobRows } = await statusQ;
  const exportableIds = (jobRows || [])
    .filter((j: { status: string }) => j.status === "completed" || j.status === "invoiced")
    .map((j: { id: string }) => j.id);

  if (exportableIds.length === 0) {
    res.status(400).json({ error: "No completed or invoiced jobs found in the selection" }); return;
  }

  const invoices: InvoiceData[] = [];
  for (const jid of exportableIds) {
    const data = await buildInvoiceData(jid, req.tenantId);
    if (data) invoices.push(data);
  }

  if (invoices.length === 0) { res.status(404).json({ error: "No valid jobs found" }); return; }

  let content: string;
  let contentType: string;
  let ext: string;
  const fmt = format || "csv";

  switch (fmt) {
    case "quickbooks":
      content = generateQuickBooksIIF(invoices);
      contentType = "text/plain";
      ext = "iif";
      break;
    case "xero":
      content = generateXeroCSV(invoices);
      contentType = "text/csv";
      ext = "csv";
      break;
    case "sage":
      content = generateSageCSV(invoices);
      contentType = "text/csv";
      ext = "csv";
      break;
    default:
      content = generateUniversalCSV(invoices);
      contentType = "text/csv";
      ext = "csv";
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `bulk-invoices-${date}.${ext}`;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(content);
});

router.post("/quick-record", requireAuth, requireTenant, requireRole("admin", "office_staff", "technician"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { customer_id, property_id, appliance_id, form_type, description } = req.body;

  if (!customer_id || !property_id || !form_type) {
    res.status(400).json({ error: "customer_id, property_id, and form_type are required" });
    return;
  }

  const validFormTypes: Record<string, { jobType: string; feature: string | null }> = {
    "service-record": { jobType: "service", feature: null },
    "breakdown-report": { jobType: "breakdown", feature: null },
    "commissioning": { jobType: "installation", feature: "commissioning_forms" },
    "oil-tank-inspection": { jobType: "inspection", feature: "oil_tank_forms" },
    "oil-tank-risk-assessment": { jobType: "inspection", feature: "oil_tank_forms" },
    "combustion-analysis": { jobType: "service", feature: "combustion_analysis" },
    "burner-setup": { jobType: "service", feature: "oil_tank_forms" },
    "fire-valve-test": { jobType: "inspection", feature: "oil_tank_forms" },
    "oil-line-vacuum-test": { jobType: "inspection", feature: "oil_tank_forms" },
    "job-completion": { jobType: "service", feature: null },
    "heat-pump-service": { jobType: "service", feature: "heat_pump_forms" },
    "heat-pump-commissioning": { jobType: "installation", feature: "heat_pump_forms" },
  };

  const formConfig = validFormTypes[form_type];
  if (!formConfig) {
    res.status(400).json({ error: `Invalid form_type: ${form_type}` });
    return;
  }

  if (formConfig.feature) {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("plan_id, plans(features)")
      .eq("id", req.tenantId)
      .single();
    const features = (tenant?.plans as { features?: Record<string, unknown> } | null)?.features ?? {};
    if (!(features as Record<string, boolean>)[formConfig.feature]) {
      res.status(402).json({ error: `Your plan does not include access to this form type. Please upgrade.` });
      return;
    }
  }

  const fkChecks: Array<{ table: string; id: string }> = [
    { table: "customers", id: customer_id },
    { table: "properties", id: property_id },
  ];
  if (appliance_id) fkChecks.push({ table: "appliances", id: appliance_id });

  const ownershipResult = await verifyMultipleTenantOwnership(
    fkChecks,
    req.tenantId,
  );
  if (!ownershipResult.valid) {
    res.status(400).json({ error: ownershipResult.error || "Invalid references" });
    return;
  }

  const { data: prop } = await supabaseAdmin
    .from("properties")
    .select("customer_id")
    .eq("id", property_id)
    .single();
  if (prop && prop.customer_id !== customer_id) {
    res.status(400).json({ error: "Property does not belong to selected customer" });
    return;
  }

  if (appliance_id) {
    const { data: appliance } = await supabaseAdmin
      .from("appliances")
      .select("property_id")
      .eq("id", appliance_id)
      .single();
    if (appliance && appliance.property_id !== property_id) {
      res.status(400).json({ error: "Appliance does not belong to selected property" });
      return;
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const jobPayload: Record<string, unknown> = {
    customer_id,
    property_id,
    job_type: formConfig.jobType,
    priority: "medium",
    status: "in_progress",
    scheduled_date: today,
    description: description || `Quick record - ${form_type.replace(/-/g, " ")}`,
    tenant_id: req.tenantId,
    assigned_technician_id: req.userId,
  };

  if (appliance_id) {
    jobPayload.appliance_id = appliance_id;
  }

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .insert(jobPayload)
    .select("id")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({
    job_id: job.id,
    form_url: `/jobs/${job.id}/${form_type}`,
  });
});

const FORM_TABLE_MAP: Record<string, { table: string; label: string; fieldMap: Record<string, string> }> = {
  service_record: {
    table: "service_records",
    label: "Service Record",
    fieldMap: {
      boiler_manufacturer: "Boiler Manufacturer", boiler_model: "Boiler Model", boiler_serial: "Boiler Serial",
      gc_number: "GC Number", boiler_type: "Boiler Type", boiler_location: "Boiler Location",
      flue_type: "Flue Type", flue_condition: "Flue Condition", ventilation_adequate: "Ventilation Adequate",
      gas_pressure_inlet: "Gas Pressure (Inlet)", gas_pressure_outlet: "Gas Pressure (Outlet)",
      gas_rate: "Gas Rate", burner_pressure: "Burner Pressure", burner_condition: "Burner Condition",
      heat_exchanger_condition: "Heat Exchanger Condition", ignition_condition: "Ignition Condition",
      safety_devices_tested: "Safety Devices Tested", co_reading: "CO Reading", co2_reading: "CO2 Reading",
      ratio: "Ratio", flue_flow_test: "Flue Flow Test", spillage_test: "Spillage Test",
      visual_condition: "Visual Condition", operation_check: "Operation Check",
      condensate_trap: "Condensate Trap", condensate_pipe: "Condensate Pipe",
      system_pressure: "System Pressure", expansion_vessel: "Expansion Vessel",
      next_service_due: "Next Service Due", overall_result: "Overall Result",
      landlord_property: "Landlord Property", additional_notes: "Additional Notes",
    },
  },
  breakdown_report: {
    table: "breakdown_reports",
    label: "Breakdown Report",
    fieldMap: {
      fault_reported: "Fault Reported", fault_found: "Fault Found", fault_code: "Fault Code",
      parts_required: "Parts Required", parts_fitted: "Parts Fitted", repair_description: "Repair Description",
      repair_completed: "Repair Completed", follow_up_required: "Follow-up Required",
      follow_up_notes: "Follow-up Notes", additional_notes: "Additional Notes",
    },
  },
  commissioning_record: {
    table: "commissioning_records",
    label: "Commissioning Record",
    fieldMap: {
      appliance_manufacturer: "Manufacturer", appliance_model: "Model", appliance_serial: "Serial",
      appliance_type: "Type", flue_type: "Flue Type", location: "Location",
      gas_type: "Gas Type", gas_inlet_pressure: "Gas Inlet Pressure",
      gas_rate_reading: "Gas Rate Reading", burner_operating_pressure: "Burner Operating Pressure",
      flue_gas_co: "Flue Gas CO", flue_gas_co2: "Flue Gas CO2", flue_gas_ratio: "Flue Gas Ratio",
      flue_temperature: "Flue Temperature", return_temperature: "Return Temperature",
      flow_temperature: "Flow Temperature", system_pressure: "System Pressure",
      expansion_vessel_charge: "Expansion Vessel Charge", safety_valve: "Safety Valve",
      ventilation_check: "Ventilation Check", flue_visual_check: "Flue Visual Check",
      condensate_check: "Condensate Check", controls_check: "Controls Check",
      user_instructions_given: "User Instructions Given", benchmark_completed: "Benchmark Completed",
      commissioning_result: "Commissioning Result", additional_notes: "Additional Notes",
    },
  },
  job_completion_report: {
    table: "job_completion_reports",
    label: "Job Completion Report",
    fieldMap: {
      work_summary: "Work Summary", work_completed: "Work Completed",
      recommendations: "Recommendations", customer_informed: "Customer Informed",
      site_left_clean: "Site Left Clean", follow_up_required: "Follow-up Required",
      follow_up_notes: "Follow-up Notes", additional_notes: "Additional Notes",
    },
  },
  burner_setup_record: {
    table: "burner_setup_records",
    label: "Burner Setup Record",
    fieldMap: {
      burner_manufacturer: "Burner Manufacturer", burner_model: "Burner Model",
      burner_serial_number: "Burner Serial Number", nozzle_size: "Nozzle Size",
      nozzle_type: "Nozzle Type", nozzle_angle: "Nozzle Angle",
      pump_pressure: "Pump Pressure", pump_vacuum: "Pump Vacuum",
      electrode_gap: "Electrode Gap", electrode_position: "Electrode Position",
      air_damper_setting: "Air Damper Setting", head_setting: "Head Setting",
      combustion_co2: "Combustion CO2", combustion_co: "Combustion CO",
      combustion_smoke: "Combustion Smoke", combustion_efficiency: "Combustion Efficiency",
      additional_notes: "Additional Notes",
    },
  },
  combustion_analysis_record: {
    table: "combustion_analysis_records",
    label: "Combustion Analysis",
    fieldMap: {
      co2_reading: "CO2 Reading", co_reading: "CO Reading", o2_reading: "O2 Reading",
      flue_temperature: "Flue Temperature", ambient_temperature: "Ambient Temperature",
      efficiency: "Efficiency", excess_air: "Excess Air", smoke_number: "Smoke Number",
      ambient_co: "Ambient CO", draft_reading: "Draft Reading",
      instrument_make: "Instrument Make", instrument_model: "Instrument Model",
      instrument_serial: "Instrument Serial", calibration_date: "Calibration Date",
      pass_fail: "Pass/Fail", additional_notes: "Additional Notes",
    },
  },
  fire_valve_test_record: {
    table: "fire_valve_test_records",
    label: "Fire Valve Test",
    fieldMap: {
      valve_location: "Valve Location", valve_type: "Valve Type",
      valve_manufacturer: "Valve Manufacturer", test_date: "Test Date",
      test_method: "Test Method", test_result: "Test Result",
      response_time: "Response Time", reset_successful: "Reset Successful",
      remedial_action: "Remedial Action", additional_notes: "Additional Notes",
    },
  },
  oil_line_vacuum_test: {
    table: "oil_line_vacuum_tests",
    label: "Oil Line Vacuum Test",
    fieldMap: {
      pipe_size: "Pipe Size", pipe_material: "Pipe Material", pipe_length: "Pipe Length",
      number_of_joints: "Number of Joints", initial_vacuum: "Initial Vacuum",
      vacuum_after_5_min: "Vacuum After 5 Min", vacuum_after_10_min: "Vacuum After 10 Min",
      allowable_drop: "Allowable Drop", actual_drop: "Actual Drop",
      pass_fail: "Pass/Fail", remedial_action: "Remedial Action",
      additional_notes: "Additional Notes",
    },
  },
  oil_tank_inspection: {
    table: "oil_tank_inspections",
    label: "Oil Tank Inspection",
    fieldMap: {
      tank_type: "Tank Type", tank_size: "Tank Size", tank_material: "Tank Material",
      tank_location: "Tank Location", tank_age: "Tank Age",
      bunding_type: "Bunding Type", bunding_condition: "Bunding Condition",
      sight_gauge_condition: "Sight Gauge Condition", fill_point_condition: "Fill Point Condition",
      vent_condition: "Vent Condition", filter_condition: "Filter Condition",
      pipework_condition: "Pipework Condition", supports_condition: "Supports Condition",
      overall_condition: "Overall Condition", leaks_found: "Leaks Found",
      leaks_details: "Leaks Details", remedial_actions: "Remedial Actions",
      additional_notes: "Additional Notes",
    },
  },
  oil_tank_risk_assessment: {
    table: "oil_tank_risk_assessments",
    label: "Oil Tank Risk Assessment",
    fieldMap: {
      site_hazards: "Site Hazards", environmental_risks: "Environmental Risks",
      fire_risk: "Fire Risk", access_risk: "Access Risk",
      likelihood_rating: "Likelihood Rating", severity_rating: "Severity Rating",
      overall_risk_rating: "Overall Risk Rating", control_measures: "Control Measures",
      further_actions_required: "Further Actions Required",
      assessor_name: "Assessor Name", assessor_qualification: "Assessor Qualification",
      assessment_date: "Assessment Date", additional_notes: "Additional Notes",
    },
  },
  heat_pump_service_record: {
    table: "heat_pump_service_records",
    label: "Heat Pump Service",
    fieldMap: {
      hp_manufacturer: "Manufacturer", hp_model: "Model", hp_serial: "Serial Number",
      hp_type: "HP Type", refrigerant_type: "Refrigerant Type",
      refrigerant_charge: "Refrigerant Charge", suction_pressure: "Suction Pressure",
      discharge_pressure: "Discharge Pressure", superheat: "Superheat", subcooling: "Subcooling",
      flow_temp: "Flow Temperature", return_temp: "Return Temperature",
      ambient_temp: "Ambient Temperature", cop_reading: "COP Reading",
      defrost_operation: "Defrost Operation", filter_condition: "Filter Condition",
      electrical_connections: "Electrical Connections", controls_check: "Controls Check",
      overall_condition: "Overall Condition", additional_notes: "Additional Notes",
    },
  },
  heat_pump_commissioning_record: {
    table: "heat_pump_commissioning_records",
    label: "Heat Pump Commissioning",
    fieldMap: {
      hp_manufacturer: "Manufacturer", hp_model: "Model", hp_serial: "Serial Number",
      hp_type: "HP Type", refrigerant_type: "Refrigerant Type",
      design_flow_temp: "Design Flow Temp", design_return_temp: "Design Return Temp",
      actual_flow_temp: "Actual Flow Temp", actual_return_temp: "Actual Return Temp",
      flow_rate: "Flow Rate", system_pressure: "System Pressure",
      expansion_vessel: "Expansion Vessel", safety_valve: "Safety Valve",
      antifreeze_check: "Antifreeze Check", electrical_supply: "Electrical Supply",
      controls_programmed: "Controls Programmed", weather_comp_set: "Weather Comp Set",
      legionella_cycle: "Legionella Cycle", mcs_compliance: "MCS Compliance",
      user_demo_given: "User Demo Given", commissioning_result: "Commissioning Result",
      additional_notes: "Additional Notes",
    },
  },
};

router.get("/jobs/:jobId/completed-forms", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.jobId;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  const completed: Array<{ form_type: string; form_label: string; form_id: string }> = [];

  for (const [formType, config] of Object.entries(FORM_TABLE_MAP)) {
    let q = supabaseAdmin.from(config.table).select("id").eq("job_id", jobId);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    const { data: records } = await q;
    if (records && records.length > 0) {
      for (const rec of records) {
        completed.push({ form_type: formType, form_label: config.label, form_id: (rec as Record<string, unknown>).id as string });
      }
    }
  }

  res.json(completed);
});

router.post("/jobs/:jobId/email-forms", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.jobId;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  const { to, cc, forms } = req.body as { to?: string; cc?: string; forms?: Array<{ form_type: string; form_id: string }> };
  if (!to || !forms || !Array.isArray(forms) || forms.length === 0) {
    res.status(400).json({ error: "to (email) and forms (array of {form_type, form_id}) are required" }); return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(to)) { res.status(400).json({ error: "Invalid recipient email address" }); return; }
  if (cc && !emailRe.test(cc)) { res.status(400).json({ error: "Invalid CC email address" }); return; }

  for (const f of forms) {
    if (!f.form_type || !f.form_id) { res.status(400).json({ error: "Each form entry must have form_type and form_id" }); return; }
    if (!FORM_TABLE_MAP[f.form_type]) { res.status(400).json({ error: `Unknown form type: ${f.form_type}` }); return; }
  }

  let jobQ = supabaseAdmin.from("jobs").select("*, customers(first_name, last_name, email), profiles(full_name)").eq("id", jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error: jobErr } = await jobQ.single();
  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    res.status(403).json({ error: "You can only email forms for jobs assigned to you" }); return;
  }

  let tenantQ = supabaseAdmin.from("tenants").select("company_name").eq("id", req.tenantId!);
  const { data: tenant } = await tenantQ.single();
  const companyName = (tenant as Record<string, unknown>)?.company_name as string || "Your Service Provider";

  const sections: Array<{ formType: string; formLabel: string; fields: Array<{ label: string; value: string }> }> = [];
  const formsIncluded: Array<{ form_type: string; form_label: string; form_id: string }> = [];

  for (const { form_type: formType, form_id: formId } of forms) {
    const config = FORM_TABLE_MAP[formType];
    if (!config) continue;

    let q = supabaseAdmin.from(config.table).select("*").eq("id", formId).eq("job_id", jobId);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    const { data: record, error: recErr } = await q.maybeSingle();
    if (recErr) { console.error(`[email] Error fetching ${formType} record ${formId}:`, recErr); continue; }
    if (!record) continue;

    const fields: Array<{ label: string; value: string }> = [];
    for (const [col, label] of Object.entries(config.fieldMap)) {
      const val = (record as Record<string, unknown>)[col];
      if (val != null && val !== "" && val !== "null") {
        let displayVal = String(val);
        if (typeof val === "boolean") displayVal = val ? "Yes" : "No";
        fields.push({ label, value: displayVal });
      }
    }

    if (fields.length > 0) {
      sections.push({ formType, formLabel: config.label, fields });
      formsIncluded.push({ form_type: formType, form_label: config.label, form_id: formId });
    }
  }

  if (sections.length === 0) {
    res.status(400).json({ error: "No completed forms found for the selected entries" }); return;
  }

  const customer = job.customers as { first_name: string; last_name: string } | null;
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Customer";
  const jobRef = `#${job.id.slice(0, 8)}`;
  const subject = `Job ${jobRef} — Service Forms from ${companyName}`;

  try {
    await sendJobFormsEmail(to, cc || null, subject, jobRef, customerName, companyName, sections);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send email";
    res.status(500).json({ error: msg }); return;
  }

  const { data: senderProfile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", req.userId!).single();

  const { error: logErr } = await supabaseAdmin.from("job_email_logs").insert({
    job_id: jobId,
    tenant_id: req.tenantId,
    sent_by: req.userId,
    sent_to: to,
    cc: cc || null,
    subject,
    forms_included: formsIncluded,
  });
  if (logErr) {
    console.error("[email] Failed to log email send:", logErr);
  }

  res.json({
    success: true,
    message: `Email sent to ${to}`,
    forms_sent: formsIncluded.map(f => f.form_label),
    sender_name: (senderProfile as Record<string, unknown>)?.full_name || null,
  });
});

router.get("/jobs/:jobId/email-log", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.jobId;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let q = supabaseAdmin.from("job_email_logs").select("*, profiles(full_name)").eq("job_id", jobId).order("created_at", { ascending: false });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((entry: Record<string, unknown>) => ({
    id: entry.id,
    job_id: entry.job_id,
    sent_by: entry.sent_by,
    sent_by_name: (entry.profiles as Record<string, unknown>)?.full_name || null,
    sent_to: entry.sent_to,
    cc: entry.cc,
    subject: entry.subject,
    forms_included: entry.forms_included,
    created_at: entry.created_at,
  }));

  res.json(mapped);
});

router.delete("/jobs/:id", requireAuth, requireTenant, requireRole("admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("jobs").update({ is_active: false }).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  await q;
  res.sendStatus(204);
});

export default router;
