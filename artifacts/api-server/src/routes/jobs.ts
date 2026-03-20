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
  scheduled_time: string | null;
  estimated_duration: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customers?: { first_name: string; last_name: string } | null;
  properties?: { address_line1: string } | null;
  profiles?: { full_name: string } | null;
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
    if (query.data.date_from) q = q.gte("scheduled_date", query.data.date_from);
    if (query.data.date_to) q = q.lte("scheduled_date", query.data.date_to);
  }

  if (req.userRole === "technician") {
    q = q.eq("assigned_technician_id", req.userId!);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const rawMapped = (data as SupabaseJobRow[] || []).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  }));

  const enriched = await enrichJobsWithTypeNames(rawMapped);
  res.json(ListJobsResponse.parse(enriched));
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
  if (error) { res.status(500).json({ error: error.message }); return; }

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

router.patch("/jobs/:id", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateJobBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const fkChecks: Array<{ table: string; id: string | undefined | null }> = [
    { table: "customers", id: body.data.customer_id },
    { table: "properties", id: body.data.property_id },
    { table: "appliances", id: body.data.appliance_id },
    { table: "profiles", id: body.data.assigned_technician_id },
  ];
  const { valid, failedTable } = await verifyMultipleTenantOwnership(fkChecks, req.tenantId);
  if (!valid) { res.status(403).json({ error: `Referenced ${failedTable} does not belong to your company.` }); return; }

  let q = supabaseAdmin.from("jobs").update(body.data).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error || !data) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(UpdateJobResponse.parse(data));
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
