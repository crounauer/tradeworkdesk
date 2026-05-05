import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, requirePlanFeature, getTenantFeatures, type AuthenticatedRequest } from "../middlewares/auth";
import { verifyMultipleTenantOwnership } from "../lib/tenant-validation";
import { getEffectiveLimits, getJobsThisMonth } from "../lib/tenant-limits";

const SINGLETON_ID = "default";
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
import { sendJobFormsEmail, sendJobConfirmationEmail, type EmailAttachment, type EmailCompanyDetails, type JobConfirmationDetails } from "../lib/email";
import { generateFormPdf, type PdfCompanySettings } from "../lib/pdf-forms";

interface SupabaseJobRow {
  id: string;
  customer_id: string;
  property_id: string;
  appliance_id: string | null;
  assigned_technician_id: string | null;
  job_type: string;
  job_type_id: number | null;
  fuel_category: string | null;
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

  const { data: types } = await supabaseAdmin
    .from("job_types")
    .select("id, name")
    .in("id", typeIds);

  const typeMap = new Map((types || []).map((t: { id: number; name: string }) => [t.id, t.name]));

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

const jobsListCache = new Map<string, { data: unknown; ts: number }>();
const JOBS_CACHE_TTL_MS = 30_000;

// job_types change very rarely (admin creates them manually); cache per tenant for 5 minutes
const jobTypesCache = new Map<string, { data: Array<{ id: number; name: string }>; ts: number }>();
const JOB_TYPES_CACHE_TTL_MS = 5 * 60_000;

async function getJobTypesForTenant(tenantId: string | undefined): Promise<Array<{ id: number; name: string }>> {
  const key = tenantId ?? "__all__";
  const cached = jobTypesCache.get(key);
  if (cached && Date.now() - cached.ts < JOB_TYPES_CACHE_TTL_MS) return cached.data;
  const { data } = tenantId
    ? await supabaseAdmin.from("job_types").select("id, name").eq("tenant_id", tenantId)
    : await supabaseAdmin.from("job_types").select("id, name");
  const result = (data as Array<{ id: number; name: string }>) || [];
  jobTypesCache.set(key, { data: result, ts: Date.now() });
  return result;
}

function invalidateJobTypesCache(tenantId?: string | null) {
  jobTypesCache.delete(tenantId ?? "__all__");
}

function invalidateJobsCache(tenantId?: string | null) {
  if (!tenantId) { jobsListCache.clear(); return; }
  for (const key of jobsListCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) jobsListCache.delete(key);
  }
}

router.get("/jobs", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);

  const limit = Math.min(query.success && query.data.limit ? query.data.limit : 50, 500);
  const page = query.success && query.data.page ? query.data.page : 1;
  const offset = (page - 1) * limit;
  const searchTerm = query.success ? query.data.search : undefined;

  let countQ = supabaseAdmin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  let q = supabaseAdmin
    .from("jobs")
    .select("id, job_ref, customer_id, property_id, appliance_id, assigned_technician_id, job_type, job_type_id, fuel_category, status, priority, description, scheduled_date, scheduled_end_date, scheduled_time, estimated_duration, arrival_time, departure_time, is_active, created_at, updated_at, tenant_id, customers(first_name, last_name, is_active), properties(address_line1, address_line2, city, county, postcode, latitude, longitude), profiles(full_name)")
    .eq("is_active", true)
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("scheduled_time", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (req.tenantId) {
    q = q.eq("tenant_id", req.tenantId);
    countQ = countQ.eq("tenant_id", req.tenantId);
  }

  if (query.success) {
    if (query.data.status) { q = q.eq("status", query.data.status); countQ = countQ.eq("status", query.data.status); }
    if (query.data.job_type) { q = q.eq("job_type", query.data.job_type); countQ = countQ.eq("job_type", query.data.job_type); }
    if (query.data.technician_id) { q = q.eq("assigned_technician_id", query.data.technician_id); countQ = countQ.eq("assigned_technician_id", query.data.technician_id); }
    if (query.data.customer_id) { q = q.eq("customer_id", query.data.customer_id); countQ = countQ.eq("customer_id", query.data.customer_id); }
    if (query.data.property_id) { q = q.eq("property_id", query.data.property_id); countQ = countQ.eq("property_id", query.data.property_id); }
    if (query.data.date_from) {
      const df = query.data.date_from instanceof Date
        ? query.data.date_from.toISOString().slice(0, 10)
        : String(query.data.date_from);
      q = q.or(`scheduled_date.gte.${df},scheduled_end_date.gte.${df}`);
      countQ = countQ.or(`scheduled_date.gte.${df},scheduled_end_date.gte.${df}`);
    }
    if (query.data.date_to) {
      const dt = query.data.date_to instanceof Date
        ? query.data.date_to.toISOString().slice(0, 10)
        : String(query.data.date_to);
      q = q.lte("scheduled_date", dt);
      countQ = countQ.lte("scheduled_date", dt);
    }
  }

  if (req.userRole === "technician") {
    q = q.eq("assigned_technician_id", req.userId!);
    countQ = countQ.eq("assigned_technician_id", req.userId!);
  }

  if (searchTerm && searchTerm.trim()) {
    const s = searchTerm.trim();
    q = q.or(`description.ilike.%${s}%,notes.ilike.%${s}%,customers.first_name.ilike.%${s}%,customers.last_name.ilike.%${s}%`);
  }

  const cacheKey = `${req.tenantId || "none"}:${req.userRole}:${req.userId}:${JSON.stringify(req.query)}`;
  const cached = jobsListCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < JOBS_CACHE_TTL_MS) {
    res.set("Cache-Control", "private, max-age=30");
    res.set("X-Cache", "HIT");
    res.json(cached.data);
    return;
  }

  const [{ data, error }, { count: totalCount }, allTypes, tenantFeatures] = await Promise.all([
    q,
    countQ,
    getJobTypesForTenant(req.tenantId),
    req.tenantId ? getTenantFeatures(req.tenantId) : Promise.resolve(null),
  ]);
  if (error) { res.status(500).json({ error: error.message }); return; }

  const hasGeoMapping = !!(tenantFeatures?.geo_mapping);

  const typeMap = new Map((allTypes || []).map((t: { id: number; name: string }) => [t.id, t.name]));
  const rawMapped = (data as SupabaseJobRow[] || []).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    customer_is_active: j.customers?.is_active ?? true,
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

  const responseBody = {
    jobs: rawMapped,
    pagination: {
      page,
      limit,
      total: totalCount ?? 0,
      totalPages: Math.ceil((totalCount ?? 0) / limit),
    },
  };
  jobsListCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  if (jobsListCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of jobsListCache) {
      if (now - v.ts > JOBS_CACHE_TTL_MS) jobsListCache.delete(k);
    }
  }
  res.set("Cache-Control", "private, max-age=30");
  res.set("X-Cache", "MISS");
  res.json(responseBody);
});

