import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole } from "../middlewares/auth";
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

const router: IRouter = Router();

router.get("/properties", requireAuth, async (req, res): Promise<void> => {
  const query = ListPropertiesQueryParams.safeParse(req.query);
  let q = supabaseAdmin.from("properties").select("*, customers(first_name, last_name)").eq("is_active", true).order("address_line1");

  if (query.success) {
    if (query.data.customer_id) q = q.eq("customer_id", query.data.customer_id);
    if (query.data.search) {
      const s = `%${query.data.search}%`;
      q = q.or(`address_line1.ilike.${s},city.ilike.${s},postcode.ilike.${s}`);
    }
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((p: any) => ({
    ...p,
    customer_name: p.customers ? `${p.customers.first_name} ${p.customers.last_name}` : null,
    customers: undefined,
  }));

  res.json(ListPropertiesResponse.parse(mapped));
});

router.post("/properties", requireAuth, requireRole("admin", "office_staff"), async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("properties").insert(parsed.data).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.get("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data: property, error } = await supabaseAdmin
    .from("properties").select("*").eq("id", params.data.id).single();
  if (error || !property) { res.status(404).json({ error: "Property not found" }); return; }

  const { data: customer } = await supabaseAdmin
    .from("customers").select("*").eq("id", property.customer_id).single();
  const { data: appliances } = await supabaseAdmin
    .from("appliances").select("*").eq("property_id", params.data.id).eq("is_active", true);
  const { data: jobs } = await supabaseAdmin
    .from("jobs").select("*, customers(first_name, last_name), profiles(full_name)")
    .eq("property_id", params.data.id).eq("is_active", true).order("scheduled_date", { ascending: false }).limit(10);

  const mappedJobs = (jobs || []).map((j: any) => ({
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

router.patch("/properties/:id", requireAuth, requireRole("admin", "office_staff"), async (req, res): Promise<void> => {
  const params = UpdatePropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdatePropertyBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("properties").update(body.data).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Property not found" }); return; }
  res.json(UpdatePropertyResponse.parse(data));
});

router.delete("/properties/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeletePropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await supabaseAdmin.from("properties").update({ is_active: false }).eq("id", params.data.id);
  res.sendStatus(204);
});

export default router;
