import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import {
  GetUpcomingServicesResponse,
  GetOverdueServicesResponse,
  GetCompletedByTechnicianQueryParams,
  GetCompletedByTechnicianResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports/upcoming-services", requireAuth, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const { data, error } = await supabaseAdmin
    .from("appliances")
    .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
    .eq("is_active", true)
    .not("next_service_due", "is", null)
    .gte("next_service_due", today)
    .lte("next_service_due", thirtyDays)
    .order("next_service_due");

  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((a: any) => ({
    appliance_id: a.id,
    manufacturer: a.manufacturer,
    model: a.model,
    serial_number: a.serial_number,
    next_service_due: a.next_service_due,
    property_address: a.properties?.address_line1 || null,
    customer_name: a.properties?.customers ? `${a.properties.customers.first_name} ${a.properties.customers.last_name}` : null,
    customer_id: a.properties?.customers?.id || null,
    property_id: a.properties?.id || null,
  }));

  res.json(GetUpcomingServicesResponse.parse(mapped));
});

router.get("/reports/overdue-services", requireAuth, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseAdmin
    .from("appliances")
    .select("id, manufacturer, model, serial_number, next_service_due, properties(id, address_line1, customer_id, customers(id, first_name, last_name))")
    .eq("is_active", true)
    .not("next_service_due", "is", null)
    .lt("next_service_due", today)
    .order("next_service_due");

  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((a: any) => ({
    appliance_id: a.id,
    manufacturer: a.manufacturer,
    model: a.model,
    serial_number: a.serial_number,
    next_service_due: a.next_service_due,
    property_address: a.properties?.address_line1 || null,
    customer_name: a.properties?.customers ? `${a.properties.customers.first_name} ${a.properties.customers.last_name}` : null,
    customer_id: a.properties?.customers?.id || null,
    property_id: a.properties?.id || null,
  }));

  res.json(GetOverdueServicesResponse.parse(mapped));
});

router.get("/reports/completed-by-technician", requireAuth, async (req, res): Promise<void> => {
  const query = GetCompletedByTechnicianQueryParams.safeParse(req.query);

  let q = supabaseAdmin
    .from("jobs")
    .select("*, customers(first_name, last_name), properties(address_line1), profiles!assigned_technician_id(id, full_name)")
    .eq("status", "completed")
    .eq("is_active", true)
    .not("assigned_technician_id", "is", null);

  if (query.success) {
    if (query.data.date_from) q = q.gte("scheduled_date", query.data.date_from);
    if (query.data.date_to) q = q.lte("scheduled_date", query.data.date_to);
  }

  const { data, error } = await q.order("scheduled_date", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }

  const grouped: Record<string, any> = {};
  for (const j of data || []) {
    const tech = (j as any).profiles;
    if (!tech) continue;
    const tid = tech.id;
    if (!grouped[tid]) {
      grouped[tid] = { technician_id: tid, technician_name: tech.full_name, completed_count: 0, jobs: [] };
    }
    grouped[tid].completed_count++;
    grouped[tid].jobs.push({
      ...j,
      customer_name: (j as any).customers ? `${(j as any).customers.first_name} ${(j as any).customers.last_name}` : null,
      property_address: (j as any).properties?.address_line1 || null,
      technician_name: tech.full_name,
      customers: undefined,
      profiles: undefined,
      properties: undefined,
    });
  }

  res.json(GetCompletedByTechnicianResponse.parse(Object.values(grouped)));
});

export default router;
