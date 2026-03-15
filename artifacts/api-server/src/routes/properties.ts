import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { verifyMultipleTenantOwnership } from "../lib/tenant-validation";
import {
  ListPropertiesQueryParams,
  ListPropertiesResponse,
  CreatePropertyBody,
  GetPropertyParams,
  GetPropertyResponse,
  UpdatePropertyParams,
  UpdatePropertyBody,
  UpdatePropertyResponse,
  DeletePropertyParams,
} from "@workspace/api-zod";

interface PropertyRow {
  id: string;
  customer_id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  access_notes: string | null;
  parking_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customers?: { first_name: string; last_name: string } | null;
}

interface PropertyJobRow {
  id: string;
  customer_id: string;
  property_id: string;
  status: string;
  job_type: string;
  scheduled_date: string;
  description: string | null;
  assigned_technician_id: string | null;
  customers?: { first_name: string; last_name: string } | null;
  profiles?: { full_name: string } | null;
  [key: string]: unknown;
}

const router: IRouter = Router();

router.get("/properties", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListPropertiesQueryParams.safeParse(req.query);
  let q = supabaseAdmin.from("properties").select("*, customers(first_name, last_name)").eq("is_active", true).order("address_line1");

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  if (query.success) {
    if (query.data.customer_id) q = q.eq("customer_id", query.data.customer_id);
    if (query.data.search) {
      const s = `%${query.data.search}%`;
      q = q.or(`address_line1.ilike.${s},city.ilike.${s},postcode.ilike.${s}`);
    }
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data as PropertyRow[] || []).map((p) => ({
    ...p,
    customer_name: p.customers ? `${p.customers.first_name} ${p.customers.last_name}` : null,
    customers: undefined,
  }));

  res.json(ListPropertiesResponse.parse(mapped));
});

router.post("/properties", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { valid, failedTable } = await verifyMultipleTenantOwnership(
    [{ table: "customers", id: parsed.data.customer_id }], req.tenantId
  );
  if (!valid) { res.status(403).json({ error: `Referenced ${failedTable} does not belong to your company.` }); return; }

  const { data, error } = await supabaseAdmin.from("properties").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.get("/properties/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("properties").select("*").eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: property, error } = await q.single();
  if (error || !property) { res.status(404).json({ error: "Property not found" }); return; }

  const { data: customer } = await supabaseAdmin
    .from("customers").select("*").eq("id", property.customer_id).single();
  const { data: appliances } = await supabaseAdmin
    .from("appliances").select("*").eq("property_id", params.data.id).eq("is_active", true);
  const { data: jobs } = await supabaseAdmin
    .from("jobs").select("*, customers(first_name, last_name), profiles(full_name)")
    .eq("property_id", params.data.id).eq("is_active", true).order("scheduled_date", { ascending: false }).limit(10);

  const mappedJobs = (jobs as PropertyJobRow[] || []).map((j) => ({
    ...j,
    customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
    property_address: property.address_line1,
    technician_name: j.profiles?.full_name || null,
    customers: undefined,
    profiles: undefined,
  }));

  res.json(GetPropertyResponse.parse({
    ...property,
    customer: customer || undefined,
    appliances: appliances || [],
    recent_jobs: mappedJobs,
  }));
});

router.patch("/properties/:id", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdatePropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdatePropertyBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  if (body.data.customer_id) {
    const { valid, failedTable } = await verifyMultipleTenantOwnership(
      [{ table: "customers", id: body.data.customer_id }], req.tenantId
    );
    if (!valid) { res.status(403).json({ error: `Referenced ${failedTable} does not belong to your company.` }); return; }
  }

  let q = supabaseAdmin.from("properties").update(body.data).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error || !data) { res.status(404).json({ error: "Property not found" }); return; }
  res.json(UpdatePropertyResponse.parse(data));
});

router.delete("/properties/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeletePropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("properties").update({ is_active: false }).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  await q;
  res.sendStatus(204);
});

export default router;
