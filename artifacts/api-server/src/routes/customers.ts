import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  ListCustomersQueryParams,
  ListCustomersResponse,
  CreateCustomerBody,
  GetCustomerParams,
  GetCustomerResponse,
  UpdateCustomerParams,
  UpdateCustomerBody,
  UpdateCustomerResponse,
  DeleteCustomerParams,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

router.get("/customers", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  let q = supabaseAdmin.from("customers").select("*").order("last_name");

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  if (query.success) {
    if (query.data.is_active !== undefined) {
      q = q.eq("is_active", query.data.is_active);
    } else {
      q = q.eq("is_active", true);
    }
    if (query.data.search) {
      const s = `%${query.data.search}%`;
      q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},postcode.ilike.${s}`);
    }
  } else {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(ListCustomersResponse.parse(data || []));
});

router.post("/customers", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabaseAdmin.from("customers").insert({ ...parsed.data, tenant_id: req.tenantId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.get("/customers/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("customers").select("*").eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: customer, error } = await q.single();
  if (error || !customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const { data: properties } = await supabaseAdmin
    .from("properties").select("*").eq("customer_id", params.data.id).eq("is_active", true).order("address_line1");

  res.json(GetCustomerResponse.parse({ ...customer, properties: properties || [] }));
});

router.patch("/customers/:id", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateCustomerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let q = supabaseAdmin.from("customers").update(body.data).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().single();
  if (error || !data) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(UpdateCustomerResponse.parse(data));
});

router.delete("/customers/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("customers").update({ is_active: false }).eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  await q;
  res.sendStatus(204);
});

const ImportCustomerRow = z.object({
  title: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  postcode: z.string().optional(),
  notes: z.string().optional(),
});

const ImportCustomersBody = z.object({
  customers: z.array(z.record(z.string(), z.string().optional())),
  skipDuplicates: z.boolean().default(true),
});

router.post("/customers/import", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ImportCustomersBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { customers: rows, skipDuplicates } = parsed.data;
  const tenantId = req.tenantId!;

  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("email, phone, last_name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const emailSet = new Set<string>();
  const phoneLastNameSet = new Set<string>();
  for (const c of existing || []) {
    if (c.email) emailSet.add(c.email.toLowerCase().trim());
    if (c.phone && c.last_name) phoneLastNameSet.add(`${c.phone.trim()}|${c.last_name.toLowerCase().trim()}`);
  }

  let created = 0;
  let skipped = 0;
  const failed: { row: number; reason: string }[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const cleaned: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(raw)) {
      cleaned[k] = v?.trim() || undefined;
    }

    const v = ImportCustomerRow.safeParse(cleaned);
    if (!v.success) {
      failed.push({ row: i + 1, reason: "Missing required fields (first_name, last_name)" });
      continue;
    }

    const row = v.data;
    let isDuplicate = false;
    if (row.email && emailSet.has(row.email.toLowerCase().trim())) {
      isDuplicate = true;
    }
    if (!isDuplicate && row.phone && row.last_name) {
      const key = `${row.phone.trim()}|${row.last_name.toLowerCase().trim()}`;
      if (phoneLastNameSet.has(key)) isDuplicate = true;
    }

    if (isDuplicate && skipDuplicates) {
      skipped++;
      continue;
    }

    toInsert.push({ ...row, tenant_id: tenantId });
    if (row.email) emailSet.add(row.email.toLowerCase().trim());
    if (row.phone && row.last_name) phoneLastNameSet.add(`${row.phone.trim()}|${row.last_name.toLowerCase().trim()}`);
  }

  if (toInsert.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error } = await supabaseAdmin.from("customers").insert(batch);
      if (error) {
        for (let j = 0; j < batch.length; j++) {
          failed.push({ row: i + j + 1, reason: error.message });
        }
      } else {
        created += batch.length;
      }
    }
  }

  res.json({ created, skipped, failed, total: rows.length });
});

router.post("/customers/check-duplicates", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = z.object({ customers: z.array(z.record(z.string(), z.string().optional())) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const tenantId = req.tenantId!;
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("email, phone, last_name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const emailSet = new Set<string>();
  const phoneLastNameSet = new Set<string>();
  for (const c of existing || []) {
    if (c.email) emailSet.add(c.email.toLowerCase().trim());
    if (c.phone && c.last_name) phoneLastNameSet.add(`${c.phone.trim()}|${c.last_name.toLowerCase().trim()}`);
  }

  const duplicates: number[] = [];
  for (let i = 0; i < body.data.customers.length; i++) {
    const row = body.data.customers[i];
    const email = row.email?.trim().toLowerCase();
    const phone = row.phone?.trim();
    const lastName = row.last_name?.trim().toLowerCase();

    let isDup = false;
    if (email && emailSet.has(email)) isDup = true;
    if (!isDup && phone && lastName && phoneLastNameSet.has(`${phone}|${lastName}`)) isDup = true;

    if (isDup) duplicates.push(i);
  }

  res.json({ duplicates });
});

export default router;