router.post("/jobs", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [limits, jobsThisMonth] = await Promise.all([
    getEffectiveLimits(req.tenantId!),
    getJobsThisMonth(req.tenantId!),
  ]);

  if (limits.maxJobsPerMonth !== 9999 && jobsThisMonth >= limits.maxJobsPerMonth) {
    res.status(400).json({
      error: `You've reached your monthly limit of ${limits.maxJobsPerMonth} jobs (${limits.baseMaxJobsPerMonth} from plan + ${limits.addonExtraJobs} from add-ons). Purchase additional job capacity to create more jobs this month.`,
      code: "MAX_JOBS_REACHED",
    });
    return;
  }

  const fkChecks: Array<{ table: string; id: string | undefined | null }> = [
    { table: "customers", id: parsed.data.customer_id },
    { table: "properties", id: parsed.data.property_id },
    { table: "appliances", id: parsed.data.appliance_id },
    { table: "profiles", id: parsed.data.assigned_technician_id },
  ];
  const { valid, failedTable } = await verifyMultipleTenantOwnership(fkChecks, req.tenantId);
  if (!valid) { res.status(403).json({ error: `Referenced ${failedTable} does not belong to your company.` }); return; }

  const { job_type_id: rawJobTypeId, fuel_category: parsedFuelCategory, ...jobCoreData } = parsed.data as typeof parsed.data & { fuel_category?: string | null };

  const validFuelCategories = ["gas", "oil", "heat_pump", "general"];
  const fuelCategory = parsedFuelCategory && validFuelCategories.includes(parsedFuelCategory) ? parsedFuelCategory : null;

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
    const { data: jtArr } = await supabaseAdmin
      .from("job_types")
      .select("*")
      .eq("id", jobTypeId)
      .limit(1);
    const jt = jtArr?.[0];
    if (jt && jt.tenant_id === req.tenantId && jt.is_active) {
      verifiedJobTypeId = jt.id;
      resolvedJobType = deriveJobTypeEnum(jt.category, jt.slug);
    } else {
      resolvedJobType = "service";
    }
  }

  let autoAssignedTechnicianId = jobCoreData.assigned_technician_id;
  if (req.tenantId) {
    // Auto-assign to the creator when there is only one active user on the account.
    // This avoids needing explicit technician assignment for single-operator setups
    // regardless of the legal business structure (sole_trader / company).
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", req.tenantId)
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      autoAssignedTechnicianId = req.userId!;
    }
  }

  let generatedJobRef: string | undefined;
  if (req.tenantId) {
    const { data: cs } = await supabaseAdmin
      .from("company_settings")
      .select("job_number_prefix, job_number_next")
      .eq("tenant_id", req.tenantId)
      .eq("singleton_id", SINGLETON_ID)
      .maybeSingle();
    const prefix = (cs?.job_number_prefix ?? "").trim().toUpperCase();
    const nextNum = cs?.job_number_next ?? 1;
    generatedJobRef = prefix
      ? `${prefix}${String(nextNum).padStart(4, "0")}`
      : `JOB-${String(nextNum).padStart(4, "0")}`;
    const { error: updErr } = await supabaseAdmin
      .from("company_settings")
      .update({ job_number_next: nextNum + 1 })
      .eq("tenant_id", req.tenantId)
      .eq("singleton_id", SINGLETON_ID)
      .eq("job_number_next", nextNum);
    if (updErr || !cs) {
      const retryResult = await supabaseAdmin
        .from("company_settings")
        .select("job_number_next")
        .eq("tenant_id", req.tenantId)
        .eq("singleton_id", SINGLETON_ID)
        .maybeSingle();
      const retryNum = retryResult.data?.job_number_next ?? nextNum + 1;
      generatedJobRef = prefix
        ? `${prefix}${String(retryNum).padStart(4, "0")}`
        : `JOB-${String(retryNum).padStart(4, "0")}`;
      await supabaseAdmin
        .from("company_settings")
        .update({ job_number_next: retryNum + 1 })
        .eq("tenant_id", req.tenantId)
        .eq("singleton_id", SINGLETON_ID);
    }
  }

  const insertPayload = {
    ...jobCoreData,
    assigned_technician_id: autoAssignedTechnicianId || null,
    job_type: resolvedJobType,
    tenant_id: req.tenantId,
    ...(verifiedJobTypeId ? { job_type_id: verifiedJobTypeId } : {}),
    ...(generatedJobRef ? { job_ref: generatedJobRef } : {}),
    ...(fuelCategory ? { fuel_category: fuelCategory } : {}),
  };

  const { data, error } = await supabaseAdmin.from("jobs").insert(insertPayload).select().single();
  if (error) {
    if (error.code === "23514") {
      res.status(400).json({ error: "End date cannot be before start date" }); return;
    }
    res.status(500).json({ error: error.message }); return;
  }

  invalidateJobsCache(req.tenantId);
  res.status(201).json(data);
});

