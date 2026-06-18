/**
 * Website builder API routes — core (website, pages, blocks)
 *
 * GET    /api/website                       — get tenant's website
 * POST   /api/website                       — create website for tenant
 * PATCH  /api/website                       — update website settings
 * POST   /api/website/publish               — publish website
 * GET    /api/website/pages                 — list pages
 * POST   /api/website/pages                 — create page
 * GET    /api/website/pages/:id             — get page with blocks
 * PATCH  /api/website/pages/:id             — update page
 * DELETE /api/website/pages/:id             — delete page
 * POST   /api/website/pages/:id/publish     — publish page
 * GET    /api/website/pages/:id/versions    — version history
 * POST   /api/website/pages/:id/restore/:v  — restore version
 * PUT    /api/website/pages/:id/blocks      — replace all blocks for a page
 * GET    /api/website/templates             — list available templates
 * POST   /api/website/apply-template        — apply a template to a website
 */

import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { addDomainToVercel } from "../lib/vercel";
import {
  requireAuth,
  requireTenant,
  requireRole,
  requirePlanFeature,
  type AuthenticatedRequest,
} from "../middlewares/auth";

const router: IRouter = Router();
const db = supabaseAdmin as any; // new tables not yet in generated types

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWebsiteForTenant(tenantId: string): Promise<Record<string, unknown> | null> {
  const { data } = await db
    .from("websites")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle() as { data: Record<string, unknown> | null };
  return data;
}

/** Convert a company name to a URL-safe slug: "North East Ecoheat Ltd" → "north-east-ecoheat-ltd" */
function toSubdomainSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // strip anything not alphanumeric/space/dash
    .trim()
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .slice(0, 40);                   // max length
}

/**
 * Auto-provision a platform subdomain (e.g. gasboilersuk.tradeworkdesk.co.uk)
 * for a newly created website. Always active — no DNS verification needed.
 */
async function provisionPlatformSubdomain(websiteId: string, tenantId: string, companyName: string): Promise<void> {
  const base = process.env.PLATFORM_SUBDOMAIN_BASE || "tradeworkdesk.co.uk";
  const baseSlug = toSubdomainSlug(companyName) || "site";

  // Find a unique slug (append -2, -3 if already taken)
  let slug = baseSlug;
  for (let counter = 2; counter < 100; counter++) {
    const { data: existing } = await db
      .from("website_domains")
      .select("id")
      .eq("domain", `${slug}.${base}`)
      .maybeSingle() as { data: { id: string } | null };
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
  }

  await db.from("website_domains").insert({
    website_id: websiteId,
    tenant_id: tenantId,
    domain: `${slug}.${base}`,
    is_platform_subdomain: true,
    is_primary: false,
    is_active: true,
    verification_status: "verified",
    ssl_status: "active",
    cf_ownership_verified: false,
    cf_ssl_verified: false,
    activated_at: new Date().toISOString(),
  });

  // Register with Vercel so the renderer serves traffic for this subdomain
  addDomainToVercel(`${slug}.${base}`).catch((e) =>
    console.error(`[vercel] addDomainToVercel(${slug}.${base}) failed:`, e)
  );
}

function requireWebsiteBuilder() {
  return requirePlanFeature("website_builder");
}

// ─── Website (root settings) ──────────────────────────────────────────────────

router.get(
  "/website",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);

    if (!website) {
      res.status(404).json({ error: "No website found. Create one first." });
      return;
    }

    // Include domain info
    const { data: domains } = await db
      .from("website_domains")
      .select("id, domain, verification_status, ssl_status, is_primary, is_active, www_redirect, cf_hostname_id, verification_token")
      .eq("website_id", website.id)
      .order("created_at", { ascending: true }) as { data: Record<string, unknown>[] | null };

    // Provide a preview URL using the renderer base URL (no custom domain required)
    let rendererBase = (process.env.RENDERER_BASE_URL || "").replace(/\/$/, "");
    if (rendererBase && !rendererBase.startsWith("http")) rendererBase = `https://${rendererBase}`;
    const previewSecret = process.env.RENDERER_PREVIEW_SECRET;
    const previewToken = previewSecret
      ? require("crypto").createHmac("sha256", previewSecret).update(website.id).digest("hex")
      : null;
    const previewUrl = rendererBase
      ? `${rendererBase}/preview/${website.id}${previewToken ? `?token=${previewToken}` : ""}`
      : null;

    res.json({ ...website, domains: domains || [], preview_url: previewUrl });
  }
);

