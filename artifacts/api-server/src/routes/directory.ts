import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { geocodeAddress, calculateDistanceMiles } from "../lib/geocode";
import { sendEnquiryAcknowledgementEmail, type EmailCompanyDetails } from "../lib/email";
import { notifyUsersForEvent } from "../lib/push-events";

const router: IRouter = Router();

const directoryEnquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many enquiries sent. Please wait a few minutes and try again." },
  keyGenerator: (req) => `directory-enquiry:${req.params.slug || "unknown"}:${ipKeyGenerator(req.ip || "unknown")}`,
});

const directoryReviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reviews submitted. Please try again later." },
  keyGenerator: (req) => `directory-review:${req.params.slug || "unknown"}:${ipKeyGenerator(req.ip || "unknown")}`,
});

async function loadDirectoryEmailCompanyDetails(tenantId: string): Promise<{ companyName: string; details: EmailCompanyDetails }> {
  const [{ data: companySettings }, { data: tenant }] = await Promise.all([
    supabaseAdmin
      .from("company_settings")
      .select("name, trading_name, logo_url, address_line1, address_line2, city, county, postcode, phone, email, notification_emails, website, gas_safe_number, oftec_number, vat_number, rates_url, trading_terms_url, email_from_name, email_reply_to, email_templates")
      .eq("tenant_id", tenantId)
      .eq("singleton_id", "default")
      .maybeSingle(),
    supabaseAdmin.from("tenants").select("company_name").eq("id", tenantId).maybeSingle(),
  ]);
  const cs = companySettings as Record<string, unknown> | null;
  const companyName = (cs?.name as string) || (cs?.trading_name as string) || (tenant?.company_name as string) || "Your Service Provider";
  return {
    companyName,
    details: {
      name: (cs?.name as string | null) || (tenant?.company_name as string | null) || null,
      trading_name: (cs?.trading_name as string | null) || null,
      logo_url: (cs?.logo_url as string | null) || null,
      address_line1: (cs?.address_line1 as string | null) || null,
      address_line2: (cs?.address_line2 as string | null) || null,
      city: (cs?.city as string | null) || null,
      county: (cs?.county as string | null) || null,
      postcode: (cs?.postcode as string | null) || null,
      phone: (cs?.phone as string | null) || null,
      email: (cs?.email as string | null) || null,
      notification_emails: (cs?.notification_emails as string[] | null) || null,
      website: (cs?.website as string | null) || null,
      gas_safe_number: (cs?.gas_safe_number as string | null) || null,
      oftec_number: (cs?.oftec_number as string | null) || null,
      vat_number: (cs?.vat_number as string | null) || null,
      rates_url: (cs?.rates_url as string | null) || null,
      trading_terms_url: (cs?.trading_terms_url as string | null) || null,
      email_from_name: (cs?.email_from_name as string | null) || null,
      email_reply_to: (cs?.email_reply_to as string | null) || null,
      email_templates: (cs?.email_templates as EmailCompanyDetails["email_templates"]) || null,
    },
  };
}

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
  coverage_radius_miles: number | null;
  listing_latitude: number | null;
  listing_longitude: number | null;
  tenant_id: string;
}

type ManufacturerAffiliation = {
  name: string;
  title?: string;
  description?: string;
  logo_url?: string;
};

function parseManufacturerAffiliations(value: unknown): ManufacturerAffiliation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      title: typeof item.title === "string" ? item.title.trim() : "",
      description: typeof item.description === "string" ? item.description.trim() : "",
      logo_url: typeof item.logo_url === "string" ? item.logo_url : "",
    }))
    .filter((item) => item.name || item.title);
}

