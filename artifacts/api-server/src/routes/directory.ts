import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

interface ListingRow {
  id: string;
  name: string;
  trading_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  logo_url: string | null;
  is_publicly_listed: boolean;
  listing_slug: string | null;
  public_description: string | null;
  trade_types: string | null;
  service_area: string | null;
  tenant_id: string;
}

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/directory — list all publicly listed businesses
// Optional query params: ?q=search&trade=Gas+Engineer
// ---------------------------------------------------------------------------
router.get("/directory", async (req: Request, res: Response): Promise<void> => {
  const { q, trade } = req.query as { q?: string; trade?: string };

  let query = supabaseAdmin
    .from("company_settings")
    .select("id, name, trading_name, phone, email, website, address_line1, city, county, postcode, logo_url, listing_slug, public_description, trade_types, service_area, tenant_id")
    .eq("is_publicly_listed", true)
    .not("listing_slug", "is", null)
    .order("name");

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  let results = (data || []) as ListingRow[];

  // Filter by search query (name, description, trade_types, service_area)
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    results = results.filter(r =>
      (r.name || "").toLowerCase().includes(term) ||
      (r.trading_name || "").toLowerCase().includes(term) ||
      (r.public_description || "").toLowerCase().includes(term) ||
      (r.trade_types || "").toLowerCase().includes(term) ||
      (r.service_area || "").toLowerCase().includes(term) ||
      (r.city || "").toLowerCase().includes(term) ||
      (r.county || "").toLowerCase().includes(term) ||
      (r.postcode || "").toLowerCase().includes(term)
    );
  }

  // Filter by trade type
  if (trade && trade.trim()) {
    const tradeTerm = trade.trim().toLowerCase();
    results = results.filter(r =>
      (r.trade_types || "").toLowerCase().includes(tradeTerm)
    );
  }

  res.set("Cache-Control", "public, max-age=300"); // 5 min public cache
  res.json(results.map(r => ({
    slug: r.listing_slug,
    name: r.trading_name || r.name,
    description: r.public_description,
    trade_types: r.trade_types ? r.trade_types.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    service_area: r.service_area,
    city: r.city,
    county: r.county,
    postcode: r.postcode,
    phone: r.phone,
    email: r.email,
    website: r.website,
    logo_url: r.logo_url,
  })));
});

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/directory/:slug — get a single business profile
// ---------------------------------------------------------------------------
router.get("/directory/:slug", async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  if (!slug) { res.status(400).json({ error: "Missing slug" }); return; }

  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .select("id, name, trading_name, phone, email, website, address_line1, address_line2, city, county, postcode, logo_url, listing_slug, public_description, trade_types, service_area, tenant_id, gas_safe_number, oftec_number")
    .eq("listing_slug", slug)
    .eq("is_publicly_listed", true)
    .single();

  if (error || !data) { res.status(404).json({ error: "Business not found" }); return; }

  const r = data as ListingRow & { gas_safe_number?: string; oftec_number?: string; address_line2?: string };

  res.set("Cache-Control", "public, max-age=300");
  res.json({
    slug: r.listing_slug,
    name: r.trading_name || r.name,
    description: r.public_description,
    trade_types: r.trade_types ? r.trade_types.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    service_area: r.service_area,
    address_line1: r.address_line1,
    address_line2: r.address_line2,
    city: r.city,
    county: r.county,
    postcode: r.postcode,
    phone: r.phone,
    email: r.email,
    website: r.website,
    logo_url: r.logo_url,
    gas_safe_number: r.gas_safe_number || null,
    oftec_number: r.oftec_number || null,
  });
});

// ---------------------------------------------------------------------------
// PRIVATE: GET /api/admin/directory-listing — get current tenant's listing settings
// ---------------------------------------------------------------------------
router.get("/admin/directory-listing", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin
    .from("company_settings")
    .select("is_publicly_listed, listing_slug, public_description, trade_types, service_area")
    .eq("singleton_id", "default");
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || { is_publicly_listed: false, listing_slug: null, public_description: null, trade_types: null, service_area: null });
});

// ---------------------------------------------------------------------------
// PRIVATE: PATCH /api/admin/directory-listing — update listing settings
// ---------------------------------------------------------------------------
router.patch("/admin/directory-listing", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { is_publicly_listed, listing_slug, public_description, trade_types, service_area } = req.body as {
    is_publicly_listed?: boolean;
    listing_slug?: string;
    public_description?: string;
    trade_types?: string;
    service_area?: string;
  };

  const updates: Record<string, unknown> = {};
  if (is_publicly_listed !== undefined) updates.is_publicly_listed = !!is_publicly_listed;
  if (public_description !== undefined) updates.public_description = public_description.trim() || null;
  if (trade_types !== undefined) updates.trade_types = trade_types.trim() || null;
  if (service_area !== undefined) updates.service_area = service_area.trim() || null;

  if (listing_slug !== undefined) {
    const slug = listing_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!slug) { res.status(400).json({ error: "Invalid slug" }); return; }

    // Check uniqueness (exclude current tenant)
    let checkQ = supabaseAdmin
      .from("company_settings")
      .select("tenant_id")
      .eq("listing_slug", slug);
    if (req.tenantId) checkQ = checkQ.neq("tenant_id", req.tenantId);
    const { data: existing } = await checkQ.maybeSingle();
    if (existing) { res.status(409).json({ error: "This URL is already taken. Please choose a different one." }); return; }
    updates.listing_slug = slug;
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  let upsertQ = supabaseAdmin
    .from("company_settings")
    .update(updates)
    .eq("singleton_id", "default");
  if (req.tenantId) upsertQ = upsertQ.eq("tenant_id", req.tenantId);

  const { data, error } = await upsertQ.select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/directory/check-slug/:slug — check if a slug is available
// ---------------------------------------------------------------------------
router.get("/directory/check-slug/:slug", async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const normalised = (slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!normalised) { res.json({ available: false }); return; }

  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("tenant_id")
    .eq("listing_slug", normalised)
    .maybeSingle();

  res.json({ available: !data, slug: normalised });
});

export default router;