router.post(
  "/website",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const existing = await getWebsiteForTenant(req.tenantId!);
    if (existing) {
      res.status(409).json({ error: "Website already exists for this account.", website_id: existing.id });
      return;
    }

    const { template_id, site_name, tagline } = req.body as {
      template_id?: string;
      site_name?: string;
      tagline?: string;
    };

    // Pull company name from company_settings as default site_name
    const { data: cs } = await supabaseAdmin
      .from("company_settings")
      .select("name, trading_name")
      .eq("tenant_id", req.tenantId!)
      .eq("singleton_id", "default")
      .maybeSingle();

    const defaultName = site_name
      || (cs as any)?.trading_name
      || (cs as any)?.name
      || "My Website";

    const { data: website, error } = await db
      .from("websites")
      .insert({
        tenant_id: req.tenantId,
        template_id: template_id || null,
        site_name: defaultName,
        tagline: tagline || null,
        status: "draft",
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !website) {
      console.error("[website] create failed:", error);
      res.status(500).json({ error: "Failed to create website" });
      return;
    }

    // Auto-provision a free platform subdomain (e.g. gasboilersuk.tradeworkdesk.co.uk)
    const companyName = defaultName;
    provisionPlatformSubdomain(String(website.id), req.tenantId!, companyName).catch((e) =>
      console.error("[website] subdomain provision failed:", e)
    );

    // If a template is chosen, seed default pages from it
    if (template_id) {
      const { data: template } = await db
        .from("website_templates")
        .select("default_pages, default_theme")
        .eq("id", template_id)
        .single() as { data: { default_pages: Array<Record<string, unknown>>; default_theme: Record<string, unknown> } | null };

      if (template?.default_pages?.length) {
        const pageInserts = template.default_pages.map((p: Record<string, unknown>, i: number) => ({
          website_id: website.id,
          tenant_id: req.tenantId,
          slug: String(p.slug || ""),
          title: String(p.title || "Page"),
          page_type: String(p.page_type || "custom"),
          status: "draft",
          show_in_nav: Boolean(p.show_in_nav),
          nav_label: p.nav_label ? String(p.nav_label) : null,
          nav_order: typeof p.nav_order === "number" ? p.nav_order : i + 1,
        }));

        await db.from("website_pages").insert(pageInserts);
      }

      // Apply default theme
      if (template?.default_theme) {
        await db
          .from("websites")
          .update({ theme: template.default_theme })
          .eq("id", website.id);
      }
    }

    res.status(201).json(website);
  }
);

// ─── Quick Start — seed a fully populated website from company data ───────────

