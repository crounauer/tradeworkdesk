import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { GlobalSearchQueryParams, GlobalSearchResponse } from "@workspace/api-zod";

interface ApplianceSearchRow {
  id: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  boiler_type: string | null;
  fuel_type: string | null;
  is_active: boolean;
  property_id: string;
  properties?: { address_line1: string } | null;
  [key: string]: unknown;
}

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

  let appliancesQ = supabaseAdmin
    .from("appliances").select("*, properties(address_line1)").eq("is_active", true)
    .or(`manufacturer.ilike.${s},model.ilike.${s},serial_number.ilike.${s}`)
    .limit(10);
  if (tid) appliancesQ = appliancesQ.eq("tenant_id", tid);

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

  const [customersRes, propertiesRes, appliancesRes, jobsRes] = await Promise.all([
    customersQ, propertiesQ, appliancesQ, jobsQuery,
  ]);

  const mappedAppliances = (appliancesRes.data as ApplianceSearchRow[] || []).map((a) => ({
    ...a,
    property_address: a.properties?.address_line1 || null,
    properties: undefined,
  }));

  const mappedJobs = (jobsRes.data as JobSearchRow[] || []).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: j.properties?.address_line1 || null,
    technician_name: j.profiles?.full_name || null,
    customers: undefined,
    profiles: undefined,
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