router.post("/jobs/:jobId/send-confirmation", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { jobId } = req.params;

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tenant_id", req.tenantId)
    .single();
  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name, email")
    .eq("id", job.customer_id)
    .eq("tenant_id", req.tenantId)
    .single();
  if (!customer || !customer.email) {
    res.status(400).json({ error: "Customer does not have an email address" }); return;
  }

  const { data: property } = await supabaseAdmin
    .from("properties")
    .select("address_line1, address_line2, city, county, postcode")
    .eq("id", job.property_id)
    .eq("tenant_id", req.tenantId)
    .single();

  const addressParts = property
    ? [property.address_line1, property.address_line2, property.city, property.county, property.postcode].filter(Boolean)
    : [];
  const propertyAddress = addressParts.join(", ") || "See job details";

  let technicianName: string | null = null;
  if (job.assigned_technician_id) {
    const { data: tech } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", job.assigned_technician_id)
      .single();
    technicianName = tech?.full_name ?? null;
  }

  let jobTypeName = job.job_type || "Service";
  if (job.job_type_id) {
    const { data: jtArr } = await supabaseAdmin
      .from("job_types")
      .select("name")
      .eq("id", job.job_type_id)
      .limit(1);
    if (jtArr?.[0]) jobTypeName = jtArr[0].name;
  }

  const [{ data: companySettings }, { data: tenant }] = await Promise.all([
    supabaseAdmin
      .from("company_settings")
      .select("*")
      .eq("tenant_id", req.tenantId)
      .eq("singleton_id", "default")
      .single(),
    supabaseAdmin
      .from("tenants")
      .select("company_name")
      .eq("id", req.tenantId)
      .single(),
  ]);

  const cs = companySettings as Record<string, unknown> | null;
  const companyName = (cs?.name as string) || (cs?.trading_name as string) || (tenant?.company_name as string) || "Your Service Provider";

  const emailCompany: EmailCompanyDetails = {
    name: (cs?.name as string | null) || (tenant?.company_name as string | null) || null,
    trading_name: (cs?.trading_name as string | null) || null,
    logo_url: (cs?.logo_url as string | null) || null,
    address_line1: (cs?.address_line1 as string | null) || null,
    address_line2: (cs?.address_line2 as string | null) || null,
    city: (cs?.city as string | null) || null,
    county: (cs?.county as string | null) || null,
    postcode: (cs?.postcode as string | null) || null,
    phone: (cs?.phone as string | null) || null,
    email: (cs?.email as string | null) || null,
    website: (cs?.website as string | null) || null,
    gas_safe_number: (cs?.gas_safe_number as string | null) || null,
    oftec_number: (cs?.oftec_number as string | null) || null,
    vat_number: (cs?.vat_number as string | null) || null,
    rates_url: (cs?.rates_url as string | null) || null,
    trading_terms_url: (cs?.trading_terms_url as string | null) || null,
  };

  const jobRef = job.job_ref || `JOB-${job.id.slice(0, 8).toUpperCase()}`;

  const confirmationDetails: JobConfirmationDetails = {
    jobRef,
    jobType: jobTypeName,
    scheduledDate: job.scheduled_date,
    scheduledTime: job.scheduled_time || null,
    propertyAddress,
    technicianName,
    description: job.description || null,
  };

  const customerFullName = `${customer.first_name} ${customer.last_name}`;

  try {
    await sendJobConfirmationEmail(
      customer.email,
      customerFullName,
      companyName,
      confirmationDetails,
      emailCompany,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send confirmation email";
    res.status(500).json({ error: msg }); return;
  }

  const { data: senderProfile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", req.userId!).single();
  const { error: logErr } = await supabaseAdmin.from("job_email_logs").insert({
    job_id: jobId,
    tenant_id: req.tenantId,
    sent_by: req.userId,
    sent_to: customer.email,
    cc: null,
    subject: `Job Confirmation — ${jobRef}`,
    forms_included: [{ form_type: "confirmation", form_label: "Appointment Confirmation", form_id: jobId }],
  });
  if (logErr) console.error("[email] Failed to log confirmation email:", logErr);

  res.json({ success: true, sent_to: customer.email });
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

  const rawCalloutRateId = req.body.callout_rate_id as string | null | undefined;

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

  if (rawCalloutRateId !== undefined) {
    if (rawCalloutRateId === null || rawCalloutRateId === "") {
      updatePayload.callout_rate_id = null;
    } else {
      if (req.tenantId) {
        const { data: rateCheck } = await supabaseAdmin.from("callout_rates").select("id").eq("id", rawCalloutRateId).eq("tenant_id", req.tenantId).single();
        if (!rateCheck) { res.status(400).json({ error: "Invalid callout rate for this company" }); return; }
      }
      updatePayload.callout_rate_id = rawCalloutRateId;
    }
  }

  if (rawUpdateJobTypeId != null && req.tenantId) {
    const { data: jtArr } = await supabaseAdmin
      .from("job_types")
      .select("*")
      .eq("id", rawUpdateJobTypeId)
      .limit(1);
    const jt = jtArr?.[0];
    if (!jt || jt.tenant_id !== req.tenantId || !jt.is_active) {
      res.status(400).json({ error: "Invalid or inactive job type for this company" }); return;
    }
    updatePayload.job_type_id = jt.id;
    updatePayload.job_type = deriveJobTypeEnum(jt.category, jt.slug);
  }

  const dateOrTimeChanging = updatePayload.scheduled_date !== undefined || updatePayload.scheduled_time !== undefined;
  let oldSchedule: { scheduled_date: string | null; scheduled_time: string | null } | null = null;
  if (dateOrTimeChanging) {
    let oldQ = supabaseAdmin.from("jobs").select("scheduled_date, scheduled_time").eq("id", params.data.id);
    if (req.tenantId) oldQ = oldQ.eq("tenant_id", req.tenantId);
    const { data: oldJob } = await oldQ.single();
    if (oldJob) oldSchedule = oldJob as { scheduled_date: string | null; scheduled_time: string | null };
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

  if (dateOrTimeChanging && oldSchedule) {
    const newDate = (data as Record<string, unknown>).scheduled_date as string | null;
    const newTime = (data as Record<string, unknown>).scheduled_time as string | null;
    const dateChanged = oldSchedule.scheduled_date !== newDate;
    const timeChanged = oldSchedule.scheduled_time !== newTime;
    if (dateChanged || timeChanged) {
      await supabaseAdmin.from("job_schedule_history").insert({
        job_id: params.data.id,
        tenant_id: req.tenantId,
        changed_by: req.userId,
        previous_date: oldSchedule.scheduled_date,
        previous_time: oldSchedule.scheduled_time,
        new_date: newDate,
        new_time: newTime,
      });
    }
  }

  invalidateJobsCache(req.tenantId);
  res.json(UpdateJobResponse.parse(data));
});

router.get("/products/search", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const q = (req.query.q as string || "").trim();
  let query = supabaseAdmin
    .from("product_catalogue")
    .select("id, name, default_price")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .order("name")
    .limit(20);
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
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

router.get("/jobs/:id/schedule-history", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "You can only view jobs assigned to you" }); return; }
  }
  let q = supabaseAdmin
    .from("job_schedule_history")
    .select("id, job_id, previous_date, previous_time, new_date, new_time, reason, created_at, changed_by, profiles:changed_by(full_name)")
    .eq("job_id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  const entries = (data || []).map((e: Record<string, unknown>) => ({
    id: e.id,
    job_id: e.job_id,
    previous_date: e.previous_date,
    previous_time: e.previous_time,
    new_date: e.new_date,
    new_time: e.new_time,
    reason: e.reason,
    created_at: e.created_at,
    changed_by_name: (e.profiles as { full_name: string } | null)?.full_name || "Unknown",
  }));
  res.json(entries);
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

  const { arrival_time, departure_time, notes, hourly_rate, callout_fee } = req.body;
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
    callout_fee: callout_fee != null ? parseFloat(callout_fee) : null,
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

  const { arrival_time, departure_time, notes, hourly_rate, callout_fee } = req.body;
  const updates: Record<string, unknown> = {};
  if (arrival_time !== undefined) updates.arrival_time = arrival_time;
  if (departure_time !== undefined) updates.departure_time = departure_time || null;
  if (notes !== undefined) updates.notes = notes || null;
  if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate != null ? parseFloat(hourly_rate) : null;
  if (callout_fee !== undefined) updates.callout_fee = callout_fee != null ? parseFloat(callout_fee) : null;

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

// ─── Service Catalogue Search ───────────────────────────────────────────────