function parseTradeTypes(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed.map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Existing listings used a comma-separated string before individual services.
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// PUBLIC: GET /api/directory — list all publicly listed businesses
// Optional query params: ?q=search&trade=Gas+Engineer&location=AB10+1AB&radius=20
// ---------------------------------------------------------------------------
router.get("/directory", async (req: Request, res: Response): Promise<void> => {
  const { q, trade, location, radius } = req.query as { q?: string; trade?: string; location?: string; radius?: string };

  let query = supabaseAdmin
    .from("company_settings")
    .select("id, name, trading_name, phone, email, website, address_line1, city, county, postcode, logo_url, listing_slug, public_description, trade_types, service_area, tenant_id, listing_latitude, listing_longitude")
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
      parseTradeTypes(r.trade_types).some((item) => item.toLowerCase().includes(term)) ||
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
      parseTradeTypes(r.trade_types).some((item) => item.toLowerCase().includes(tradeTerm))
    );
  }

  // Location search: geocode the requested location and sort/filter listings by distance.
  let distanceByTenantId: Map<string, number> | null = null;
  if (location && location.trim()) {
    const origin = await geocodeAddress(location.trim()).catch(() => null);
    if (origin) {
      const radiusMiles = radius ? Number(radius) : null;
      distanceByTenantId = new Map();
      const withCoords: ListingRow[] = [];
      for (const r of results) {
        if (r.listing_latitude != null && r.listing_longitude != null) {
          const distance = calculateDistanceMiles(origin, { latitude: r.listing_latitude, longitude: r.listing_longitude });
          if (Number.isFinite(radiusMiles) && radiusMiles! > 0 && distance > radiusMiles!) continue;
          distanceByTenantId.set(r.tenant_id, distance);
          withCoords.push(r);
        }
      }
      results = withCoords.sort((a, b) => (distanceByTenantId!.get(a.tenant_id) ?? Infinity) - (distanceByTenantId!.get(b.tenant_id) ?? Infinity));
    }
  }

  // Aggregate approved ratings for the returned listings.
  const tenantIds = results.map(r => r.tenant_id);
  const ratingByTenantId = new Map<string, { average: number; count: number }>();
  if (tenantIds.length > 0) {
    const { data: reviewRows } = await supabaseAdmin
      .from("directory_reviews")
      .select("tenant_id, rating")
      .in("tenant_id", tenantIds)
      .eq("is_approved", true);
    for (const row of (reviewRows || []) as Array<{ tenant_id: string; rating: number }>) {
      const existing = ratingByTenantId.get(row.tenant_id) || { average: 0, count: 0 };
      existing.average = (existing.average * existing.count + row.rating) / (existing.count + 1);
      existing.count += 1;
      ratingByTenantId.set(row.tenant_id, existing);
    }
  }

  res.set("Cache-Control", "public, max-age=300"); // 5 min public cache
  res.json(results.map(r => ({
    slug: r.listing_slug,
    name: r.trading_name || r.name,
    description: r.public_description,
    trade_types: parseTradeTypes(r.trade_types),
    service_area: r.service_area,
    city: r.city,
    county: r.county,
    postcode: r.postcode,
    phone: r.phone,
    email: r.email,
    website: r.website,
    logo_url: r.logo_url,
    distance_miles: distanceByTenantId?.get(r.tenant_id) != null ? Math.round(distanceByTenantId.get(r.tenant_id)! * 10) / 10 : null,
    rating_average: ratingByTenantId.get(r.tenant_id) ? Math.round(ratingByTenantId.get(r.tenant_id)!.average * 10) / 10 : null,
    rating_count: ratingByTenantId.get(r.tenant_id)?.count ?? 0,
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
    .select("id, name, trading_name, phone, email, website, address_line1, address_line2, city, county, postcode, logo_url, listing_slug, public_description, trade_types, service_area, tenant_id, gas_safe_number, oftec_number, company_number, vat_number, manufacturer_affiliations")
    .eq("listing_slug", slug)
    .eq("is_publicly_listed", true)
    .single();

  if (error || !data) { res.status(404).json({ error: "Business not found" }); return; }

  const r = data as ListingRow & { gas_safe_number?: string; oftec_number?: string; company_number?: string; vat_number?: string; manufacturer_affiliations?: unknown; address_line2?: string };

  const { data: reviewRows } = await supabaseAdmin
    .from("directory_reviews")
    .select("id, reviewer_name, rating, comment, created_at")
    .eq("tenant_id", r.tenant_id)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(50);
  const reviews = (reviewRows || []) as Array<{ id: string; reviewer_name: string; rating: number; comment: string | null; created_at: string }>;
  const ratingAverage = reviews.length > 0 ? reviews.reduce((sum, rv) => sum + rv.rating, 0) / reviews.length : null;

  res.set("Cache-Control", "public, max-age=300");
  res.json({
    slug: r.listing_slug,
    name: r.trading_name || r.name,
    description: r.public_description,
    trade_types: parseTradeTypes(r.trade_types),
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
    company_number: r.company_number || null,
    vat_number: r.vat_number || null,
    manufacturer_affiliations: parseManufacturerAffiliations(r.manufacturer_affiliations),
    rating_average: ratingAverage != null ? Math.round(ratingAverage * 10) / 10 : null,
    rating_count: reviews.length,
    reviews: reviews.map(rv => ({ id: rv.id, reviewer_name: rv.reviewer_name, rating: rv.rating, comment: rv.comment, created_at: rv.created_at })),
  });
});

// ---------------------------------------------------------------------------
// PUBLIC: POST /api/directory/:slug/enquiry — contact a listed business
// ---------------------------------------------------------------------------
router.post("/directory/:slug/enquiry", directoryEnquiryLimiter, async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const { name, email, phone, message, website_url } = req.body as {
    name?: string; email?: string; phone?: string; message?: string; website_url?: string;
  };

  // Honeypot: real visitors never fill this hidden field in.
  if (typeof website_url === "string" && website_url.trim()) { res.status(400).json({ error: "Invalid submission" }); return; }

  if (!name?.trim() || !message?.trim() || (!email?.trim() && !phone?.trim())) {
    res.status(400).json({ error: "Name, message, and an email or phone number are required." });
    return;
  }

  const { data: listing, error: listingErr } = await supabaseAdmin
    .from("company_settings")
    .select("tenant_id")
    .eq("listing_slug", slug)
    .eq("is_publicly_listed", true)
    .maybeSingle();
  if (listingErr || !listing) { res.status(404).json({ error: "Business not found" }); return; }

  const tenantId = (listing as { tenant_id: string }).tenant_id;

  const { data: enquiry, error: insertErr } = await supabaseAdmin
    .from("enquiries")
    .insert({
      tenant_id: tenantId,
      contact_name: name.trim(),
      contact_email: email?.trim() || null,
      contact_phone: phone?.trim() || null,
      source: "website",
      description: `Public directory enquiry\n\n${message.trim()}`,
      status: "new",
      notes: "Submitted via public /find directory listing",
    })
    .select("id")
    .single();

  if (insertErr || !enquiry) { res.status(500).json({ error: insertErr?.message || "Failed to send enquiry" }); return; }

  const enquiryId = (enquiry as { id: string }).id;

  void notifyUsersForEvent({
    tenantId,
    eventType: "customer_communications",
    title: "New Directory Enquiry",
    body: `${name.trim()} contacted you via the public directory.`,
    url: `/enquiries/${enquiryId}`,
    eventKey: `enquiry_created:${enquiryId}`,
    targetRoles: ["admin", "office_staff"],
    data: { enquiryId, source: "directory_listing" },
  }).catch((err) => console.error("[push-events] directory enquiry_created failed:", err));

  if (email?.trim()) {
    try {
      const { companyName, details } = await loadDirectoryEmailCompanyDetails(tenantId);
      await sendEnquiryAcknowledgementEmail(email.trim(), name.trim(), companyName, {
        enquiryId,
        source: "directory_listing",
        description: message.trim(),
      }, details);
    } catch (err) {
      console.error("[directory] Failed to send acknowledgement email:", (err as Error).message);
    }
  }

  res.status(201).json({ success: true });
});

// ---------------------------------------------------------------------------
// PUBLIC: POST /api/directory/:slug/reviews — submit a review (held for moderation)
// ---------------------------------------------------------------------------
router.post("/directory/:slug/reviews", directoryReviewLimiter, async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const { reviewer_name, reviewer_email, rating, comment, website_url } = req.body as {
    reviewer_name?: string; reviewer_email?: string; rating?: number | string; comment?: string; website_url?: string;
  };

  if (typeof website_url === "string" && website_url.trim()) { res.status(400).json({ error: "Invalid submission" }); return; }

  const parsedRating = typeof rating === "string" ? Number(rating) : rating;
  if (!reviewer_name?.trim() || !Number.isFinite(parsedRating) || parsedRating! < 1 || parsedRating! > 5) {
    res.status(400).json({ error: "reviewer_name and a rating between 1 and 5 are required." });
    return;
  }

  const { data: listing, error: listingErr } = await supabaseAdmin
    .from("company_settings")
    .select("tenant_id")
    .eq("listing_slug", slug)
    .eq("is_publicly_listed", true)
    .maybeSingle();
  if (listingErr || !listing) { res.status(404).json({ error: "Business not found" }); return; }

  const { error: insertErr } = await supabaseAdmin.from("directory_reviews").insert({
    tenant_id: (listing as { tenant_id: string }).tenant_id,
    reviewer_name: reviewer_name.trim(),
    reviewer_email: reviewer_email?.trim() || null,
    rating: Math.round(parsedRating!),
    comment: comment?.trim() || null,
    is_approved: false,
  });

  if (insertErr) { res.status(500).json({ error: insertErr.message }); return; }
  res.status(201).json({ success: true, message: "Thanks! Your review will appear once approved." });
});

// ---------------------------------------------------------------------------
// PRIVATE: GET /api/admin/directory-listing — get current tenant's listing settings
// ---------------------------------------------------------------------------
router.get("/admin/directory-listing", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  let q = supabaseAdmin
    .from("company_settings")
    .select("is_publicly_listed, listing_slug, public_description, trade_types, service_area, coverage_radius_miles, manufacturer_affiliations")
    .eq("singleton_id", "default");
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.maybeSingle();

  if (error && /coverage_radius_miles/i.test(error.message || "")) {
    let fallbackQ = supabaseAdmin
      .from("company_settings")
      .select("is_publicly_listed, listing_slug, public_description, trade_types, service_area")
      .eq("singleton_id", "default");
    if (req.tenantId) fallbackQ = fallbackQ.eq("tenant_id", req.tenantId);
    const { data: fallbackData, error: fallbackError } = await fallbackQ.maybeSingle();
    if (fallbackError) { res.status(500).json({ error: fallbackError.message }); return; }
    res.json({
      ...(fallbackData || { is_publicly_listed: false, listing_slug: null, public_description: null, trade_types: null, service_area: null }),
      coverage_radius_miles: null,
      coverage_radius_supported: false,
    });
    return;
  }

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({
    ...(data || { is_publicly_listed: false, listing_slug: null, public_description: null, trade_types: null, service_area: null, coverage_radius_miles: null }),
    coverage_radius_supported: true,
  });
});