router.post(
  "/website/quickstart",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const existing = await getWebsiteForTenant(req.tenantId!);
    if (existing) {
      res.status(409).json({ error: "Website already exists for this account.", website_id: existing.id });
      return;
    }

    // Load company settings to personalise the content
    const { data: cs } = await supabaseAdmin
      .from("company_settings")
      .select("name, trading_name, phone, email, address_line1, city, county, postcode, gas_safe_number, oftec_number")
      .eq("tenant_id", req.tenantId!)
      .eq("singleton_id", "default")
      .maybeSingle();

    const tradeName: string = (cs as any)?.trading_name || (cs as any)?.name || "Your Business";
    const city: string = (cs as any)?.city || "your area";
    const county: string = (cs as any)?.county || "";
    const phone: string = (cs as any)?.phone || "";
    const email: string = (cs as any)?.email || "";
    const gasSafeNo: string = (cs as any)?.gas_safe_number || "";
    const oftecNo: string = (cs as any)?.oftec_number || "";
    const hasGasSafe = !!gasSafeNo;
    const hasOftec = !!oftecNo;

    const addressParts: string[] = [
      (cs as any)?.address_line1,
      (cs as any)?.city,
      (cs as any)?.postcode,
    ].filter(Boolean) as string[];
    const address = addressParts.join(", ");

    const tradeLabel = hasGasSafe
      ? "Gas & Heating Engineer"
      : hasOftec
      ? "Oil Heating Engineer"
      : "Plumber";

    const locationText = county ? `${city}, ${county}` : city;

    // Build service list based on accreditations
    type Service = { title: string; description: string; icon: string };
    const services: Service[] = [
      { title: "Emergency Call-Outs", description: "Available 24/7 for burst pipes, leaks, and urgent plumbing emergencies.", icon: "🚨" },
      { title: "Bathroom Installations", description: "Full bathroom suite supply and fit, wet rooms, showers, and tiling.", icon: "🛁" },
      { title: "Leak Detection & Repair", description: "Expert leak tracing and repair to prevent damage and reduce water bills.", icon: "💧" },
      { title: "Central Heating", description: "Radiator installations, TRV upgrades, power flushing, and full system maintenance.", icon: "🏠" },
    ];

    if (hasGasSafe) {
      services.push(
        { title: "Boiler Repair & Servicing", description: "Fast fault diagnosis, annual servicing, and full boiler replacements by a Gas Safe registered engineer.", icon: "🔧" },
        { title: "Gas Safety Certificates", description: "Landlord gas safety inspections (CP12) and homeowner checks. Certificate issued same day.", icon: "✅" },
      );
    } else if (hasOftec) {
      services.push(
        { title: "Oil Boiler Servicing", description: "Annual service and repair for all makes of oil boiler by an OFTEC registered engineer.", icon: "🔧" },
        { title: "Oil Tank Installation", description: "New oil tank supply and fit, including line runs, filters, and safety valves.", icon: "⛽" },
      );
    } else {
      services.push(
        { title: "Boiler Repairs", description: "Keep your heating running with our boiler repair and maintenance service.", icon: "🔧" },
        { title: "Pipe & Drain Work", description: "Blocked drains, pipe repairs, and full repiping services.", icon: "🔩" },
      );
    }

    const phoneUrl = phone ? `tel:${phone.replace(/\s+/g, "")}` : "/contact";

    // Build about HTML
    const accredLine = hasGasSafe
      ? `<p>We are <strong>Gas Safe registered</strong>${gasSafeNo ? ` (no. ${gasSafeNo})` : ""}. You can verify our registration at <a href="https://www.gassaferegister.co.uk" target="_blank" rel="noopener noreferrer">GasSafeRegister.co.uk</a>.</p>`
      : hasOftec
      ? `<p>We are <strong>OFTEC registered</strong>${oftecNo ? ` (no. ${oftecNo})` : ""} for all oil heating work.</p>`
      : "";

    const aboutHtml = `<h2>About ${tradeName}</h2>
<p>Based in ${locationText}, ${tradeName} provides reliable, professional ${tradeLabel.toLowerCase()} services to homeowners and businesses across the area. Whether you need an emergency callout or a planned installation, our experienced team is ready to help.</p>
<p>We pride ourselves on honest pricing, quality workmanship, and getting the job done right first time. All work is fully guaranteed.</p>
${accredLine}
<p>Contact us today for a free, no-obligation quote.</p>`;

    const contactDetails: string[] = [];
    if (phone) contactDetails.push(`<li>📞 <a href="${phoneUrl}">${phone}</a></li>`);
    if (email) contactDetails.push(`<li>✉️ <a href="mailto:${email}">${email}</a></li>`);
    if (address) contactDetails.push(`<li>📍 ${address}</li>`);

    const contactHtml = `<h2>Contact ${tradeName}</h2>
<p>Get in touch with us today — we'd love to hear from you.</p>
${contactDetails.length ? `<ul style="list-style:none;padding:0;line-height:2">${contactDetails.join("\n")}</ul>` : ""}
<p>We aim to respond to all enquiries within one business day.</p>`;

    // ── 1. Create website ────────────────────────────────────────────────────
    const { data: website, error: wsError } = await db
      .from("websites")
      .insert({
        tenant_id: req.tenantId,
        site_name: tradeName,
        tagline: `Professional ${tradeLabel} Services in ${city}`,
        status: "draft",
        default_meta_title: `${tradeName} — ${tradeLabel} in ${city}`,
        default_meta_description: `${tradeName} offers professional ${tradeLabel.toLowerCase()} services in ${locationText}. Call us today for a free quote.`,
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (wsError || !website) {
      console.error("[website/quickstart] create website failed:", wsError);
      res.status(500).json({ error: "Failed to create website" });
      return;
    }

    // Auto-provision a free platform subdomain
    provisionPlatformSubdomain(String(website.id), req.tenantId!, tradeName).catch((e) =>
      console.error("[website/quickstart] subdomain provision failed:", e)
    );

    // ── 2. Create pages ──────────────────────────────────────────────────────
    const pageRows = [
      { website_id: website.id, tenant_id: req.tenantId, slug: "home", title: "Home",     page_type: "home",   status: "draft", show_in_nav: true,  nav_label: "Home",     nav_order: 1 },
      { website_id: website.id, tenant_id: req.tenantId, slug: "services", title: "Services", page_type: "custom", status: "draft", show_in_nav: true,  nav_label: "Services", nav_order: 2 },
      { website_id: website.id, tenant_id: req.tenantId, slug: "about",    title: "About Us",  page_type: "custom", status: "draft", show_in_nav: true,  nav_label: "About",    nav_order: 3 },
      { website_id: website.id, tenant_id: req.tenantId, slug: "contact",  title: "Contact",   page_type: "custom", status: "draft", show_in_nav: true,  nav_label: "Contact",  nav_order: 4 },
    ];

    const { data: pages, error: pagesError } = await db
      .from("website_pages")
      .insert(pageRows)
      .select("id, slug, page_type") as { data: Array<{ id: string; slug: string; page_type: string }> | null; error: unknown };

    if (pagesError || !pages) {
      console.error("[website/quickstart] create pages failed:", pagesError);
      res.status(500).json({ error: "Failed to create pages" });
      return;
    }

    const homeId     = pages.find(p => p.page_type === "home")?.id;
    const servicesId = pages.find(p => p.slug === "services")?.id;
    const aboutId    = pages.find(p => p.slug === "about")?.id;
    const contactId  = pages.find(p => p.slug === "contact")?.id;

    // ── 3. Build block rows ──────────────────────────────────────────────────
    type BlockRow = { page_id: string; tenant_id: string; block_type: string; content: Record<string, unknown>; sort_order: number; is_visible: boolean };

    const blockRows: BlockRow[] = [];

    function addBlocks(pageId: string | undefined, blocks: Array<{ block_type: string; content: Record<string, unknown> }>) {
      if (!pageId) return;
      blocks.forEach((b, i) => {
        blockRows.push({ page_id: pageId, tenant_id: req.tenantId!, block_type: b.block_type, content: b.content, sort_order: i, is_visible: true });
      });
    }

    // Home page
    addBlocks(homeId, [
      {
        block_type: "hero",
        content: {
          heading: `Your Local ${tradeLabel} in ${city}`,
          subheading: `Fast, reliable, and fully insured. ${tradeName} covers ${locationText} and surrounding areas. Call us today for a free quote.`,
          cta_text: phone ? `Call ${phone}` : "Get a Free Quote",
          cta_url: phoneUrl,
          align: "center",
        },
      },
      {
        block_type: "services",
        content: {
          heading: "What We Do",
          services,
          columns: 3,
        },
      },
      {
        block_type: "cta",
        content: {
          heading: "Need a Plumber Fast?",
          subheading: `${tradeName} is available for emergency call-outs and scheduled work across ${locationText}.`,
          cta_text: phone ? `Call ${phone}` : "Get in Touch",
          cta_url: phoneUrl,
        },
      },
    ]);

    // Services page
    addBlocks(servicesId, [
      {
        block_type: "hero",
        content: {
          heading: "Our Services",
          subheading: `${tradeName} offers a full range of ${tradeLabel.toLowerCase()} services for residential and commercial customers in ${locationText}.`,
          align: "center",
        },
      },
      {
        block_type: "services",
        content: {
          heading: "Services We Offer",
          services,
          columns: 3,
        },
      },
      {
        block_type: "cta",
        content: {
          heading: "Ready to Book?",
          subheading: "Get in touch for a fast, friendly quote with no obligation.",
          cta_text: phone ? `Call ${phone}` : "Contact Us",
          cta_url: phoneUrl,
        },
      },
    ]);

    // About page
    addBlocks(aboutId, [
      {
        block_type: "hero",
        content: {
          heading: `About ${tradeName}`,
          subheading: `Your trusted local ${tradeLabel.toLowerCase()} in ${city}.`,
          align: "center",
        },
      },
      {
        block_type: "text",
        content: { html: aboutHtml },
      },
    ]);

    // Contact page
    addBlocks(contactId, [
      {
        block_type: "hero",
        content: {
          heading: "Get In Touch",
          subheading: `We'd love to hear from you. Reach ${tradeName} using the details below.`,
          align: "center",
        },
      },
      {
        block_type: "text",
        content: { html: contactHtml },
      },
    ]);

    if (blockRows.length > 0) {
      await db.from("website_blocks").insert(blockRows);
    }

    res.status(201).json(website);
  }
);

router.patch(
  "/website",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const allowed = [
      "site_name", "tagline", "logo_url", "favicon_url", "theme",
      "default_meta_title", "default_meta_description",
      "google_analytics_id", "google_search_console_verification",
      "social_links",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const { data, error } = await db
      .from("websites")
      .update(updates)
      .eq("id", website.id)
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to update website" }); return; }

    res.json(data);
  }
);

router.delete(
  "/website",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    // Delete in dependency order: blocks → page versions → pages → domains → website
    await db.from("website_blocks").delete().eq("tenant_id", req.tenantId);
    await db.from("website_page_versions").delete().eq("tenant_id", req.tenantId);
    await db.from("website_pages").delete().eq("website_id", website.id);
    await db.from("website_domains").delete().eq("website_id", website.id);
    await db.from("websites").delete().eq("id", website.id);

    res.sendStatus(204);
  }
);

