import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ListAppliancesQueryParams, ListAppliancesResponse, CreateApplianceBody, GetApplianceParams, GetApplianceResponse, UpdateApplianceParams, UpdateApplianceBody, UpdateApplianceResponse, DeleteApplianceParams, } from "@workspace/api-zod";
const router = Router();
router.get("/appliances", requireAuth, async (req, res) => {
    const query = ListAppliancesQueryParams.safeParse(req.query);
    let q = supabaseAdmin.from("appliances").select("*, properties(address_line1)").eq("is_active", true).order("manufacturer");
    if (query.success) {
        if (query.data.property_id)
            q = q.eq("property_id", query.data.property_id);
        if (query.data.search) {
            const s = `%${query.data.search}%`;
            q = q.or(`manufacturer.ilike.${s},model.ilike.${s},serial_number.ilike.${s}`);
        }
    }
    const { data, error } = await q;
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    const mapped = (data || []).map((a) => ({
        ...a,
        property_address: a.properties?.address_line1 || null,
        properties: undefined,
    }));
    res.json(ListAppliancesResponse.parse(mapped));
});
router.post("/appliances", requireAuth, async (req, res) => {
    const parsed = CreateApplianceBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin.from("appliances").insert(parsed.data).select().single();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.status(201).json(data);
});
router.get("/appliances/:id", requireAuth, async (req, res) => {
    const params = GetApplianceParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const { data: appliance, error } = await supabaseAdmin
        .from("appliances").select("*").eq("id", params.data.id).single();
    if (error || !appliance) {
        res.status(404).json({ error: "Appliance not found" });
        return;
    }
    const { data: property } = await supabaseAdmin
        .from("properties").select("*").eq("id", appliance.property_id).single();
    const { data: jobs } = await supabaseAdmin
        .from("jobs").select("*, customers(first_name, last_name), profiles(full_name), properties(address_line1)")
        .eq("appliance_id", params.data.id).eq("is_active", true).order("scheduled_date", { ascending: false }).limit(10);
    const mappedJobs = (jobs || []).map((j) => ({
        ...j,
        customer_name: j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : null,
        property_address: j.properties?.address_line1 || null,
        technician_name: j.profiles?.full_name || null,
        customers: undefined,
        profiles: undefined,
        properties: undefined,
    }));
    res.json(GetApplianceResponse.parse({
        ...appliance,
        property: property || undefined,
        recent_jobs: mappedJobs,
    }));
});
router.patch("/appliances/:id", requireAuth, async (req, res) => {
    const params = UpdateApplianceParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const body = UpdateApplianceBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: body.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("appliances").update(body.data).eq("id", params.data.id).select().single();
    if (error || !data) {
        res.status(404).json({ error: "Appliance not found" });
        return;
    }
    res.json(UpdateApplianceResponse.parse(data));
});
router.delete("/appliances/:id", requireAuth, requireRole("admin"), async (req, res) => {
    const params = DeleteApplianceParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    await supabaseAdmin.from("appliances").update({ is_active: false }).eq("id", params.data.id);
    res.sendStatus(204);
});
export default router;