// ---------------------------------------------------------------------------
// PRIVATE: PATCH /api/admin/directory-listing — update listing settings
// ---------------------------------------------------------------------------
router.patch("/admin/directory-listing", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { is_publicly_listed, listing_slug, public_description, trade_types, service_area, coverage_radius_miles, manufacturer_affiliations } = req.body as {
    is_publicly_listed?: boolean;
    listing_slug?: string;
    public_description?: string;
    trade_types?: string;
    service_area?: string;
    coverage_radius_miles?: number | string;
    manufacturer_affiliations?: unknown;
  };

  const updates: Record<string, unknown> = {};
  if (is_publicly_listed !== undefined) updates.is_publicly_listed = !!is_publicly_listed;
  if (public_description !== undefined) updates.public_description = public_description.trim() || null;
  if (trade_types !== undefined) updates.trade_types = trade_types.trim() || null;
  if (service_area !== undefined) updates.service_area = service_area.trim() || null;
  if (coverage_radius_miles !== undefined) {
    const parsed = typeof coverage_radius_miles === "string" ? Number(coverage_radius_miles) : coverage_radius_miles;
    updates.coverage_radius_miles = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (manufacturer_affiliations !== undefined) {
    updates.manufacturer_affiliations = parseManufacturerAffiliations(manufacturer_affiliations);
  }

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
  if (error && /coverage_radius_miles/i.test(error.message || "")) {
    res.status(409).json({
      error: "Postcode radius setting is not available yet on this database. Run patch-052-website-coverage.sql to enable it.",
    });
    return;
  }
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);

  // Best-effort: geocode the business postcode so /find can sort by distance.
  // Runs after responding so a slow/failed geocode never blocks saving the listing.
  const row = data as Record<string, unknown>;
  const postcode = String(row.postcode || "").trim();
  if (postcode && req.tenantId) {
    geocodeAddress(postcode, req.tenantId).then((geo) => {
      if (!geo) return;
      supabaseAdmin
        .from("company_settings")
        .update({ listing_latitude: geo.latitude, listing_longitude: geo.longitude })
        .eq("tenant_id", req.tenantId!)
        .eq("singleton_id", "default")
        .then(({ error: geoErr }) => {
          if (geoErr) console.error("[directory] Failed to persist listing coordinates:", geoErr.message);
        });
    }).catch((err) => console.error("[directory] Geocode for listing failed:", (err as Error).message));
  }
});