router.post(
  "/website/publish",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data, error } = await db
      .from("websites")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", website.id)
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to publish website" }); return; }

    res.json(data);
  }
);

// ─── Templates ────────────────────────────────────────────────────────────────

router.get(
  "/website/templates",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (_req: AuthenticatedRequest, res): Promise<void> => {
    const KNOWN_SLUGS = ["classic", "modern", "bold", "professional", "minimal"];

    const { data, error } = await db
      .from("website_templates")
      .select("id, name, slug, description, thumbnail_url, preview_url, category, sort_order, default_theme")
      .eq("is_active", true)
      .in("slug", KNOWN_SLUGS)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to load templates" }); return; }
    res.json(data || []);
  }
);

// ─── Template block seeder ────────────────────────────────────────────────────
// Builds the block content for the home page of each template, personalised
// from company settings.  Every field here corresponds 1-to-1 with the
// published design reference for that template.

interface CompanyData {
  tradeName: string;
  city: string;
  county: string;
  phone: string;
  email: string;
  gasSafeNo: string;
  oftecNo: string;
  locationText: string;
  phoneUrl: string;
}

function buildModernHomeBlocks(cs: CompanyData, formId: string): Array<{ block_type: string; content: Record<string, unknown> }> {
  const { tradeName, city, county, phone, email, gasSafeNo, oftecNo, locationText, phoneUrl } = cs;

  const accredBadges = [
    ...(gasSafeNo ? [{ name: "Gas Safe Registered", number: gasSafeNo }] : []),
    ...(oftecNo ? [{ name: "OFTEC Registered", number: oftecNo }] : []),
    { name: "MCS Certified" },
    { name: "Which? Trusted Trader" },
    { name: "TrustMark" },
  ];

  return [
    // 1. Hero — split layout
    {
      block_type: "hero",
      content: {
        layout: "split",
        heading: "Modern Heating Solutions for Efficient Homes",
        heading_accent: "Solutions",
        subheading: `Heat pumps, underfloor heating, and boiler upgrades designed around your property. Free surveys, transparent pricing, and full MCS certification.`,
        cta_text: "Book a Survey",
        cta_url: "#contact",
        secondary_cta_text: "View Services",
        secondary_cta_url: "#services",
        badges: [{ label: "MCS Certified Installers" }],
        stats: [
          { value: "500+", label: "Installations completed" },
          { value: "£7,500", label: "BUS grant available" },
          { value: "10yr", label: "Warranty on select systems" },
        ],
        hero_image_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=700&fit=crop&auto=format",
        accent_color: "#0d9488",
      },
    },

    // 2. Features bar — teal background
    {
      block_type: "features_bar",
      content: {
        background_color: "#0d9488",
        text_color: "#ffffff",
        items: [
          { icon: "⚡", title: "High Efficiency", description: "Modern heat pump technology delivers 3–4 units of heat per unit of electricity used." },
          { icon: "🏠", title: "Year-Round Comfort", description: "Consistent warmth with even heat distribution and optional summer cooling." },
          { icon: "🌿", title: "Lower Carbon", description: "Reduce your home's carbon footprint by up to 70% compared to a gas boiler." },
          { icon: "👍", title: "Expert Design", description: "Every system is MCS-compliant and sized correctly for your specific property." },
        ],
      },
    },

    // 3. Services — 6 cards, 3 columns
    {
      block_type: "services",
      content: {
        label: "What We Do",
        heading: "Heating Solutions for Every Home",
        subheading: `From future-proof heat pumps to reliable boiler replacements, ${tradeName} designs and installs the right system for your property and budget.`,
        columns: 3,
        accent_color: "#0d9488",
        services: [
          { icon: "💧", title: "Heat Pumps", description: "Air source and ground source heat pumps designed to replace your boiler and cut running costs by up to 60%. We handle the full project from survey to MCS certification.", badge: "Most Popular", cta_text: "Get a quote", cta_url: "#contact" },
          { icon: "🔥", title: "Underfloor Heating", description: "Wet and electric underfloor heating systems for new builds and retrofits. Pairs perfectly with heat pumps for maximum efficiency and whole-home comfort.", cta_text: "Get a quote", cta_url: "#contact" },
          { icon: "☀️", title: "Solar Thermal", description: "Solar hot water systems that use free energy from the sun to heat your water, reducing your hot water bills by up to 70% throughout the year.", cta_text: "Get a quote", cta_url: "#contact" },
          { icon: "🔧", title: "Gas Boiler Upgrades", description: "High-efficiency condensing gas boiler installations and replacements. Same-day or next-day fitting available with a full 10-year parts and labour guarantee.", cta_text: "Get a quote", cta_url: "#contact" },
          { icon: "⛽", title: "Oil Boiler Upgrades", description: "OFTEC-registered oil boiler replacements and full system upgrades. We also advise on transitioning from oil to low-carbon alternatives.", cta_text: "Get a quote", cta_url: "#contact" },
          { icon: "🌱", title: "Low-Carbon Systems", description: "Hybrid heating systems, heat pump-ready radiators, and whole-home energy assessments to future-proof your property and reduce your carbon footprint.", badge: "New", cta_text: "Get a quote", cta_url: "#contact" },
        ],
      },
    },

    // 4. Process — 4 steps
    {
      block_type: "process",
      content: {
        label: "The Process",
        heading: "Simple from Start to Finish",
        subheading: "We handle everything so you don't have to — from your first survey through to commissioning and aftercare.",
        background_color: "#ffffff",
        accent_color: "#0d9488",
        cta_text: "Book Your Free Survey",
        cta_url: "#contact",
        steps: [
          { icon: "🔍", title: "Free Survey", description: "We visit your property and assess the best system for your home, insulation levels, and budget. No obligation, no hard sell." },
          { icon: "📋", title: "Bespoke Design", description: "Our engineers design a system sized correctly for your home with a detailed, transparent quotation and expected running costs." },
          { icon: "📅", title: "Professional Install", description: "Fully qualified, MCS-certified engineers carry out the installation with minimal disruption to your home." },
          { icon: "✅", title: "Aftercare & Warranty", description: "We commission your system, handle all registrations, and provide ongoing support with a comprehensive parts and labour warranty." },
        ],
      },
    },

    // 5. Project showcase — case study
    {
      block_type: "project_showcase",
      content: {
        label: "Project Highlight",
        heading: "Real Homes, Real Results",
        background_color: "#f9fafb",
        accent_color: "#0d9488",
        projects: [
          {
            title: "Victorian Semi — Oil to Heat Pump Conversion",
            location: locationText,
            image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format",
            description: `A period property in ${locationText} was converted from an ageing oil system to a Mitsubishi Ecodan heat pump with a new cylinder and upgraded radiators. The project qualified for the full BUS grant and was completed in three days.`,
            stats: [
              { value: "8kW Air Source HP", label: "System Installed" },
              { value: "£820/yr", label: "Running Cost Saving" },
              { value: "3.2 tonnes CO₂/yr", label: "Carbon Reduction" },
              { value: "£7,500", label: "BUS Grant Secured" },
            ],
            cta_text: "Start your project",
            cta_url: "#contact",
          },
        ],
      },
    },

    // 6. Accreditations — dark strip
    {
      block_type: "accreditations",
      content: {
        heading: "Our Accreditations & Memberships",
        background_color: "#1f2937",
        text_color: "#9ca3af",
        show_heading: true,
        badges: accredBadges,
      },
    },

    // 7. Testimonials
    {
      block_type: "testimonials",
      content: {
        label: "Customer Reviews",
        heading: "Trusted by Homeowners Across the Region",
        accent_color: "#0d9488",
        testimonials: [
          { author: "Sarah M.", location: city, rating: 5, text: `${tradeName} installed a 10kW air source heat pump. The process was seamless from survey to commissioning. Our heating bills have dropped by nearly half.` },
          { author: "James & Claire T.", location: county || city, rating: 5, text: "We had underfloor heating installed throughout our ground floor alongside a new heat pump. The team were tidy, professional and explained everything clearly. Couldn't recommend them more highly." },
          { author: "David R.", location: city, rating: 5, text: "Switched from an ageing oil boiler to a ground source heat pump. The whole project was managed brilliantly. Our grant application was handled for us too." },
        ],
      },
    },

    // 8. Areas — teal card
    {
      block_type: "areas",
      content: {
        label: "Coverage",
        heading: "Areas We Cover",
        subheading: `We serve homeowners across ${locationText} and the surrounding area. Contact us to check availability in your postcode.`,
        background_color: "#0d9488",
        outer_background: "#f0fdfb",
        accent_color: "#0d9488",
        areas: [city, ...(county && county !== city ? [county] : [])],
        cta_text: "Check Your Postcode",
        cta_url: "#contact",
      },
    },

    // 9. FAQ
    {
      block_type: "faq",
      content: {
        label: "FAQs",
        heading: "Common Questions",
        accent_color: "#0d9488",
        background_color: "#ffffff",
        items: [
          { question: "Is my home suitable for a heat pump?", answer: "Most homes can benefit from a heat pump, though modern insulation helps maximise efficiency. We carry out a full MCS-compliant heat loss survey to assess your property and recommend the right system size before any commitment." },
          { question: "Can I get a government grant towards a heat pump?", answer: "Yes — the Boiler Upgrade Scheme (BUS) currently offers £7,500 towards an air source heat pump or ground source heat pump. We handle your application from start to finish as part of your installation." },
          { question: "How long does a heat pump installation take?", answer: "Most air source heat pump installations take two to three days. Ground source systems typically take three to five days. We minimise disruption throughout." },
          { question: "What warranty do you offer?", answer: "We provide a minimum five-year parts and labour warranty on all heat pump installations, and up to ten years on selected manufacturers. Boiler installations include a manufacturer warranty of up to ten years." },
          { question: "Do you service and maintain heat pumps after installation?", answer: "Yes. We offer annual service plans that keep your system running at peak efficiency and protect your warranty." },
          { question: "What areas do you cover?", answer: `We serve homeowners across ${locationText} and the surrounding area. Contact us to confirm coverage in your postcode.` },
        ],
      },
    },

    // 10. Contact form
    {
      block_type: "contact_form",
      content: {
        label: "Contact",
        heading: "Get in Touch",
        subheading: "Book Your Free Home Survey",
        body: "Tell us about your property and we'll arrange a free, no-obligation survey at a time that suits you. Our engineers will assess your home and provide a detailed, transparent quote.",
        submit_label: "Request Free Survey",
        accent_color: "#0d9488",
        form_id: formId,
        contact_info: {
          phone: phone || undefined,
          email: email || undefined,
          service_area: locationText ? `Serving ${locationText}` : undefined,
        },
        fields: [
          { name: "name", label: "Full Name", type: "text", required: true },
          { name: "phone", label: "Phone Number", type: "tel", required: true },
          { name: "email", label: "Email Address", type: "email", required: true },
          { name: "postcode", label: "Property Postcode", type: "text", required: true },
          { name: "service", label: "Service Required", type: "select", options: ["Heat Pumps", "Underfloor Heating", "Solar Thermal", "Gas Boilers", "Oil Boilers", "Low-Carbon Systems"] },
          { name: "message", label: "Additional Information", type: "textarea" },
        ],
      },
    },
  ];
}

