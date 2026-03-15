import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { GlobalSearchQueryParams, GlobalSearchResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/search", requireAuth, async (req, res): Promise<void> => {
  const query = GlobalSearchQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const s = `%${query.data.q}%`;

  const [customersRes, propertiesRes, appliancesRes, jobsRes] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("*")
      .eq("is_active", true)
      .or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},postcode.ilike.${s}`)
      .limit(10),
    supabaseAdmin
      .from("properties")
      .select("*")
      .eq("is_active", true)
      .or(`address_line1.ilike.${s},city.ilike.${s},postcode.ilike.${s}`)
      .limit(10),
    supabaseAdmin
      .from("appliances")
      .select("*, properties(address_line1)")
      .eq("is_active", true)
      .or(`manufacturer.ilike.${s},model.ilike.${s},serial_number.ilike.${s}`)
      .limit(10),
    supabaseAdmin
      .from("jobs")
      .select("*, customers(first_name, last_name), properties(address_line1), profiles(full_name)")
      .eq("is_active", true)
      .or(`description.ilike.${s},notes.ilike.${s}`)
      .limit(10),
  ]);

  const mappedAppliances = (appliancesRes.data || []).map((a: any) => ({
    ...a,
    property_address: a.properties?.address_line1 || null,
    properties: undefined,
  }));

  const mappedJobs = (jobsRes.data || []).map((j: any) => ({
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