// ---------------------------------------------------------------------------
// PRIVATE: GET /api/admin/directory-check-slug/:slug — check if a slug is available (excludes own tenant)
// ---------------------------------------------------------------------------
router.get("/admin/directory-check-slug/:slug", requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const normalised = (slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!normalised) { res.json({ available: false }); return; }

  let q = supabaseAdmin
    .from("company_settings")
    .select("tenant_id")
    .eq("listing_slug", normalised);
  if (req.tenantId) q = q.neq("tenant_id", req.tenantId);
  const { data } = await q.maybeSingle();

  res.json({ available: !data, slug: normalised });
});

// ---------------------------------------------------------------------------
// PRIVATE: GET /api/admin/directory-reviews — list this tenant's directory reviews
// ---------------------------------------------------------------------------
router.get("/admin/directory-reviews", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let q = supabaseAdmin
    .from("directory_reviews")
    .select("id, reviewer_name, reviewer_email, rating, comment, is_approved, created_at")
    .order("created_at", { ascending: false });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || []);
});

// ---------------------------------------------------------------------------
// PRIVATE: PATCH /api/admin/directory-reviews/:id — approve or hide a review
// ---------------------------------------------------------------------------
router.patch("/admin/directory-reviews/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { is_approved } = req.body as { is_approved?: boolean };
  if (is_approved === undefined) { res.status(400).json({ error: "is_approved is required" }); return; }

  let q = supabaseAdmin
    .from("directory_reviews")
    .update({ is_approved: !!is_approved })
    .eq("id", req.params.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data, error } = await q.select().maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Review not found" }); return; }
  res.json(data);
});

// ---------------------------------------------------------------------------
// PRIVATE: DELETE /api/admin/directory-reviews/:id — permanently remove a review
// ---------------------------------------------------------------------------
router.delete("/admin/directory-reviews/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let q = supabaseAdmin.from("directory_reviews").delete().eq("id", req.params.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

export default router;