router.post(
  "/website/apply-template",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { template_id } = req.body as { template_id?: string };
    if (!template_id) { res.status(400).json({ error: "template_id is required" }); return; }

    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data: template } = await db
      .from("website_templates")
      .select("*")
      .eq("id", template_id)
      .single() as { data: Record<string, unknown> | null };

    if (!template) { res.status(404).json({ error: "Template not found" }); return; }

    // Load company settings to personalise content
    const { data: rawCs } = await supabaseAdmin
      .from("company_settings")
      .select("name, trading_name, phone, email, city, county, gas_safe_number, oftec_number")
      .eq("tenant_id", req.tenantId!)
      .eq("singleton_id", "default")
      .maybeSingle() as { data: Record<string, string | null> | null };

    const tradeName = rawCs?.trading_name || rawCs?.name || website.site_name as string || "Your Business";
    const city = rawCs?.city || "";
    const county = rawCs?.county || "";
    const phone = rawCs?.phone || "";
    const email = rawCs?.email || "";
    const gasSafeNo = rawCs?.gas_safe_number || "";
    const oftecNo = rawCs?.oftec_number || "";
    const locationText = county && county !== city ? `${city}, ${county}` : city;
    const phoneUrl = phone ? `tel:${phone.replace(/\s+/g, "")}` : "#contact";

    const cs: CompanyData = { tradeName, city, county, phone, email, gasSafeNo, oftecNo, locationText, phoneUrl };

    // ── 1. Apply theme and template id ──────────────────────────────────────
    await db
      .from("websites")
      .update({
        template_id,
        theme: template.default_theme,
        default_meta_title: `${tradeName} — MCS Certified Heating Engineers`,
        default_meta_description: `${tradeName} offers heat pumps, underfloor heating, and boiler upgrades in ${locationText}. Free surveys and full MCS certification.`,
      })
      .eq("id", website.id);

    // ── 2. Wipe existing pages and blocks ───────────────────────────────────
    await db.from("website_blocks").delete().eq("tenant_id", req.tenantId);
    await db.from("website_pages").delete().eq("website_id", website.id);

    // ── 3. Create pages from template default_pages ─────────────────────────
    const defaultPages = (template.default_pages as Array<Record<string, unknown>>) || [];
    type PageRow = { website_id: string; tenant_id: string; slug: string; title: string; page_type: string; status: string; show_in_nav: boolean; nav_label: string | null; nav_order: number; published_at: string | null };
    const pageRows: PageRow[] = defaultPages.map((p, i) => ({
      website_id: String(website.id),
      tenant_id: req.tenantId!,
      slug: String(p.slug || ""),
      title: String(p.title || "Page"),
      page_type: String(p.page_type || "custom"),
      status: "published",
      show_in_nav: Boolean(p.show_in_nav),
      nav_label: p.nav_label ? String(p.nav_label) : null,
      nav_order: typeof p.nav_order === "number" ? p.nav_order : i + 1,
      published_at: new Date().toISOString(),
    }));

    const { data: pages } = await db
      .from("website_pages")
      .insert(pageRows)
      .select("id, slug, page_type") as { data: Array<{ id: string; slug: string; page_type: string }> | null };

    // ── 4. Ensure a contact form exists ─────────────────────────────────────
    const { data: existingForm } = await db
      .from("website_forms")
      .select("id")
      .eq("website_id", website.id)
      .eq("form_type", "contact")
      .maybeSingle() as { data: { id: string } | null };

    let formId: string;
    if (existingForm) {
      formId = existingForm.id;
    } else {
      const { data: newForm } = await db
        .from("website_forms")
        .insert({
          website_id: website.id,
          tenant_id: req.tenantId,
          name: "Contact Form",
          form_type: "contact",
          notify_email: email || null,
          auto_create_enquiry: true,
          is_active: true,
          fields: [],
        })
        .select("id")
        .single() as { data: { id: string } | null };
      formId = newForm?.id || "";
    }

    // ── 5. Seed blocks for home page based on template slug ─────────────────
    const homePageId = pages?.find((p) => p.page_type === "home" || p.slug === "" || p.slug === "/")?.id;

    if (homePageId) {
      const templateSlug = String(template.slug || "");
      let homeBlocks: Array<{ block_type: string; content: Record<string, unknown> }> = [];

      if (templateSlug === "modern") {
        homeBlocks = buildModernHomeBlocks(cs, formId);
      }
      // Other template slugs can be added here in future

      if (homeBlocks.length > 0) {
        await db.from("website_blocks").insert(
          homeBlocks.map((b, i) => ({
            page_id: homePageId,
            tenant_id: req.tenantId,
            block_type: b.block_type,
            content: b.content,
            sort_order: i,
            is_visible: true,
          }))
        );
      }
    }

    // ── 6. Publish the website ───────────────────────────────────────────────
    await db
      .from("websites")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", website.id);

    res.json({ ok: true, pages_created: pages?.length ?? 0 });
  }
);

