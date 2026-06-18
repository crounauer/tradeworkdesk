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
import multer from "multer";
import sharp from "sharp";
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
          { author_name: "Sarah M.", location: city, rating: 5, body: `${tradeName} installed a 10kW air source heat pump. The process was seamless from survey to commissioning. Our heating bills have dropped by nearly half.` },
          { author_name: "James & Claire T.", location: county || city, rating: 5, body: "We had underfloor heating installed throughout our ground floor alongside a new heat pump. The team were tidy, professional and explained everything clearly. Couldn't recommend them more highly." },
          { author_name: "David R.", location: city, rating: 5, body: "Switched from an ageing oil boiler to a ground source heat pump. The whole project was managed brilliantly. Our grant application was handled for us too." },
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

function buildModernServicesBlocks(cs: CompanyData, formId: string): Array<{ block_type: string; content: Record<string, unknown> }> {
  const { tradeName, city, phone, locationText, phoneUrl } = cs;
  return [
    {
      block_type: "hero",
      content: {
        layout: "centered",
        heading: "Our Heating Services",
        heading_accent: "Services",
        subheading: `From air source heat pumps to boiler upgrades, ${tradeName} provides the full range of low-carbon and conventional heating solutions for homes across ${locationText}.`,
        cta_text: "Get a Free Quote",
        cta_url: "#contact",
        badges: [{ label: "MCS Certified" }, { label: "Free Surveys" }],
        accent_color: "#0d9488",
      },
    },
    {
      block_type: "services",
      content: {
        label: "What We Do",
        heading: "Heating Solutions for Every Home",
        subheading: `Whatever your heating needs, ${tradeName} has the expertise and accreditations to deliver.`,
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
    {
      block_type: "features_bar",
      content: {
        background_color: "#0d9488",
        text_color: "#ffffff",
        items: [
          { icon: "✅", title: "MCS Certified", description: "All our heat pump and solar installations are MCS certified, qualifying you for government grants." },
          { icon: "🏅", title: "Fully Accredited", description: "Gas Safe registered and OFTEC certified engineers for all conventional heating work." },
          { icon: "🛡️", title: "10-Year Warranty", description: "Comprehensive parts and labour warranty on selected systems for complete peace of mind." },
          { icon: "📞", title: "Free Surveys", description: "No-obligation home surveys to assess the best system for your property and budget." },
        ],
      },
    },
    {
      block_type: "faq",
      content: {
        label: "Service FAQs",
        heading: "Questions About Our Services",
        accent_color: "#0d9488",
        background_color: "#f9fafb",
        items: [
          { question: "What's the difference between air source and ground source heat pumps?", answer: "Air source heat pumps extract heat from outdoor air and are easier and cheaper to install. Ground source heat pumps use pipes buried in the ground and are typically more efficient, but require more space and installation work. We survey your property and recommend the best option." },
          { question: "Can I keep my existing radiators with a heat pump?", answer: "In many cases, yes — especially if your radiators are oversized. Our heat loss assessment will identify any radiators that need upgrading. We often recommend low-temperature radiators for optimal efficiency." },
          { question: "How much does heat pump installation cost?", answer: "Costs vary depending on the system size and property type, but typically range from £10,000–£20,000 before grant funding. The £7,500 Boiler Upgrade Scheme grant significantly reduces this cost. We provide a detailed, fixed-price quote after your free survey." },
          { question: "Do you offer a warranty on boiler installations?", answer: "Yes — we provide up to 10 years manufacturer warranty on selected boiler brands, plus our own labour warranty. Full details are provided before any work begins." },
        ],
      },
    },
    {
      block_type: "contact_form",
      content: {
        label: "Get a Quote",
        heading: "Request a Free Survey",
        subheading: "Tell Us About Your Property",
        body: "Fill in the form and we'll arrange a free, no-obligation survey at a time that suits you.",
        submit_label: "Request Free Survey",
        accent_color: "#0d9488",
        form_id: formId,
        contact_info: {
          phone: phone || undefined,
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

function buildModernHowItWorksBlocks(cs: CompanyData, formId: string): Array<{ block_type: string; content: Record<string, unknown> }> {
  const { tradeName, city, phone, locationText } = cs;
  return [
    {
      block_type: "hero",
      content: {
        layout: "centered",
        heading: "How It Works",
        heading_accent: "Works",
        subheading: `Getting a new heating system fitted by ${tradeName} is straightforward from start to finish. Here's exactly what to expect.`,
        cta_text: "Book a Free Survey",
        cta_url: "#contact",
        badges: [{ label: "No Obligation" }, { label: "Free Survey" }],
        accent_color: "#0d9488",
      },
    },
    {
      block_type: "process",
      content: {
        label: "Our Process",
        heading: "Simple from Start to Finish",
        subheading: `We manage every step so you don't have to — from your first call to commissioning and aftercare.`,
        background_color: "#ffffff",
        accent_color: "#0d9488",
        cta_text: "Start with a Free Survey",
        cta_url: "#contact",
        steps: [
          { icon: "📞", title: "Initial Enquiry", description: `Call us or fill in the form below. We'll discuss your property, your current heating system, and your goals. We'll suggest the most suitable options and arrange a free home survey.` },
          { icon: "🔍", title: "Free Home Survey", description: "One of our MCS-certified engineers visits your property to carry out a full heat loss assessment. We measure your insulation, windows, and radiators to design the ideal system — at no charge." },
          { icon: "📋", title: "Detailed Quotation", description: "You receive a transparent, fixed-price quotation showing exactly what's included, expected running costs, and any available grant funding. No hidden extras." },
          { icon: "📅", title: "Scheduled Installation", description: "We book an installation date that suits you. Most air source heat pump installs take 2–3 days; boiler replacements are usually done same or next day." },
          { icon: "🔧", title: "Professional Installation", description: `Our fully qualified engineers carry out the installation with care and tidiness. All work is signed off to manufacturer and MCS standards.` },
          { icon: "✅", title: "Commissioning & Handover", description: "We commission your system, walk you through operating it, register all warranties, and handle your grant application if applicable. You're left with full documentation." },
        ],
      },
    },
    {
      block_type: "features_bar",
      content: {
        background_color: "#0d9488",
        text_color: "#ffffff",
        items: [
          { icon: "🏠", title: "Minimal Disruption", description: "We work efficiently and clean up fully each day. Most installations are completed in under three days." },
          { icon: "📄", title: "Full Documentation", description: "You receive all warranties, certificates, and MCS documentation on completion." },
          { icon: "💷", title: "Grant Support", description: "We handle your Boiler Upgrade Scheme application from start to finish." },
          { icon: "🔧", title: "Ongoing Aftercare", description: "Annual servicing and support available to keep your system running at peak efficiency." },
        ],
      },
    },
    {
      block_type: "faq",
      content: {
        label: "FAQs",
        heading: "Common Questions",
        accent_color: "#0d9488",
        background_color: "#f9fafb",
        items: [
          { question: "How long does the whole process take from first contact to installation?", answer: "For most heat pump projects, the survey-to-install timeline is 2–4 weeks. Boiler replacements can often be done within days. We'll give you a realistic timeline at your survey." },
          { question: "Do I need to be home during the installation?", answer: "We ask that an adult is present at the start and end of each installation day, but you don't need to be home throughout. We'll coordinate access arrangements with you in advance." },
          { question: "What disruption should I expect?", answer: "For heat pumps, we need access to the outside of your property for the unit, plus internal pipe runs and cylinder installation. We protect your floors and clean up thoroughly each day." },
          { question: "How do I claim the Boiler Upgrade Scheme grant?", answer: "We handle the BUS grant application entirely — you simply sign the form and we submit it on your behalf. The £7,500 is deducted from your installation invoice." },
        ],
      },
    },
    {
      block_type: "contact_form",
      content: {
        label: "Get Started",
        heading: "Book Your Free Survey",
        subheading: "No Obligation — We'll Come to You",
        body: "Fill in the form and one of our engineers will contact you to arrange a convenient time for your free home survey.",
        submit_label: "Request Free Survey",
        accent_color: "#0d9488",
        form_id: formId,
        contact_info: {
          phone: phone || undefined,
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

function buildModernProjectsBlocks(cs: CompanyData, formId: string): Array<{ block_type: string; content: Record<string, unknown> }> {
  const { tradeName, city, county, phone, locationText } = cs;
  return [
    {
      block_type: "hero",
      content: {
        layout: "centered",
        heading: "Our Projects",
        heading_accent: "Projects",
        subheading: `Real installations by ${tradeName}. Browse completed projects across ${locationText} and see the results for yourself.`,
        cta_text: "Start Your Project",
        cta_url: "#contact",
        badges: [{ label: "MCS Certified" }, { label: "BUS Grant Eligible" }],
        accent_color: "#0d9488",
      },
    },
    {
      block_type: "project_showcase",
      content: {
        label: "Case Studies",
        heading: "Real Homes, Real Results",
        background_color: "#f9fafb",
        accent_color: "#0d9488",
        projects: [
          {
            title: "Victorian Semi — Oil to Air Source Heat Pump",
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
          {
            title: "New Build — Ground Source Heat Pump + UFH",
            location: county || city,
            image_url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop&auto=format",
            description: `A four-bedroom new build in ${county || city} was fitted with a ground source heat pump paired with fully embedded underfloor heating on both floors. Designed for A-rated EPC performance from day one.`,
            stats: [
              { value: "12kW Ground Source", label: "System Installed" },
              { value: "A Rated", label: "EPC Rating" },
              { value: "£0", label: "Running Cost (solar)" },
              { value: "Zero", label: "Carbon Emissions" },
            ],
            cta_text: "Discuss your project",
            cta_url: "#contact",
          },
          {
            title: "Detached Home — High-Efficiency Gas Boiler",
            location: city,
            image_url: "https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=800&h=600&fit=crop&auto=format",
            description: `A detached property in ${city} had an ageing combi boiler replaced with a Worcester Bosch 8000 series. Work was completed in one day with zero disruption, and the homeowner immediately noticed reduced energy bills.`,
            stats: [
              { value: "30kW Combi", label: "Boiler Installed" },
              { value: "94%", label: "Efficiency Rating" },
              { value: "1 Day", label: "Installation Time" },
              { value: "10yr", label: "Manufacturer Warranty" },
            ],
            cta_text: "Get a quote",
            cta_url: "#contact",
          },
        ],
      },
    },
    {
      block_type: "testimonials",
      content: {
        label: "What Clients Say",
        heading: "Straight from Our Customers",
        accent_color: "#0d9488",
        testimonials: [
          { author_name: "Sarah M.", location: city, rating: 5, body: `${tradeName} installed a 10kW air source heat pump. The process was seamless from survey to commissioning. Our heating bills have dropped by nearly half.` },
          { author_name: "James & Claire T.", location: county || city, rating: 5, body: "We had underfloor heating installed throughout our ground floor alongside a new heat pump. The team were tidy, professional and explained everything clearly. Couldn't recommend them more highly." },
          { author_name: "David R.", location: city, rating: 5, body: "Switched from an ageing oil boiler to a ground source heat pump. The whole project was managed brilliantly. Our grant application was handled for us too." },
        ],
      },
    },
    {
      block_type: "contact_form",
      content: {
        label: "Start Your Project",
        heading: "Tell Us About Your Home",
        subheading: "Free Survey — No Obligation",
        body: "Every project starts with a free home survey. Fill in the form and we'll be in touch to arrange a convenient time.",
        submit_label: "Request Free Survey",
        accent_color: "#0d9488",
        form_id: formId,
        contact_info: { phone: phone || undefined },
        fields: [
          { name: "name", label: "Full Name", type: "text", required: true },
          { name: "phone", label: "Phone Number", type: "tel", required: true },
          { name: "email", label: "Email Address", type: "email", required: true },
          { name: "postcode", label: "Property Postcode", type: "text", required: true },
          { name: "service", label: "Service Required", type: "select", options: ["Heat Pumps", "Underfloor Heating", "Solar Thermal", "Gas Boilers", "Oil Boilers", "Low-Carbon Systems"] },
          { name: "message", label: "Project Details", type: "textarea" },
        ],
      },
    },
  ];
}

function buildModernReviewsBlocks(cs: CompanyData, formId: string): Array<{ block_type: string; content: Record<string, unknown> }> {
  const { tradeName, city, county, phone, gasSafeNo, oftecNo, locationText } = cs;
  const accredBadges = [
    ...(gasSafeNo ? [{ name: "Gas Safe Registered", number: gasSafeNo }] : []),
    ...(oftecNo ? [{ name: "OFTEC Registered", number: oftecNo }] : []),
    { name: "MCS Certified" },
    { name: "Which? Trusted Trader" },
    { name: "TrustMark" },
  ];
  return [
    {
      block_type: "hero",
      content: {
        layout: "centered",
        heading: "Customer Reviews",
        heading_accent: "Reviews",
        subheading: `Don't just take our word for it. See what homeowners across ${locationText} say about ${tradeName}.`,
        cta_text: "Get a Free Quote",
        cta_url: "#contact",
        badges: [{ label: "5-Star Rated" }, { label: "MCS Certified" }],
        accent_color: "#0d9488",
      },
    },
    {
      block_type: "testimonials",
      content: {
        label: "Customer Reviews",
        heading: `Trusted by Homeowners Across ${locationText}`,
        accent_color: "#0d9488",
        testimonials: [
          { author_name: "Sarah M.", location: city, rating: 5, body: `${tradeName} installed a 10kW air source heat pump. The process was seamless from survey to commissioning. Our heating bills have dropped by nearly half. The team were professional throughout and left the house immaculate.` },
          { author_name: "James & Claire T.", location: county || city, rating: 5, body: "We had underfloor heating installed throughout our ground floor alongside a new heat pump. The team were tidy, professional and explained everything clearly. They handled our BUS grant application and we had the money deducted from the invoice. Couldn't recommend more highly." },
          { author_name: "David R.", location: city, rating: 5, body: "Switched from an ageing oil boiler to a ground source heat pump. The whole project was managed brilliantly from start to finish. Our grant application was handled, and the system was commissioned and handed over perfectly." },
          { author_name: "Angela & Phil W.", location: county || city, rating: 5, body: "Had a high-efficiency boiler installed to replace a 20-year-old system. Same-day installation, spotlessly clean, and our bills are already noticeably lower. The 10-year warranty gives us real peace of mind." },
          { author_name: "Tom H.", location: city, rating: 5, body: `Used ${tradeName} for solar thermal panels on our extension. The quote was clear and competitive, the work was excellent, and the system has been running perfectly for two years.` },
          { author_name: "Fiona B.", location: locationText, rating: 5, body: "From initial survey to final commissioning, the service was outstanding. Our heat pump system has transformed our home — warmer and quieter than the old boiler, and our electricity bill includes the heating now. Highly recommended." },
        ],
      },
    },
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
    {
      block_type: "contact_form",
      content: {
        label: "Join Our Happy Customers",
        heading: "Get Your Free Quote",
        subheading: "Book a Free Survey Today",
        body: "Fill in the form and we'll arrange a no-obligation survey at a time that suits you.",
        submit_label: "Request Free Survey",
        accent_color: "#0d9488",
        form_id: formId,
        contact_info: { phone: phone || undefined },
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

function buildModernAreasBlocks(cs: CompanyData, formId: string): Array<{ block_type: string; content: Record<string, unknown> }> {
  const { tradeName, city, county, phone, locationText } = cs;
  const areaList = [city, ...(county && county !== city ? [county] : [])];
  return [
    {
      block_type: "hero",
      content: {
        layout: "centered",
        heading: "Areas We Cover",
        heading_accent: "Cover",
        subheading: `${tradeName} serves homeowners across ${locationText} and the surrounding region. Find out if we operate in your area.`,
        cta_text: "Check Your Postcode",
        cta_url: "#contact",
        badges: [{ label: `Based in ${city}` }, { label: "Free Surveys" }],
        accent_color: "#0d9488",
      },
    },
    {
      block_type: "areas",
      content: {
        label: "Coverage",
        heading: "Serving Your Area",
        subheading: `We cover ${locationText} and surrounding areas. Contact us to confirm we cover your postcode — we're often able to travel further for larger projects.`,
        background_color: "#0d9488",
        outer_background: "#f0fdfb",
        accent_color: "#0d9488",
        areas: areaList,
        cta_text: "Check Your Postcode",
        cta_url: "#contact",
      },
    },
    {
      block_type: "faq",
      content: {
        label: "Coverage FAQs",
        heading: "Questions About Our Coverage",
        accent_color: "#0d9488",
        background_color: "#ffffff",
        items: [
          { question: `Do you cover all of ${county || city}?`, answer: `Yes — we cover ${locationText} comprehensively, including surrounding towns and villages. If you're unsure whether we cover your postcode, just give us a call or fill in the form below.` },
          { question: "Do you travel outside your main area?", answer: "For larger projects — such as ground source heat pump installations or commercial work — we're often able to travel beyond our core coverage area. Please contact us to discuss." },
          { question: "How quickly can you visit for a survey?", answer: "In most cases we can arrange a free home survey within 5–10 working days. Emergency boiler work can often be accommodated sooner." },
          { question: "Do you charge a call-out fee for surveys?", answer: "No. All home surveys are completely free and carry no obligation whatsoever. We visit, assess your property, and provide a detailed quote at no cost to you." },
        ],
      },
    },
    {
      block_type: "contact_form",
      content: {
        label: "Check Your Postcode",
        heading: "Find Out If We Cover You",
        subheading: "Enter Your Postcode Below",
        body: "Fill in the form with your postcode and we'll confirm whether we cover your area and arrange a free survey.",
        submit_label: "Check Availability",
        accent_color: "#0d9488",
        form_id: formId,
        contact_info: { phone: phone || undefined, service_area: `Serving ${locationText}` },
        fields: [
          { name: "name", label: "Full Name", type: "text", required: true },
          { name: "phone", label: "Phone Number", type: "tel", required: true },
          { name: "postcode", label: "Your Postcode", type: "text", required: true },
          { name: "service", label: "Service Required", type: "select", options: ["Heat Pumps", "Underfloor Heating", "Solar Thermal", "Gas Boilers", "Oil Boilers", "Low-Carbon Systems"] },
          { name: "message", label: "Additional Information", type: "textarea" },
        ],
      },
    },
  ];
}

function buildModernContactBlocks(cs: CompanyData, formId: string): Array<{ block_type: string; content: Record<string, unknown> }> {
  const { tradeName, city, phone, email, locationText, phoneUrl } = cs;
  return [
    {
      block_type: "hero",
      content: {
        layout: "centered",
        heading: "Contact Us",
        heading_accent: "Contact",
        subheading: `Get in touch with ${tradeName}. We'd love to hear from you — whether you have a question or you're ready to book your free survey.`,
        cta_text: phone ? `Call ${phone}` : "Send a Message",
        cta_url: phoneUrl,
        badges: [{ label: "Free Surveys" }, { label: "No Obligation" }],
        accent_color: "#0d9488",
      },
    },
    {
      block_type: "contact_form",
      content: {
        label: "Get In Touch",
        heading: "Send Us a Message",
        subheading: "Book Your Free Home Survey",
        body: "Tell us about your property and heating requirements and we'll arrange a free, no-obligation survey at a time that suits you.",
        submit_label: "Send Message",
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
          { name: "message", label: "Your Message", type: "textarea" },
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
    type PageRow = { website_id: unknown; tenant_id: string; slug: string; title: string; page_type: string; status: string; show_in_nav: boolean; nav_label: string | null; nav_order: number };
    const pageRows: PageRow[] = defaultPages.map((p, i) => ({
      website_id: website.id,
      tenant_id: req.tenantId!,
      // Normalise empty-string slug to "home" for the home page to avoid potential constraint edge cases
      slug: p.slug === "" || p.page_type === "home" ? "home" : String(p.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      title: String(p.title || "Page"),
      page_type: String(p.page_type || "custom"),
      status: "draft",
      show_in_nav: Boolean(p.show_in_nav),
      nav_label: p.nav_label ? String(p.nav_label) : null,
      nav_order: typeof p.nav_order === "number" ? p.nav_order : i + 1,
    }));

    const { data: pages, error: pagesError } = await db
      .from("website_pages")
      .insert(pageRows)
      .select("id, slug, page_type") as { data: Array<{ id: string; slug: string; page_type: string }> | null; error: { message: string; code: string } | null };

    if (pagesError || !pages?.length) {
      console.error("[apply-template] page insert failed:", pagesError);
      res.status(500).json({ error: "Failed to create pages", detail: pagesError?.message });
      return;
    }

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

    // ── 5. Seed blocks for all pages based on template slug ─────────────────
    const templateSlug = String(template.slug || "");

    if (templateSlug === "modern") {
      // Map slug → builder function
      const pageBlockBuilders: Record<string, () => Array<{ block_type: string; content: Record<string, unknown> }>> = {
        home:          () => buildModernHomeBlocks(cs, formId),
        "how-it-works": () => buildModernHowItWorksBlocks(cs, formId),
        services:      () => buildModernServicesBlocks(cs, formId),
        projects:      () => buildModernProjectsBlocks(cs, formId),
        reviews:       () => buildModernReviewsBlocks(cs, formId),
        areas:         () => buildModernAreasBlocks(cs, formId),
        contact:       () => buildModernContactBlocks(cs, formId),
      };

      // Also match page_type=home in case slug differs
      const allBlockRows: Array<{ page_id: string; tenant_id: string; block_type: string; content: Record<string, unknown>; sort_order: number; is_visible: boolean }> = [];

      for (const page of pages) {
        const builderKey = page.page_type === "home" ? "home" : page.slug;
        const builder = pageBlockBuilders[builderKey];
        if (!builder) continue;
        const blocks = builder();
        blocks.forEach((b, i) => {
          allBlockRows.push({ page_id: page.id, tenant_id: req.tenantId!, block_type: b.block_type, content: b.content, sort_order: i, is_visible: true });
        });
      }

      if (allBlockRows.length > 0) {
        const { error: blocksError } = await db.from("website_blocks").insert(allBlockRows);
        if (blocksError) {
          console.error("[apply-template] block insert failed:", blocksError);
        }
      }
    }
    // Other template slugs can be added here in future

    // ── 6. Publish all pages and the website ────────────────────────────────
    await db
      .from("website_pages")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("website_id", website.id);

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

// ─── Media Library ────────────────────────────────────────────────────────────

const MEDIA_BUCKET = "website-images";
// Max dimension for web-optimised output
const MEDIA_MAX_DIMENSION = 2400;
const MEDIA_JPEG_QUALITY = 82;

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB raw input limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
}).single("file");

router.post(
  "/website/media/upload",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  (req, res, next) => mediaUpload(req, res, next),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file provided" }); return; }

    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    // Optimise with sharp: resize to max 2400px, convert to webp
    let processedBuffer: Buffer;
    let width: number | undefined;
    let height: number | undefined;
    try {
      const image = sharp(file.buffer).rotate(); // auto-orient from EXIF
      const meta = await image.metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;

      let pipeline = image;
      if (w > MEDIA_MAX_DIMENSION || h > MEDIA_MAX_DIMENSION) {
        pipeline = pipeline.resize(MEDIA_MAX_DIMENSION, MEDIA_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
      }

      const webp = await pipeline.webp({ quality: MEDIA_JPEG_QUALITY }).toBuffer({ resolveWithObject: true });
      processedBuffer = webp.data;
      width = webp.info.width;
      height = webp.info.height;
    } catch {
      processedBuffer = file.buffer;
    }

    // Store under tenant/websiteId/timestamp-filename.webp
    const baseName = file.originalname.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
    const storagePath = `${req.tenantId}/${website.id}/${Date.now()}-${baseName}.webp`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, processedBuffer, { contentType: "image/webp", upsert: false });

    if (uploadError) { res.status(500).json({ error: uploadError.message }); return; }

    const { data: publicUrlData } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    const altText = (req.body.alt_text as string | undefined) || baseName.replace(/_/g, " ");

    const { data: mediaRow, error: insertError } = await db
      .from("website_media")
      .insert({
        tenant_id: req.tenantId,
        website_id: website.id,
        file_name: file.originalname,
        storage_path: storagePath,
        public_url: publicUrl,
        width: width ?? null,
        height: height ?? null,
        file_size: processedBuffer.length,
        mime_type: "image/webp",
        alt_text: altText,
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (insertError) { res.status(500).json({ error: "Failed to save media record" }); return; }

    res.json(mediaRow);
  }
);

router.get(
  "/website/media",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data, error } = await db
      .from("website_media")
      .select("id, file_name, public_url, width, height, file_size, alt_text, created_at")
      .eq("website_id", website.id)
      .order("created_at", { ascending: false })
      .limit(200) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to fetch media" }); return; }
    res.json(data || []);
  }
);

router.delete(
  "/website/media/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const { data: media } = await db
      .from("website_media")
      .select("storage_path, tenant_id")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { storage_path: string; tenant_id: string } | null };

    if (!media) { res.status(404).json({ error: "Not found" }); return; }

    await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([media.storage_path]);
    await db.from("website_media").delete().eq("id", id).eq("tenant_id", req.tenantId);

    res.sendStatus(204);
  }
);

export default router;
