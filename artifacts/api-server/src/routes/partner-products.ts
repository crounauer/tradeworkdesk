import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const TENANT_FACING_FIELDS = "id, slug, name, category, partner_name, description_short, description_long, cta_label, partner_url, logo_url, disclosure_text, commission_model, audience_tags, placement_keys, is_active, priority, starts_at, ends_at, created_at, updated_at";

const ALLOWED_CATEGORIES = new Set([
  "insurance",
  "vehicle",
  "tools",
  "finance",
  "workwear",
  "website",
  "utilities",
]);

type PartnerProductPayload = {
  slug?: string;
  name?: string;
  category?: string;
  partner_name?: string | null;
  description_short?: string;
  description_long?: string | null;
  cta_label?: string;
  partner_url?: string;
  logo_url?: string | null;
  disclosure_text?: string;
  commission_model?: string;
  audience_tags?: unknown;
  placement_keys?: unknown;
  is_active?: boolean;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
};

function normalizeTextArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

function normalizeNullableString(input: unknown): string | null {
  if (input == null) return null;
  const value = String(input).trim();
  return value ? value : null;
}

function normalizeRequiredString(input: unknown, fieldName: string): string {
  const value = String(input || "").trim();
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

function normalizeCategory(input: unknown): string {
  const value = normalizeRequiredString(input, "category").toLowerCase();
  if (!ALLOWED_CATEGORIES.has(value)) {
    throw new Error("category is invalid");
  }
  return value;
}

function buildPartnerProductPayload(body: PartnerProductPayload, opts: { partial: boolean }): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (!opts.partial || "slug" in body) payload.slug = normalizeRequiredString(body.slug, "slug");
  if (!opts.partial || "name" in body) payload.name = normalizeRequiredString(body.name, "name");
  if (!opts.partial || "category" in body) payload.category = normalizeCategory(body.category);
  if (!opts.partial || "description_short" in body) payload.description_short = normalizeRequiredString(body.description_short, "description_short");
  if (!opts.partial || "partner_url" in body) payload.partner_url = normalizeRequiredString(body.partner_url, "partner_url");

  if ("partner_name" in body || !opts.partial) payload.partner_name = normalizeNullableString(body.partner_name);
  if ("description_long" in body || !opts.partial) payload.description_long = normalizeNullableString(body.description_long);
  if ("cta_label" in body || !opts.partial) payload.cta_label = normalizeNullableString(body.cta_label) || "Learn more";
  if ("logo_url" in body || !opts.partial) payload.logo_url = normalizeNullableString(body.logo_url);
  if ("disclosure_text" in body || !opts.partial) {
    payload.disclosure_text = normalizeNullableString(body.disclosure_text) || "We may earn a commission if you buy through this link.";
  }
  if ("commission_model" in body || !opts.partial) payload.commission_model = normalizeNullableString(body.commission_model) || "affiliate";
  if ("audience_tags" in body || !opts.partial) payload.audience_tags = normalizeTextArray(body.audience_tags);
  if ("placement_keys" in body || !opts.partial) payload.placement_keys = normalizeTextArray(body.placement_keys);
  if ("is_active" in body || !opts.partial) payload.is_active = body.is_active !== false;
  if ("priority" in body || !opts.partial) payload.priority = Number(body.priority) || 0;
  if ("starts_at" in body || !opts.partial) payload.starts_at = normalizeNullableString(body.starts_at);
  if ("ends_at" in body || !opts.partial) payload.ends_at = normalizeNullableString(body.ends_at);

  return payload;
}

async function logPlatformAudit(req: AuthenticatedRequest, eventType: string, entityId: string, detail: Record<string, unknown>) {
  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: req.userId,
    actor_email: req.userEmail,
    event_type: eventType,
    entity_type: "partner_product",
    entity_id: entityId,
    detail,
  });
}

router.get("/platform/partner-products", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("partner_products")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data || []);
});