// ─── Pages ────────────────────────────────────────────────────────────────────

router.get(
  "/website/pages",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data, error } = await db
      .from("website_pages")
      .select("id, slug, page_type, title, status, meta_title, meta_description, show_in_nav, nav_label, nav_order, published_at, created_at, updated_at")
      .eq("website_id", website.id)
      .order("nav_order", { ascending: true }) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to load pages" }); return; }
    res.json(data || []);
  }
);

router.post(
  "/website/pages",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { slug, title, page_type = "custom", meta_title, meta_description, show_in_nav = false, nav_label, nav_order } = req.body as Record<string, unknown>;

    if (!slug || !title) { res.status(400).json({ error: "slug and title are required" }); return; }

    const { data, error } = await db
      .from("website_pages")
      .insert({
        website_id: website.id,
        tenant_id: req.tenantId,
        slug: String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title,
        page_type,
        status: "draft",
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        show_in_nav: Boolean(show_in_nav),
        nav_label: nav_label || null,
        nav_order: typeof nav_order === "number" ? nav_order : 99,
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: Record<string, unknown> };

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: `A page with slug '${slug}' already exists` });
      } else {
        res.status(500).json({ error: "Failed to create page" });
      }
      return;
    }

    res.status(201).json(data);
  }
);

router.get(
  "/website/pages/:id",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const { data: page, error } = await db
      .from("website_pages")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !page) { res.status(404).json({ error: "Page not found" }); return; }

    const { data: blocks } = await db
      .from("website_blocks")
      .select("id, block_type, content, sort_order, is_visible")
      .eq("page_id", id)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null };

    res.json({ ...page, blocks: blocks || [] });
  }
);

