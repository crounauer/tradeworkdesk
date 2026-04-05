import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { seedDefaultJobTypesForTenant } from "../lib/job-types-seed";

const router: IRouter = Router();

router.get("/job-types", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.tenantId) { res.status(400).json({ error: "Tenant required" }); return; }
  await seedDefaultJobTypesForTenant(req.tenantId);

  const includeInactive = req.query.includeInactive === "true";

  let q = supabaseAdmin
    .from("job_types")
    .select("*")
    .eq("tenant_id", req.tenantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!includeInactive) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

router.post("/job-types", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.tenantId) { res.status(400).json({ error: "Tenant required" }); return; }

  const { name, category, color, default_duration_minutes } = req.body as {
    name?: string;
    category?: string;
    color?: string;
    default_duration_minutes?: number;
  };

  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }

  const validCategories = ["service", "breakdown", "installation", "inspection", "follow_up"];
  const cat = category && validCategories.includes(category) ? category : "service";
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data: existing } = await supabaseAdmin
    .from("job_types")
    .select("sort_order")
    .eq("tenant_id", req.tenantId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxOrder = existing && existing.length > 0 ? existing[0].sort_order : -1;

  const { data: created, error } = await supabaseAdmin
    .from("job_types")
    .insert({
      tenant_id: req.tenantId,
      name: name.trim(),
      slug,
      category: cat,
      color: color || "#3B82F6",
      default_duration_minutes: default_duration_minutes || null,
      is_active: true,
      is_default: false,
      sort_order: maxOrder + 1,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(created);
});

router.patch("/job-types/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.tenantId) { res.status(400).json({ error: "Tenant required" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, category, color, default_duration_minutes, is_active } = req.body as {
    name?: string;
    category?: string;
    color?: string;
    default_duration_minutes?: number | null;
    is_active?: boolean;
  };

  const validCategories = ["service", "breakdown", "installation", "inspection", "follow_up"];

  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) { res.status(400).json({ error: "Name cannot be empty" }); return; }
    updates.name = trimmed;
    updates.slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (category !== undefined && validCategories.includes(category)) updates.category = category;
  if (color !== undefined) updates.color = color;
  if (default_duration_minutes !== undefined) updates.default_duration_minutes = default_duration_minutes;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data: updated, error } = await supabaseAdmin
    .from("job_types")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", req.tenantId)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    res.status(status).json({ error: status === 404 ? "Job type not found" : error.message }); return;
  }
  if (!updated) { res.status(404).json({ error: "Job type not found" }); return; }
  res.json(updated);
});

export default router;