router.get("/services/search", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const q = (req.query.q as string || "").trim();
  let query = supabaseAdmin
    .from("service_catalogue")
    .select("id, name, default_price")
    .eq("tenant_id", req.tenantId!)
    .eq("is_active", true)
    .order("name")
    .limit(20);
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

// ─── Job Services CRUD ───────────────────────────────────────────────────────

router.get("/jobs/:id/services", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let q = supabaseAdmin.from("job_services").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/jobs/:id/services", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.id;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  const { service_name, quantity, unit_price } = req.body;
  if (!service_name || typeof service_name !== "string") {
    res.status(400).json({ error: "service_name is required" }); return;
  }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let jobCheck = supabaseAdmin.from("jobs").select("id").eq("id", jobId);
  if (req.tenantId) jobCheck = jobCheck.eq("tenant_id", req.tenantId);
  const { data: jobExists } = await jobCheck.single();
  if (!jobExists) { res.status(404).json({ error: "Job not found" }); return; }

  const { data, error } = await supabaseAdmin.from("job_services").insert({
    job_id: jobId,
    service_name: service_name.trim(),
    quantity: typeof quantity === "number" && quantity > 0 ? quantity : 1,
    unit_price: typeof unit_price === "number" && unit_price >= 0 ? unit_price : null,
    tenant_id: req.tenantId,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.delete("/jobs/:id/services/:serviceId", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id: jobId, serviceId } = req.params;
  if (!jobId || !serviceId) { res.status(400).json({ error: "Missing ids" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let q = supabaseAdmin.from("job_services").delete().eq("id", serviceId).eq("job_id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  await q;
  res.sendStatus(204);
});

router.patch("/jobs/:id/services/:serviceId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id: jobId, serviceId } = req.params;
  if (!jobId || !serviceId) { res.status(400).json({ error: "Missing ids" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  const { service_name, quantity, unit_price } = req.body;
  const updates: Record<string, unknown> = {};
  if (service_name !== undefined) updates.service_name = String(service_name).trim();
  if (quantity !== undefined) updates.quantity = typeof quantity === "number" && quantity > 0 ? quantity : 1;
  if (unit_price !== undefined) updates.unit_price = typeof unit_price === "number" && unit_price >= 0 ? unit_price : null;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  let q = supabaseAdmin.from("job_services").update(updates).eq("id", serviceId).eq("job_id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Service not found" }); return; }
  res.json(data);
});

export async function buildInvoiceData(
  jobId: string,
  tenantId: string | null | undefined
): Promise<InvoiceData | null> {
  let jobQ = supabaseAdmin.from("jobs").select("*, customers(first_name, last_name, email, phone, mobile, address_line1, address_line2, city, county, postcode)").eq("id", jobId);
  if (tenantId) jobQ = jobQ.eq("tenant_id", tenantId);
  const { data: job } = await jobQ.single();
  if (!job) return null;

  let settingsQ = supabaseAdmin.from("company_settings").select("*").eq("singleton_id", "default");
  if (tenantId) settingsQ = settingsQ.eq("tenant_id", tenantId);
  const { data: settings } = await settingsQ.maybeSingle();

  let partsQ = supabaseAdmin.from("job_parts").select("*").eq("job_id", jobId);
  if (tenantId) partsQ = partsQ.eq("tenant_id", tenantId);
  const { data: parts } = await partsQ;

  let servicesQ = supabaseAdmin.from("job_services").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
  if (tenantId) servicesQ = servicesQ.eq("tenant_id", tenantId);
  const { data: jobServices } = await servicesQ;

  let timeQ = supabaseAdmin.from("job_time_entries").select("*").eq("job_id", jobId).order("arrival_time", { ascending: true });
  if (tenantId) timeQ = timeQ.eq("tenant_id", tenantId);
  const { data: timeEntries } = await timeQ;

  const defaultHourlyRate = Number(settings?.default_hourly_rate) || 0;
  const callOutFee = Number(settings?.call_out_fee) || 0;
  const rawVat = Number(settings?.default_vat_rate);
  const vatRate = Number.isFinite(rawVat) ? rawVat : 20;
  const paymentTermsDays = settings?.default_payment_terms_days != null ? Number(settings.default_payment_terms_days) : 30;
  const currency = settings?.currency || "GBP";

  const customer = job.customers as { first_name: string; last_name: string; email?: string; phone?: string; mobile?: string; address_line1?: string; address_line2?: string; city?: string; county?: string; postcode?: string } | null;
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown";
  const customerAddressParts = [customer?.address_line1, customer?.address_line2, customer?.city, customer?.county, customer?.postcode].filter(Boolean);

  const companyAddressParts = [settings?.address_line1, settings?.address_line2, settings?.city, settings?.county, settings?.postcode].filter(Boolean);

  const hasTimeEntries = !!(timeEntries && timeEntries.length > 0);

  let calloutRatesList: { id: string; name: string; amount: number; hourly_rate: number | null }[] = [];
  if (hasTimeEntries && tenantId) {
    const { data: rates } = await supabaseAdmin.from("callout_rates").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("sort_order");
    if (rates) calloutRatesList = rates as typeof calloutRatesList;
  }

  const lines: InvoiceLineItem[] = [];
  let totalLabourCost = 0;
  let totalCallOutCost = 0;

  const attendanceSummaryLines: string[] = [];

  const techNameMap = new Map<string, string>();
  if (timeEntries && timeEntries.length > 0) {
    const techIds = [...new Set((timeEntries as { created_by?: string }[]).map(e => e.created_by).filter(Boolean))] as string[];
    if (techIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", techIds);
      if (profiles) {
        for (const p of profiles as { id: string; first_name: string; last_name: string }[]) {
          techNameMap.set(p.id, `${p.first_name} ${p.last_name}`.trim());
        }
      }
    }
  }

  if (timeEntries) {
    for (const e of timeEntries as { arrival_time: string; departure_time: string | null; hourly_rate: number | null; created_by?: string }[]) {
      if (!e.arrival_time || !e.departure_time) continue;
      const diffMs = new Date(e.departure_time).getTime() - new Date(e.arrival_time).getTime();
      if (diffMs <= 0) continue;

      const hours = diffMs / (1000 * 60 * 60);
      const totalMins = Math.round(diffMs / 60000);
      const durationH = Math.floor(totalMins / 60);
      const durationM = totalMins % 60;
      const durationStr = durationH > 0 ? `${durationH}h ${durationM}m` : `${durationM}m`;
      const arrDate = new Date(e.arrival_time);
      const depDate = new Date(e.departure_time);
      const dateStr = arrDate.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
      const arrTime = arrDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      const depTime = depDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      const techName = e.created_by ? techNameMap.get(e.created_by) : null;
      attendanceSummaryLines.push(`${dateStr}: ${arrTime} - ${depTime} (${durationStr})${techName ? ` — ${techName}` : ""}`);

      const rate = e.hourly_rate != null ? Number(e.hourly_rate) : defaultHourlyRate;

      // Prefer callout_fee stored on the entry; fall back to matching by hourly_rate for legacy entries
      const storedCalloutFee = (e as Record<string, unknown>).callout_fee != null
        ? Number((e as Record<string, unknown>).callout_fee)
        : null;
      let entryCalloutFee: number;
      let rateName: string;
      if (storedCalloutFee != null) {
        entryCalloutFee = storedCalloutFee;
        const matchedCallout = calloutRatesList.find(r => Number(r.amount) === storedCalloutFee);
        rateName = matchedCallout?.name || "Standard";
      } else {
        const matchedCallout = calloutRatesList.find(r => r.hourly_rate != null && Number(r.hourly_rate) === rate);
        entryCalloutFee = matchedCallout ? Number(matchedCallout.amount) : callOutFee;
        rateName = matchedCallout?.name || "Standard";
      }

      const hasCallout = entryCalloutFee > 0;
      const calloutCost = hasCallout ? entryCalloutFee : 0;
      const billableHrs = hasCallout ? Math.max(0, hours - 1) : hours;
      const billableCost = Math.round(billableHrs * rate * 100) / 100;

      if (hasCallout) {
        lines.push({
          description: `${rateName} - Call-out (first hour)`,
          quantity: 1,
          unit_price: entryCalloutFee,
          total: entryCalloutFee,
        });
        totalCallOutCost += entryCalloutFee;
      }

      if (billableHrs > 0 && rate > 0) {
        const roundedHrs = Math.round(billableHrs * 10000) / 10000;
        lines.push({
          description: `${rateName} - Labour (after first hour)`,
          quantity: roundedHrs,
          unit_price: rate,
          total: billableCost,
        });
        totalLabourCost += billableCost;
      }
    }
  }

  if (parts) {
    for (const p of parts as { part_name: string; quantity: number; unit_price: number | null }[]) {
      const up = Number(p.unit_price) || 0;
      lines.push({
        description: p.part_name,
        quantity: p.quantity,
        unit_price: up,
        total: up * p.quantity,
        item_name: "product",
      });
    }
  }

  if (jobServices) {
    for (const s of jobServices as { service_name: string; quantity: number; unit_price: number | null }[]) {
      const up = Number(s.unit_price) || 0;
      lines.push({
        description: s.service_name,
        quantity: s.quantity,
        unit_price: up,
        total: up * s.quantity,
        item_name: "service",
      });
    }
  }

  if (lines.length === 0) {
    const desc = job.description || `${job.job_type || "Service"} job`;
    lines.push({ description: desc, quantity: 1, unit_price: 0, total: 0 });
  }

  const partsTotal = lines.filter(l => l.item_name === "product").reduce((sum, l) => sum + l.total, 0);
  const servicesTotal = lines.filter(l => l.item_name === "service").reduce((sum, l) => sum + l.total, 0);
  const labourTotal = totalLabourCost;
  const callOutTotal = totalCallOutCost;

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
    customer_first_name: customer?.first_name || "",
    customer_last_name: customer?.last_name || "",
    customer_email: customer?.email || "",
    customer_address: customerAddressParts.join(", "),
    customer_phone: customer?.phone || "",
    customer_mobile: customer?.mobile || "",
    customer_address_line1: customer?.address_line1 || "",
    customer_address_line2: customer?.address_line2 || "",
    customer_city: customer?.city || "",
    customer_county: customer?.county || "",
    customer_postcode: customer?.postcode || "",
    job_id: job.id,
    job_ref: job.job_ref || `JOB-${job.id.slice(0, 8).toUpperCase()}`,
    job_type: job.job_type,
    job_description: job.description || `${job.job_type} job`,
    lines,
    parts_total: partsTotal,
    services_total: servicesTotal,
    labour_total: labourTotal,
    call_out_fee: callOutTotal,
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total,
    attendance_summary: attendanceSummaryLines.length > 0
      ? `Attendance:\n${attendanceSummaryLines.join("\n")}`
      : undefined,
    payment_terms_days: paymentTermsDays,
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
      arrival_time: "Arrival Time", departure_time: "Departure Time",
      visual_inspection: "Visual Inspection", appliance_condition: "Appliance Condition",
      flue_inspection: "Flue Inspection",
      combustion_co2: "Combustion CO2", combustion_co: "Combustion CO",
      combustion_o2: "Combustion O2", combustion_temp: "Combustion Temp",
      combustion_efficiency: "Combustion Efficiency",
      smoke_test: "Smoke Test", smoke_number: "Smoke Number",
      burner_cleaned: "Burner Cleaned", heat_exchanger_cleaned: "Heat Exchanger Cleaned",
      nozzle_checked: "Nozzle Checked", nozzle_replaced: "Nozzle Replaced",
      nozzle_size_fitted: "Nozzle Size Fitted",
      electrodes_checked: "Electrodes Checked", electrodes_replaced: "Electrodes Replaced",
      filter_checked: "Filter Checked", filter_cleaned: "Filter Cleaned", filter_replaced: "Filter Replaced",
      oil_line_checked: "Oil Line Checked", fire_valve_checked: "Fire Valve Checked",
      seals_gaskets_checked: "Seals/Gaskets Checked", seals_gaskets_replaced: "Seals/Gaskets Replaced",
      controls_checked: "Controls Checked", thermostat_checked: "Thermostat Checked",
      safety_devices_checked: "Safety Devices Checked", safety_devices_notes: "Safety Devices Notes",
      leaks_found: "Leaks Found", leaks_details: "Leaks Details",
      defects_found: "Defects Found", defects_details: "Defects Details",
      advisories: "Advisories", parts_required: "Parts Required",
      work_completed: "Work Completed", appliance_safe: "Appliance Safe",
      follow_up_required: "Follow-up Required", follow_up_notes: "Follow-up Notes",
      next_service_due: "Next Service Due", additional_notes: "Additional Notes",
      gas_tightness_pass: "Gas Tightness Pass",
      gas_standing_pressure: "Gas Standing Pressure", gas_working_pressure: "Gas Working Pressure",
      gas_operating_pressure: "Gas Operating Pressure", gas_burner_pressure: "Gas Burner Pressure",
      gas_heat_input: "Gas Heat Input", co_co2_ratio: "CO/CO2 Ratio",
      flue_spillage_test: "Flue Spillage Test", ventilation_adequate: "Ventilation Adequate",
      gas_meter_type: "Gas Meter Type", gas_safe_engineer_id: "Gas Safe Engineer ID",
      cp12_certificate_number: "CP12 Certificate Number", landlord_certificate: "Landlord Certificate",
      appliance_classification: "Appliance Classification",
      warning_notice_issued: "Warning Notice Issued", warning_notice_type: "Warning Notice Type",
      warning_notice_details: "Warning Notice Details", customer_warned: "Customer Warned",
      gas_valve_checked: "Gas Valve Checked", injectors_checked: "Injectors Checked",
      pilot_checked: "Pilot Checked", ignition_checked: "Ignition Checked",
      gas_pressure_checked: "Gas Pressure Checked",
    },
  },
  breakdown_report: {
    table: "breakdown_reports",
    label: "Breakdown Report",
    fieldMap: {
      reported_fault: "Reported Fault", symptoms: "Symptoms",
      diagnostics_performed: "Diagnostics Performed", findings: "Findings",
      parts_required: "Parts Required",
      temporary_fix: "Temporary Fix", permanent_fix: "Permanent Fix",
      appliance_safe: "Appliance Safe",
      return_visit_required: "Return Visit Required", return_visit_notes: "Return Visit Notes",
      additional_notes: "Additional Notes",
    },
  },
  commissioning_record: {
    table: "commissioning_records",
    label: "Commissioning Record",
    fieldMap: {
      gas_safe_engineer_id: "Gas Safe Engineer ID",
      standing_pressure: "Standing Pressure", working_pressure: "Working Pressure",
      operating_pressure: "Operating Pressure", gas_rate_measured: "Gas Rate Measured",
      combustion_co: "Combustion CO", combustion_co2: "Combustion CO2",
      flue_temp: "Flue Temperature",
      ignition_tested: "Ignition Tested", controls_tested: "Controls Tested",
      thermostats_tested: "Thermostats Tested", pressure_relief_tested: "Pressure Relief Tested",
      expansion_vessel_checked: "Expansion Vessel Checked",
      system_flushed: "System Flushed", inhibitor_added: "Inhibitor Added",
      customer_instructions_given: "Customer Instructions Given",
      notes: "Notes",
    },
  },
  job_completion_report: {
    table: "job_completion_reports",
    label: "Job Completion Report",
    fieldMap: {
      work_completed: "Work Completed", outstanding_items: "Outstanding Items",
      defects_found: "Defects Found", advisories: "Advisories",
      customer_advised: "Customer Advised", customer_sign_off: "Customer Sign Off",
      next_service_date: "Next Service Date",
      follow_up_required: "Follow-up Required", follow_up_notes: "Follow-up Notes",
      additional_notes: "Additional Notes",
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
      refrigerant_type: "Refrigerant Type",
      refrigerant_pressure_high: "Refrigerant Pressure (High)",
      refrigerant_pressure_low: "Refrigerant Pressure (Low)",
      flow_temp: "Flow Temperature", return_temp: "Return Temperature",
      delta_t: "Delta T", cop_reading: "COP Reading",
      compressor_amps: "Compressor Amps",
      outdoor_unit_condition: "Outdoor Unit Condition",
      indoor_unit_condition: "Indoor Unit Condition",
      controls_checked: "Controls Checked", filter_condition: "Filter Condition",
      dhw_cylinder_checked: "DHW Cylinder Checked", dhw_cylinder_temp: "DHW Cylinder Temp",
      defects_found: "Defects Found", defects_details: "Defects Details",
      advisories: "Advisories", appliance_safe: "Appliance Safe",
      follow_up_required: "Follow-up Required", follow_up_notes: "Follow-up Notes",
      additional_notes: "Additional Notes",
    },
  },
  heat_pump_commissioning_record: {
    table: "heat_pump_commissioning_records",
    label: "Heat Pump Commissioning",
    fieldMap: {
      heat_loss_kwh: "Heat Loss (kWh)", design_flow_temp: "Design Flow Temp",
      refrigerant_type: "Refrigerant Type", refrigerant_charge_weight: "Refrigerant Charge Weight",
      commissioning_pressure_high: "Commissioning Pressure (High)",
      commissioning_pressure_low: "Commissioning Pressure (Low)",
      measured_cop: "Measured COP",
      expansion_vessel_checked: "Expansion Vessel Checked",
      safety_devices_checked: "Safety Devices Checked",
      controls_commissioned: "Controls Commissioned",
      buffer_tank_checked: "Buffer Tank Checked", cylinder_checked: "Cylinder Checked",
      system_flushed: "System Flushed", inhibitor_added: "Inhibitor Added",
      customer_instructions_given: "Customer Instructions Given",
      notes: "Notes",
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

router.get("/jobs/:jobId/forms/:formType/:formId/pdf", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { jobId, formType, formId } = req.params;
  if (!jobId || !formType || !formId) { res.status(400).json({ error: "Missing parameters" }); return; }

  const config = FORM_TABLE_MAP[formType];
  if (!config) { res.status(400).json({ error: `Unknown form type: ${formType}` }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  let jobQ = supabaseAdmin.from("jobs").select("*, customers(first_name, last_name), profiles(full_name), appliances(fuel_type), properties(address_line1, city, postcode)").eq("id", jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error: jobErr } = await jobQ.single();
  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  let recQ = supabaseAdmin.from(config.table).select("*").eq("id", formId).eq("job_id", jobId);
  if (req.tenantId) recQ = recQ.eq("tenant_id", req.tenantId);
  const { data: record, error: recErr } = await recQ.maybeSingle();
  if (recErr || !record) { res.status(404).json({ error: "Form record not found" }); return; }

  const customer = job.customers as Record<string, unknown> | null;
  const customerName = customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : "N/A";
  const technicianName = (job.profiles as Record<string, unknown>)?.full_name as string || "N/A";
  const prop = job.properties as Record<string, unknown> | null;
  let propertyAddress = "N/A";
  if (prop) {
    const parts = [prop.address_line1, prop.city, prop.postcode].filter(Boolean);
    propertyAddress = parts.join(", ");
  }

  const { data: companySettings } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .eq("singleton_id", "default")
    .maybeSingle();
  const pdfCompany: PdfCompanySettings | undefined = companySettings ? {
    name: (companySettings as Record<string, unknown>).name as string | null,
    trading_name: (companySettings as Record<string, unknown>).trading_name as string | null,
    address_line1: (companySettings as Record<string, unknown>).address_line1 as string | null,
    address_line2: (companySettings as Record<string, unknown>).address_line2 as string | null,
    city: (companySettings as Record<string, unknown>).city as string | null,
    county: (companySettings as Record<string, unknown>).county as string | null,
    postcode: (companySettings as Record<string, unknown>).postcode as string | null,
    phone: (companySettings as Record<string, unknown>).phone as string | null,
    email: (companySettings as Record<string, unknown>).email as string | null,
    website: (companySettings as Record<string, unknown>).website as string | null,
    gas_safe_number: (companySettings as Record<string, unknown>).gas_safe_number as string | null,
    oftec_number: (companySettings as Record<string, unknown>).oftec_number as string | null,
    vat_number: (companySettings as Record<string, unknown>).vat_number as string | null,
  } : undefined;

  const appliance = job.appliances as { fuel_type: string } | null;
  const fuelType = appliance?.fuel_type || "oil";
  const scheduledDate = job.scheduled_date || "";

  const pdfBuffer = generateFormPdf(
    formType,
    config.label,
    record as Record<string, unknown>,
    config.fieldMap,
    { jobRef: job.job_ref || job.id.slice(0, 8).toUpperCase(), customerName, propertyAddress, technicianName, scheduledDate },
    pdfCompany,
    fuelType,
  );

  const safeLabel = config.label.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `${safeLabel}_${job.job_ref || job.id.slice(0, 8).toUpperCase()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});

router.post("/jobs/:jobId/email-forms", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.jobId;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  const { to, cc, forms, photo_ids } = req.body as { to?: string; cc?: string; forms?: Array<{ form_type: string; form_id: string }>; photo_ids?: string[] };
  const hasForms = forms && Array.isArray(forms) && forms.length > 0;
  const hasPhotos = photo_ids && Array.isArray(photo_ids) && photo_ids.length > 0;
  if (!to || (!hasForms && !hasPhotos)) {
    res.status(400).json({ error: "to (email) and at least one form or photo are required" }); return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(to)) { res.status(400).json({ error: "Invalid recipient email address" }); return; }
  if (cc && !emailRe.test(cc)) { res.status(400).json({ error: "Invalid CC email address" }); return; }

  if (hasForms) {
    for (const f of forms!) {
      if (!f.form_type || !f.form_id) { res.status(400).json({ error: "Each form entry must have form_type and form_id" }); return; }
      if (!FORM_TABLE_MAP[f.form_type]) { res.status(400).json({ error: `Unknown form type: ${f.form_type}` }); return; }
    }
  }

  let jobQ = supabaseAdmin.from("jobs").select("*, customers(first_name, last_name, email), profiles(full_name), appliances(fuel_type)").eq("id", jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error: jobErr } = await jobQ.single();
  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    res.status(403).json({ error: "You can only email forms for jobs assigned to you" }); return;
  }

  let tenantQ = supabaseAdmin.from("tenants").select("company_name").eq("id", req.tenantId!);
  const { data: tenant } = await tenantQ.single();
  const companyName = (tenant as Record<string, unknown>)?.company_name as string || "Your Service Provider";

  const { data: companySettings } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .eq("singleton_id", "default")
    .maybeSingle();

  const pdfCompany: PdfCompanySettings | undefined = companySettings ? {
    name: (companySettings as Record<string, unknown>).name as string | null,
    trading_name: (companySettings as Record<string, unknown>).trading_name as string | null,
    address_line1: (companySettings as Record<string, unknown>).address_line1 as string | null,
    address_line2: (companySettings as Record<string, unknown>).address_line2 as string | null,
    city: (companySettings as Record<string, unknown>).city as string | null,
    county: (companySettings as Record<string, unknown>).county as string | null,
    postcode: (companySettings as Record<string, unknown>).postcode as string | null,
    phone: (companySettings as Record<string, unknown>).phone as string | null,
    email: (companySettings as Record<string, unknown>).email as string | null,
    website: (companySettings as Record<string, unknown>).website as string | null,
    gas_safe_number: (companySettings as Record<string, unknown>).gas_safe_number as string | null,
    oftec_number: (companySettings as Record<string, unknown>).oftec_number as string | null,
    vat_number: (companySettings as Record<string, unknown>).vat_number as string | null,
  } : undefined;

  const customer = job.customers as { first_name: string; last_name: string } | null;
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Customer";
  const techProfile = job.profiles as { full_name: string } | null;
  const technicianName = techProfile?.full_name || "Technician";
  const jobRef = job.job_ref || `#${job.id.slice(0, 8)}`;

  let propertyAddress = "";
  if (job.property_id) {
    const { data: prop } = await supabaseAdmin
      .from("properties")
      .select("address_line1, city, postcode")
      .eq("id", job.property_id)
      .maybeSingle();
    if (prop) {
      const parts = [
        (prop as Record<string, unknown>).address_line1,
        (prop as Record<string, unknown>).city,
        (prop as Record<string, unknown>).postcode,
      ].filter(Boolean);
      propertyAddress = parts.join(", ");
    }
  }

  const scheduledDate = job.scheduled_date || "";
  const appliance = job.appliances as { fuel_type: string } | null;
  const fuelType = appliance?.fuel_type || "oil";
  const formCtx = { jobRef: job.job_ref || job.id.slice(0, 8).toUpperCase(), customerName, propertyAddress, technicianName, scheduledDate };

  const formsIncluded: Array<{ form_type: string; form_label: string; form_id: string }> = [];
  const attachments: EmailAttachment[] = [];
  let photosAttached = 0;
  const photosIncluded: Array<{ photo_id: string; file_name: string }> = [];
  const photosFailed: string[] = [];

  if (hasPhotos) {
    for (const photoId of photo_ids!) {
      let pq = supabaseAdmin.from("file_attachments").select("*").eq("id", photoId).eq("entity_id", jobId).eq("entity_type", "job");
      if (req.tenantId) pq = pq.eq("tenant_id", req.tenantId);
      const { data: fileRow } = await pq.maybeSingle();
      if (!fileRow) { photosFailed.push(photoId); continue; }
      const fr = fileRow as Record<string, unknown>;
      const storagePath = fr.storage_path as string;
      const fileName = fr.file_name as string;
      const fileType = fr.file_type as string;
      const bucket = (fileType || "").startsWith("image/") ? "service-photos" : "service-documents";
      const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(storagePath);
      if (dlErr || !fileData) { console.error(`[email] Failed to download photo ${photoId}:`, dlErr); photosFailed.push(photoId); continue; }
      const buf = Buffer.from(await fileData.arrayBuffer());
      const name = fileName || `photo_${photoId}.jpg`;
      attachments.push({ filename: name, content: buf });
      photosIncluded.push({ photo_id: photoId, file_name: name });
      photosAttached++;
    }
  }

  for (const { form_type: formType, form_id: formId } of (forms || [])) {
    const config = FORM_TABLE_MAP[formType];
    if (!config) continue;

    let q = supabaseAdmin.from(config.table).select("*").eq("id", formId).eq("job_id", jobId);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    const { data: record, error: recErr } = await q.maybeSingle();
    if (recErr) { console.error(`[email] Error fetching ${formType} record ${formId}:`, recErr); continue; }
    if (!record) continue;

    const rec = record as Record<string, unknown>;
    const matchedFields = Object.keys(config.fieldMap).filter(k => rec[k] != null && rec[k] !== "" && rec[k] !== "null");
    const unmatchedDbKeys = Object.keys(rec).filter(k => !["id","job_id","technician_id","tenant_id","created_at","updated_at"].includes(k) && !(k in config.fieldMap));
    console.log(`[email-pdf] ${formType}: DB columns=${Object.keys(rec).length}, fieldMap keys=${Object.keys(config.fieldMap).length}, matched=${matchedFields.length}, unmatched DB cols=[${unmatchedDbKeys.join(",")}]`);

    const pdfBuffer = generateFormPdf(
      formType,
      config.label,
      record as Record<string, unknown>,
      config.fieldMap,
      formCtx,
      pdfCompany,
      fuelType,
    );

    const safeLabel = config.label.replace(/[^a-zA-Z0-9]/g, "_");
    attachments.push({
      filename: `${safeLabel}_${formCtx.jobRef}.pdf`,
      content: pdfBuffer,
    });
    formsIncluded.push({ form_type: formType, form_label: config.label, form_id: formId });
  }

  if (formsIncluded.length === 0 && photosAttached === 0) {
    res.status(400).json({ error: "No completed forms or photos found for the selected entries" }); return;
  }

  const subjectParts: string[] = [];
  if (formsIncluded.length > 0) subjectParts.push("Service Forms");
  if (photosAttached > 0) subjectParts.push("Photos");
  const subject = `Job ${jobRef} — ${subjectParts.join(" & ")} from ${companyName}`;

  try {
    const emailCompany: EmailCompanyDetails | undefined = pdfCompany ? {
      name: pdfCompany.name,
      trading_name: pdfCompany.trading_name,
      logo_url: (companySettings as Record<string, unknown>)?.logo_url as string | null || null,
      address_line1: pdfCompany.address_line1,
      address_line2: pdfCompany.address_line2,
      city: pdfCompany.city,
      county: pdfCompany.county,
      postcode: pdfCompany.postcode,
      phone: pdfCompany.phone,
      email: pdfCompany.email,
      website: pdfCompany.website,
      gas_safe_number: pdfCompany.gas_safe_number,
      oftec_number: pdfCompany.oftec_number,
      vat_number: pdfCompany.vat_number,
      rates_url: (companySettings as Record<string, unknown>)?.rates_url as string | null || null,
      trading_terms_url: (companySettings as Record<string, unknown>)?.trading_terms_url as string | null || null,
    } : undefined;

    await sendJobFormsEmail(
      to,
      cc || null,
      subject,
      jobRef,
      customerName,
      companyName,
      formsIncluded.map(f => f.form_label),
      attachments,
      emailCompany,
      photosAttached,
    );
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
    photos_included: photosIncluded.length > 0 ? photosIncluded : null,
  });
  if (logErr) {
    console.error("[email] Failed to log email send:", logErr);
  }

  const response: Record<string, unknown> = {
    success: true,
    message: `Email sent to ${to}`,
    forms_sent: formsIncluded.map(f => f.form_label),
    photos_sent: photosAttached,
    sender_name: (senderProfile as Record<string, unknown>)?.full_name || null,
    log_saved: !logErr,
  };
  if (photosFailed.length > 0) {
    response.photos_failed = photosFailed.length;
    response.warning = `${photosFailed.length} photo(s) could not be attached`;
  }
  res.json(response);
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
  invalidateJobsCache(req.tenantId);
  res.sendStatus(204);
});

/**
 * POST /jobs/:jobId/email-certificate
 * One-tap: collects all completed forms for the job and emails them to the customer.
 */
router.post("/jobs/:jobId/email-certificate", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const jobId = req.params.jobId;
  if (!jobId) { res.status(400).json({ error: "Missing job id" }); return; }

  if (req.userRole === "technician") {
    const isOwner = await verifyTechnicianOwnership(jobId, req.userId, req.tenantId);
    if (!isOwner) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  // Fetch job + customer email
  let jobQ = supabaseAdmin
    .from("jobs")
    .select("*, customers(first_name, last_name, email), profiles(full_name), appliances(fuel_type)")
    .eq("id", jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error: jobErr } = await jobQ.single();
  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  const customer = job.customers as { first_name: string; last_name: string; email: string | null } | null;
  if (!customer?.email) {
    res.status(400).json({ error: "Customer has no email address on record" }); return;
  }

  const customerName = `${customer.first_name} ${customer.last_name}`;
  const techProfile = job.profiles as { full_name: string } | null;
  const technicianName = techProfile?.full_name || "Technician";
  const jobRef = job.job_ref || `#${job.id.slice(0, 8)}`;

  const [tenantRes, settingsRes] = await Promise.all([
    supabaseAdmin.from("tenants").select("company_name").eq("id", req.tenantId!).single(),
    supabaseAdmin.from("company_settings").select("*").eq("tenant_id", req.tenantId!).eq("singleton_id", "default").maybeSingle(),
  ]);

  const companyName = (tenantRes.data as Record<string, unknown>)?.company_name as string || "Your Service Provider";
  const companySettings = settingsRes.data as Record<string, unknown> | null;

  const pdfCompany: PdfCompanySettings | undefined = companySettings ? {
    name: companySettings.name as string | null,
    trading_name: companySettings.trading_name as string | null,
    address_line1: companySettings.address_line1 as string | null,
    address_line2: companySettings.address_line2 as string | null,
    city: companySettings.city as string | null,
    county: companySettings.county as string | null,
    postcode: companySettings.postcode as string | null,
    phone: companySettings.phone as string | null,
    email: companySettings.email as string | null,
    website: companySettings.website as string | null,
    gas_safe_number: companySettings.gas_safe_number as string | null,
    oftec_number: companySettings.oftec_number as string | null,
    vat_number: companySettings.vat_number as string | null,
  } : undefined;

  let propertyAddress = "";
  if (job.property_id) {
    const { data: prop } = await supabaseAdmin.from("properties").select("address_line1, city, postcode").eq("id", job.property_id).maybeSingle();
    if (prop) {
      const r = prop as Record<string, unknown>;
      propertyAddress = [r.address_line1, r.city, r.postcode].filter(Boolean).join(", ");
    }
  }

  const scheduledDate = job.scheduled_date || "";
  const appliance = job.appliances as { fuel_type: string } | null;
  const fuelType = appliance?.fuel_type || "oil";
  const formCtx = { jobRef: job.job_ref || job.id.slice(0, 8).toUpperCase(), customerName, propertyAddress, technicianName, scheduledDate };

  // Gather all completed forms for this job
  const formsIncluded: Array<{ form_type: string; form_label: string; form_id: string }> = [];
  const attachments: EmailAttachment[] = [];

  for (const [formType, config] of Object.entries(FORM_TABLE_MAP)) {
    let q = supabaseAdmin.from(config.table).select("*").eq("job_id", jobId);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    const { data: records } = await q;
    if (!records || records.length === 0) continue;

    for (const record of records) {
      const rec = record as Record<string, unknown>;
      const pdfBuffer = generateFormPdf(formType, config.label, rec, config.fieldMap, formCtx, pdfCompany, fuelType);
      const safeLabel = config.label.replace(/[^a-zA-Z0-9]/g, "_");
      attachments.push({ filename: `${safeLabel}_${formCtx.jobRef}.pdf`, content: pdfBuffer });
      formsIncluded.push({ form_type: formType, form_label: config.label, form_id: rec.id as string });
    }
  }

  if (formsIncluded.length === 0) {
    res.status(400).json({ error: "No completed service forms found for this job" }); return;
  }

  const subject = `Job ${jobRef} — Service Certificate from ${companyName}`;

  const emailCompany: EmailCompanyDetails | undefined = pdfCompany ? {
    ...pdfCompany,
    logo_url: companySettings?.logo_url as string | null || null,
    rates_url: companySettings?.rates_url as string | null || null,
    trading_terms_url: companySettings?.trading_terms_url as string | null || null,
  } : undefined;

  try {
    await sendJobFormsEmail(
      customer.email,
      null,
      subject,
      jobRef,
      customerName,
      companyName,
      formsIncluded.map(f => f.form_label),
      attachments,
      emailCompany,
      0,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send email";
    res.status(500).json({ error: msg }); return;
  }

  await supabaseAdmin.from("job_email_logs").insert({
    job_id: jobId,
    tenant_id: req.tenantId,
    sent_by: req.userId,
    sent_to: customer.email,
    cc: null,
    subject,
    forms_included: formsIncluded,
    photos_included: null,
  });

  res.json({ success: true, message: `Certificate emailed to ${customer.email}`, forms_sent: formsIncluded.map(f => f.form_label) });
});

export default router;