router.patch(
  "/website/pages/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const allowed = ["title", "meta_title", "meta_description", "og_image_url", "canonical_url", "no_index", "schema_markup", "show_in_nav", "nav_label", "nav_order", "slug"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const { data, error } = await db
      .from("website_pages")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !data) { res.status(404).json({ error: "Page not found" }); return; }
    res.json(data);
  }
);

router.delete(
  "/website/pages/:id",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    // Prevent deleting home page
    const { data: page } = await db
      .from("website_pages")
      .select("page_type")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { page_type: string } | null };

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    if (page.page_type === "home") { res.status(400).json({ error: "Cannot delete the home page" }); return; }

    await db.from("website_pages").delete().eq("id", id).eq("tenant_id", req.tenantId);
    res.sendStatus(204);
  }
);

router.post(
  "/website/pages/:id/publish",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    // Snapshot current blocks as a version before publishing
    const { data: page } = await db
      .from("website_pages")
      .select("id, title, meta_title, meta_description")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: Record<string, unknown> | null };

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }

    const { data: blocks } = await db
      .from("website_blocks")
      .select("block_type, content, sort_order, is_visible")
      .eq("page_id", id)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null };

    // Get next version number
    const { data: lastVersion } = await db
      .from("website_page_versions")
      .select("version")
      .eq("page_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { version: number } | null };

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    await db.from("website_page_versions").insert({
      page_id: id,
      tenant_id: req.tenantId,
      version: nextVersion,
      title: page.title,
      blocks: blocks || [],
      meta_title: page.meta_title || null,
      meta_description: page.meta_description || null,
      created_by: req.userId,
    });

    const { data, error } = await db
      .from("website_pages")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to publish page" }); return; }

    res.json({ ...data, version: nextVersion });
  }
);

