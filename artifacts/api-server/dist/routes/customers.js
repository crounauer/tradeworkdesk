import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ListCustomersQueryParams, ListCustomersResponse, CreateCustomerBody, GetCustomerParams, GetCustomerResponse, UpdateCustomerParams, UpdateCustomerBody, UpdateCustomerResponse, DeleteCustomerParams, } from "@workspace/api-zod";
const router = Router();
router.get("/customers", requireAuth, async (req, res) => {
    const query = ListCustomersQueryParams.safeParse(req.query);
    let q = supabaseAdmin.from("customers").select("*").order("last_name");
    if (query.success) {
        if (query.data.is_active !== undefined) {
            q = q.eq("is_active", query.data.is_active);
        }
        else {
            q = q.eq("is_active", true);
        }
        if (query.data.search) {
            const s = `%${query.data.search}%`;
            q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},postcode.ilike.${s}`);
        }
    }
    else {
        q = q.eq("is_active", true);
    }
    const { data, error } = await q;
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.json(ListCustomersResponse.parse(data || []));
});
router.post("/customers", requireAuth, requireRole("admin", "office_staff"), async (req, res) => {
    const parsed = CreateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin.from("customers").insert(parsed.data).select().single();
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.status(201).json(data);
});
router.get("/customers/:id", requireAuth, async (req, res) => {
    const params = GetCustomerParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const { data: customer, error } = await supabaseAdmin
        .from("customers").select("*").eq("id", params.data.id).single();
    if (error || !customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
    }
    const { data: properties } = await supabaseAdmin
        .from("properties").select("*").eq("customer_id", params.data.id).eq("is_active", true).order("address_line1");
    res.json(GetCustomerResponse.parse({ ...customer, properties: properties || [] }));
});
router.patch("/customers/:id", requireAuth, requireRole("admin", "office_staff"), async (req, res) => {
    const params = UpdateCustomerParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const body = UpdateCustomerBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: body.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("customers").update(body.data).eq("id", params.data.id).select().single();
    if (error || !data) {
        res.status(404).json({ error: "Customer not found" });
        return;
    }
    res.json(UpdateCustomerResponse.parse(data));
});
router.delete("/customers/:id", requireAuth, requireRole("admin"), async (req, res) => {
    const params = DeleteCustomerParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    await supabaseAdmin.from("customers").update({ is_active: false }).eq("id", params.data.id);
    res.sendStatus(204);
});
export default router;
