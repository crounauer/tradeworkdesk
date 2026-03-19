import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, jobTypes } from "@workspace/db";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { seedDefaultJobTypesForTenant } from "../lib/job-types-seed";

const router: IRouter = Router();

router.get("/job-types", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.tenantId) { res.status(400).json({ error: "Tenant required" }); return; }
  await seedDefaultJobTypesForTenant(req.tenantId);

  const includeInactive = req.query.includeInactive === "true";

  const conditions = includeInactive
    ? eq(jobTypes.tenant_id, req.tenantId)
    : and(eq(jobTypes.tenant_id, req.tenantId), eq(jobTypes.is_active, true));

  const all = await db
    .select()
    .from(jobTypes)
    .where(conditions)
    .orderBy(jobTypes.sort_order, jobTypes.name);

  res.json(all);
});

router.post("/job-types", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

  const existing = await db
    .select()
    .from(jobTypes)
    .where(eq(jobTypes.tenant_id, req.tenantId))
    .orderBy(jobTypes.sort_order);

  const maxOrder = existing.reduce((max, t) => Math.max(max, t.sort_order), -1);

  const [created] = await db.insert(jobTypes).values({
    tenant_id: req.tenantId,
    name: name.trim(),
    slug,
    category: cat,
    color: color || "#3B82F6",
    default_duration_minutes: default_duration_minutes || null,
    is_active: true,
    is_default: false,
    sort_order: maxOrder + 1,
  }).returning();

  res.status(201).json(created);
});

router.patch("/job-types/:id", requireAuth, requireTenant, requireRole("admin", "office_staff"), async (req: AuthenticatedRequest, res): Promise<void> => {
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

  const updates: Partial<typeof jobTypes.$inferInsert> = {};
  if (name !== undefined) {
    updates.name = name.trim();
    updates.slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (category !== undefined && validCategories.includes(category)) updates.category = category;
  if (color !== undefined) updates.color = color;
  if (default_duration_minutes !== undefined) updates.default_duration_minutes = default_duration_minutes;
  if (is_active !== undefined) updates.is_active = is_active;

  const [updated] = await db
    .update(jobTypes)
    .set(updates)
    .where(and(eq(jobTypes.id, id), eq(jobTypes.tenant_id, req.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Job type not found" }); return; }
  res.json(updated);
});

export default router;
