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
    const previewUrl = rendererBase ? `${rendererBase}/preview/${website.id}` : null;

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
    const { data, error } = await db
      .from("website_templates")
      .select("id, name, slug, description, thumbnail_url, preview_url, category, sort_order, default_theme")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to load templates" }); return; }
    res.json(data || []);
  }
);

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

    // Update template and theme
    await db
      .from("websites")
      .update({ template_id, theme: template.default_theme })
      .eq("id", website.id);

    res.json({ ok: true });
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
