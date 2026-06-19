import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { GlobalSearchQueryParams, GlobalSearchResponse } from "@workspace/api-zod";

interface JobSearchRow {
  id: string;
  customer_id: string;
  property_id: string;
  status: string;
  job_type: string;
  scheduled_date: string;
  description: string | null;
  assigned_technician_id: string | null;
  customers?: { first_name: string; last_name: string } | null;
  properties?: { address_line1: string } | null;
  profiles?: { full_name: string } | null;
  [key: string]: unknown;
}

interface ApplianceSearchRow {
  id: string;
  property_id: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  boiler_type: string | null;
  fuel_type: string | null;
  system_type: string | null;
  installation_date: string | null;
  warranty_expiry: string | null;
  burner_make: string | null;
  burner_model: string | null;
  nozzle_size: string | null;
  pump_pressure: string | null;
  controls: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  properties?: { address_line1: string } | null;
}

const router: IRouter = Router();

router.get("/search", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = GlobalSearchQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const s = `%${query.data.q}%`;
  const tid = req.tenantId;

  let customersQ = supabaseAdmin
    .from("customers").select("*").eq("is_active", true)
    .or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},postcode.ilike.${s}`)
    .limit(10);
  if (tid) customersQ = customersQ.eq("tenant_id", tid);

  let propertiesQ = supabaseAdmin
    .from("properties").select("*").eq("is_active", true)
    .or(`address_line1.ilike.${s},city.ilike.${s},postcode.ilike.${s}`)
    .limit(10);
  if (tid) propertiesQ = propertiesQ.eq("tenant_id", tid);

  let jobsQuery = supabaseAdmin
    .from("jobs")
    .select("*, customers(first_name, last_name), properties(address_line1), profiles(full_name)")
    .eq("is_active", true)
    .or(`description.ilike.${s},notes.ilike.${s}`)
    .limit(10);
  if (tid) jobsQuery = jobsQuery.eq("tenant_id", tid);

  if (req.userRole === "technician") {
    jobsQuery = jobsQuery.eq("assigned_technician_id", req.userId!);
  }

  let appliancesQ = supabaseAdmin
    .from("appliances")
    .select("*, properties(address_line1)")
    .eq("is_active", true)
    .or(`manufacturer.ilike.${s},model.ilike.${s},serial_number.ilike.${s},notes.ilike.${s},burner_make.ilike.${s},burner_model.ilike.${s}`)
    .limit(10);
  if (tid) appliancesQ = appliancesQ.eq("tenant_id", tid);

  const [customersRes, propertiesRes, appliancesRes, jobsRes] = await Promise.all([
    customersQ, propertiesQ, appliancesQ, jobsQuery,
  ]);

  const matchedCustomerIds = (customersRes.data || []).map((customer) => customer.id);
  const matchedPropertyIds = (propertiesRes.data || []).map((property) => property.id);

  let jobsByRelatedRes: { data: JobSearchRow[] | null } = { data: null };
  if (matchedCustomerIds.length > 0 || matchedPropertyIds.length > 0) {
    let jobsByRelatedQuery = supabaseAdmin
      .from("jobs")
      .select("*, customers(first_name, last_name), properties(address_line1), profiles(full_name)")
      .eq("is_active", true)
      .limit(10);
    if (tid) jobsByRelatedQuery = jobsByRelatedQuery.eq("tenant_id", tid);
    if (req.userRole === "technician") {
      jobsByRelatedQuery = jobsByRelatedQuery.eq("assigned_technician_id", req.userId!);
    }

    const relatedFilters: string[] = [];
    if (matchedCustomerIds.length > 0) {
      relatedFilters.push(`customer_id.in.(${matchedCustomerIds.join(",")})`);
    }
    if (matchedPropertyIds.length > 0) {
      relatedFilters.push(`property_id.in.(${matchedPropertyIds.join(",")})`);
    }
    jobsByRelatedQuery = jobsByRelatedQuery.or(relatedFilters.join(","));
    const relatedQueryResult = await jobsByRelatedQuery;
    jobsByRelatedRes = { data: (relatedQueryResult.data as JobSearchRow[]) || [] };
  }

  const dedupedJobs = new Map<string, JobSearchRow>();
  for (const row of (jobsRes.data as JobSearchRow[] || [])) dedupedJobs.set(row.id, row);
  for (const row of (jobsByRelatedRes.data as JobSearchRow[] || [])) dedupedJobs.set(row.id, row);

  const mappedJobs = Array.from(dedupedJobs.values()).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    customers: undefined,
    profiles: undefined,
    properties: undefined,
  }));

  const mappedAppliances = ((appliancesRes.data as ApplianceSearchRow[] || [])).map((a) => ({
    ...a,
    property_address: a.properties?.address_line1 || null,
    properties: undefined,
  }));

  res.json(GlobalSearchResponse.parse({
    customers: customersRes.data || [],
    properties: propertiesRes.data || [],
    appliances: mappedAppliances,
    jobs: mappedJobs,
  }));
});

export default router;