// ─── Version history ──────────────────────────────────────────────────────────

router.get(
  "/website/pages/:id/versions",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const { data, error } = await db
      .from("website_page_versions")
      .select("id, version, title, meta_title, created_by, created_at")
      .eq("page_id", id)
      .eq("tenant_id", req.tenantId)
      .order("version", { ascending: false }) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to load versions" }); return; }
    res.json(data || []);
  }
);

router.post(
  "/website/pages/:id/restore/:version",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id, version } = req.params;

    const { data: snapshot } = await db
      .from("website_page_versions")
      .select("blocks, title, meta_title, meta_description")
      .eq("page_id", id)
      .eq("tenant_id", req.tenantId)
      .eq("version", Number(version))
      .single() as { data: { blocks: Record<string, unknown>[]; title: string; meta_title: string | null; meta_description: string | null } | null };

    if (!snapshot) { res.status(404).json({ error: "Version not found" }); return; }

    // Replace current blocks
    await db.from("website_blocks").delete().eq("page_id", id).eq("tenant_id", req.tenantId);

    if (snapshot.blocks?.length) {
      const inserts = snapshot.blocks.map((b: Record<string, unknown>, i: number) => ({
        page_id: id,
        tenant_id: req.tenantId,
        block_type: b.block_type,
        content: b.content,
        sort_order: typeof b.sort_order === "number" ? b.sort_order : i,
        is_visible: b.is_visible !== false,
      }));
      await db.from("website_blocks").insert(inserts);
    }

    // Update page title/meta
    await db
      .from("website_pages")
      .update({ title: snapshot.title, meta_title: snapshot.meta_title, meta_description: snapshot.meta_description, status: "draft" })
      .eq("id", id)
      .eq("tenant_id", req.tenantId);

    res.json({ ok: true, restored_version: Number(version) });
  }
);

// ─── Blocks ───────────────────────────────────────────────────────────────────

// Replace all blocks for a page in one atomic operation (used by the editor on save)
router.put(
  "/website/pages/:id/blocks",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;
    const { blocks } = req.body as { blocks?: Array<Record<string, unknown>> };

    if (!Array.isArray(blocks)) { res.status(400).json({ error: "blocks must be an array" }); return; }

    // Verify page belongs to tenant
    const { data: page } = await db
      .from("website_pages")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string } | null };

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }

    // Delete existing blocks
    await db.from("website_blocks").delete().eq("page_id", id);

    // Insert new blocks
    if (blocks.length > 0) {
      const inserts = blocks.map((b, i) => ({
        page_id: id,
        tenant_id: req.tenantId,
        block_type: String(b.block_type || "text"),
        content: b.content || {},
        sort_order: i,
        is_visible: b.is_visible !== false,
      }));

      const { error } = await db.from("website_blocks").insert(inserts) as { error: unknown };
      if (error) { res.status(500).json({ error: "Failed to save blocks" }); return; }
    }

    // Return updated blocks
    const { data } = await db
      .from("website_blocks")
      .select("id, block_type, content, sort_order, is_visible")
      .eq("page_id", id)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null };

    res.json(data || []);
  }
);

export default router;