router.get("/platform/partner-products/analytics", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("partner_product_clicks")
    .select("partner_product_id, placement_key, clicked_at, partner_products(name, slug)")
    .gte("clicked_at", since)
    .order("clicked_at", { ascending: false })
    .limit(10_000);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (data || []) as Array<{
    partner_product_id: string;
    placement_key: string | null;
    clicked_at: string;
    partner_products?: { name?: string; slug?: string } | Array<{ name?: string; slug?: string }> | null;
  }>;

  const totalClicks = rows.length;
  const byPlacement = new Map<string, number>();
  const byProduct = new Map<string, { id: string; name: string; slug: string; clicks: number }>();

  for (const row of rows) {
    const placement = String(row.placement_key || "unknown").trim() || "unknown";
    byPlacement.set(placement, (byPlacement.get(placement) || 0) + 1);

    const rel = Array.isArray(row.partner_products)
      ? row.partner_products[0]
      : row.partner_products;

    const id = String(row.partner_product_id);
    const existing = byProduct.get(id);
    if (existing) {
      existing.clicks += 1;
    } else {
      byProduct.set(id, {
        id,
        name: String(rel?.name || "Unknown product"),
        slug: String(rel?.slug || "unknown"),
        clicks: 1,
      });
    }
  }

  const placementBreakdown = [...byPlacement.entries()]
    .map(([placement_key, clicks]) => ({ placement_key, clicks }))
    .sort((a, b) => b.clicks - a.clicks);

  const topProducts = [...byProduct.values()]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  res.json({
    days,
    since,
    total_clicks: totalClicks,
    placement_breakdown: placementBreakdown,
    top_products: topProducts,
  });
});

router.post("/platform/partner-products", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const payload = buildPartnerProductPayload(req.body as PartnerProductPayload, { partial: false });
    const { data, error } = await supabaseAdmin
      .from("partner_products")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      res.status(500).json({ error: error?.message || "Failed to create partner product" });
      return;
    }

    await logPlatformAudit(req, "partner_product_created", data.id, {
      name: data.name,
      slug: data.slug,
      placement_keys: data.placement_keys,
    });

    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

router.patch("/platform/partner-products/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const payload = buildPartnerProductPayload(req.body as PartnerProductPayload, { partial: true });
    const { data, error } = await supabaseAdmin
      .from("partner_products")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error || !data) {
      res.status(404).json({ error: error?.message || "Partner product not found" });
      return;
    }

    await logPlatformAudit(req, "partner_product_updated", data.id, payload);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

router.delete("/platform/partner-products/:id", requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = String(req.params.id);

  const { error } = await supabaseAdmin
    .from("partner_products")
    .delete()
    .eq("id", id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logPlatformAudit(req, "partner_product_deleted", id, {});
  res.sendStatus(204);
});

router.get("/partner-products", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const placement = String(req.query.placement || "").trim();
  const category = String(req.query.category || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 12);
  const now = new Date().toISOString();

  let query = supabaseAdmin
    .from("partner_products")
    .select(TENANT_FACING_FIELDS)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("priority", { ascending: true })
    .limit(limit);

  if (placement) query = query.contains("placement_keys", [placement]);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const userAudienceTags = new Set<string>();
  if (req.userRole === "admin" || req.userRole === "super_admin") userAudienceTags.add("admin_only");

  if (req.tenantId) {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("company_type, trade")
      .eq("id", req.tenantId)
      .maybeSingle();

    const companyType = String((tenant as { company_type?: string } | null)?.company_type || "").toLowerCase();
    const trade = String((tenant as { trade?: string } | null)?.trade || "").toLowerCase();

    if (companyType === "sole_trader") userAudienceTags.add("sole_trader");
    if (companyType === "company") userAudienceTags.add("company");
    if (trade.includes("heat")) userAudienceTags.add("heating");
    if (trade.includes("plumb")) userAudienceTags.add("plumbing");
    if (trade.includes("electric")) userAudienceTags.add("electrical");
  }

  const filtered = (data || []).filter((product) => {
    const audiences = Array.isArray(product.audience_tags) ? product.audience_tags.map((value) => String(value)) : [];
    if (audiences.length === 0) return true;
    return audiences.some((tag) => userAudienceTags.has(tag));
  });

  res.json(filtered);
});

router.post("/partner-products/:id/click", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const placementKey = normalizeNullableString(req.body?.placement_key);
  const meta = typeof req.body?.meta === "object" && req.body?.meta !== null ? req.body.meta : {};

  const { data: product, error: productError } = await supabaseAdmin
    .from("partner_products")
    .select("id")
    .eq("id", req.params.id)
    .maybeSingle();

  if (productError) {
    res.status(500).json({ error: productError.message });
    return;
  }

  if (!product) {
    res.status(404).json({ error: "Partner product not found" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("partner_product_clicks")
    .insert({
      partner_product_id: req.params.id,
      tenant_id: req.tenantId || null,
      user_id: req.userId || null,
      placement_key: placementKey,
      meta,
    });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.sendStatus(204);
});

export default router;