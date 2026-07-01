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
 */

import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import { supabaseAdmin } from "../lib/supabase";
import { addDomainToVercel } from "../lib/vercel";
import { triggerTenantIndexNowAutoSubmit } from "../lib/indexnow-tenant";
import { triggerRendererRevalidate } from "../lib/renderer-revalidate";
import { generatePagesFromFigma, validateGeneratedPages } from "../lib/figma-page-generator";
import { mergeTemplateBlockContent } from "../lib/template-clone";
import { WEBSITE_DELETE_TABLE_ORDER, retainsMediaLibraryOnWebsiteDelete } from "../lib/website-delete-policy";
import {
  requireAuth,
  requireTenant,
  requireRole,
  requirePlanFeature,
  type AuthenticatedRequest,
} from "../middlewares/auth";

import { generateDefaultTheme, getDefaultPagesForTemplate } from "../lib/template-utils";
const router: IRouter = Router();
const db = supabaseAdmin as any; // new tables not yet in generated types
const websiteAnalyticsCache = new Map<string, { data: unknown; ts: number }>();
const WEBSITE_ANALYTICS_CACHE_TTL_MS = 60_000;

async function getActiveDomainsForWebsite(websiteId: string): Promise<string[]> {
  const { data } = await db
    .from("website_domains")
    .select("domain")
    .eq("website_id", websiteId)
    .eq("is_active", true) as { data: Array<{ domain: string }> | null };

  return (data || []).map((row) => String(row.domain || "")).filter(Boolean);
}

type TemplateContentMode = "demo" | "empty" | "ai";

type TemplateSeedBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
};

type TemplateSeedPage = {
  blocks?: TemplateSeedBlock[];
};

type TemplateContentModeInfo = {
  defaultMode: TemplateContentMode;
  modes: TemplateContentMode[];
  seedsByMode: Partial<Record<TemplateContentMode, { pages?: Record<string, TemplateSeedPage> }>>;
};

const STRUCTURAL_CONTENT_KEYS = new Set(["id", "slug", "href", "url", "path", "phone", "email", "ctaHref"]);
const BLOCK_TYPE_ALIASES: Record<string, string> = {
  "hero.standard": "hero",
  "about.intro": "text",
  "trust.badges": "trust_badges",
  "services.grid": "services_grid",
  "reviews.grid": "reviews",
  "areas.grid": "areas_grid",
  "gallery.grid": "gallery",
  "cta.banner": "cta_band",
  "contact.split": "contact",
  "faq.accordion": "faq",
  "process.steps": "process",
  "features.list": "feature_cards",
  "blog.index": "blog_index",
  "legal.content": "legal_content",
};
const SKIPPED_BLOCK_TYPES = new Set(["site.header", "site.footer"]);
const SHARED_BLOCK_TYPES = new Set(["contact", "services_grid"]);

function normalizeTenantBlockType(blockType: unknown): string {
  const normalized = String(blockType || "").trim().toLowerCase();
  if (!normalized) return "text";
  return BLOCK_TYPE_ALIASES[normalized] || normalized;
}

function shouldSkipTenantBlock(blockType: unknown): boolean {
  const normalized = String(blockType || "").trim().toLowerCase();
  return SKIPPED_BLOCK_TYPES.has(normalized);
}

async function syncSharedBlockTypesAcrossWebsite(args: {
  tenantId: string;
  websiteId: string;
  sharedContentByType: Map<string, Record<string, unknown>>;
}): Promise<void> {
  const { tenantId, websiteId, sharedContentByType } = args;
  if (sharedContentByType.size === 0) return;

  const { data: pages } = await db
    .from("website_pages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("website_id", websiteId) as { data: Array<{ id: string }> | null };

  const pageIds = (pages || []).map((p) => p.id).filter(Boolean);
  if (pageIds.length === 0) return;

  for (const [blockType, content] of sharedContentByType.entries()) {
    await db
      .from("website_blocks")
      .update({ content })
      .eq("tenant_id", tenantId)
      .in("page_id", pageIds)
      .eq("block_type", blockType);
  }
}

function normalizeContentMode(mode: unknown): TemplateContentMode {
  const value = String(mode || "").trim().toLowerCase();
  if (value === "empty" || value === "ai" || value === "demo") {
    return value;
  }
  return "demo";
}

function listTemplateContentModes(template: Record<string, unknown>): TemplateContentMode[] {
  const source = (template.source as Record<string, unknown> | undefined) || {};
  const contentModes = (source.content_modes as Record<string, unknown> | undefined) || {};
  const rawModes = Array.isArray(contentModes.modes) ? contentModes.modes : [];
  const modes = rawModes
    .map((entry) => {
      if (typeof entry === "string") return normalizeContentMode(entry);
      if (entry && typeof entry === "object" && "mode" in entry) {
        return normalizeContentMode((entry as { mode?: unknown }).mode);
      }
      return null;
    })
    .filter((mode): mode is TemplateContentMode => Boolean(mode));

  return modes.length > 0 ? Array.from(new Set(modes)) : ["demo"];
}

function getTemplateContentModeInfo(template: Record<string, unknown>): TemplateContentModeInfo {
  const source = (template.source as Record<string, unknown> | undefined) || {};
  const contentModes = (source.content_modes as Record<string, unknown> | undefined) || {};
  const modes = listTemplateContentModes(template);
  const defaultMode = normalizeContentMode(contentModes.defaultMode);
  const seedsByMode = (contentModes.seeds as TemplateContentModeInfo["seedsByMode"]) || {};

  return {
    defaultMode: modes.includes(defaultMode) ? defaultMode : modes[0] || "demo",
    modes,
    seedsByMode,
  };
}

function transformContentValueForMode(value: unknown, mode: TemplateContentMode, keyHint = ""): unknown {
  if (mode === "demo") return value;
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (STRUCTURAL_CONTENT_KEYS.has(keyHint) || /href|url|path|slug|id/i.test(keyHint)) {
      return value;
    }
    return mode === "empty" ? "" : `[[ai:${keyHint || "text"}]]`;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((item) => transformContentValueForMode(item, mode, keyHint));
  }

  if (typeof value === "object") {
    const sourceObj = value as Record<string, unknown>;
    const nextObj: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(sourceObj)) {
      nextObj[key] = transformContentValueForMode(nestedValue, mode, key);
    }

    return nextObj;
  }

  return value;
}

function resolveModeBlockProps(
  mode: TemplateContentMode,
  template: Record<string, unknown>,
  pageSlug: string,
  block: { block_type?: unknown; block_id?: unknown; sort_order?: unknown; content?: unknown },
): Record<string, unknown> {
  const baseContent = (block.content as Record<string, unknown>) || {};
  if (mode === "demo") return baseContent;

  const modeInfo = getTemplateContentModeInfo(template);
  const seedPages = modeInfo.seedsByMode[mode]?.pages || {};
  const pageSeed = seedPages[pageSlug];
  const seededBlocks = pageSeed?.blocks || [];

  const sortOrder = typeof block.sort_order === "number" ? block.sort_order : 1;
  const fallbackIndex = Math.max(0, sortOrder - 1);
  const blockId = String(block.block_id || "");
  const blockType = String(block.block_type || "");

  const seeded =
    seededBlocks.find((seededBlock) => blockId && seededBlock.id === blockId)
    || seededBlocks.find((seededBlock) => blockType && seededBlock.type === blockType)
    || seededBlocks[fallbackIndex];

  if (seeded?.props && typeof seeded.props === "object") {
    return seeded.props;
  }

  return transformContentValueForMode(baseContent, mode) as Record<string, unknown>;
}

function pct1(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function weekStartDateIso(d: Date): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - day);
  return utc.toISOString().slice(0, 10);
}

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

function normalizeTenantPageType(pageType: unknown): string {
  const value = String(pageType || "").trim();
  return ["home", "service", "location", "about", "contact", "blog_index", "custom"].includes(value)
    ? value
    : "custom";
}

function buildArchivedSlug(slug: string): string {
  return `archived-${Date.now()}-${slug}`.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function insertTenantTemplateAuditLog(opts: {
  tenantId?: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  eventType: string;
  websiteId?: string | null;
  templateId?: string | null;
  detail?: Record<string, unknown>;
}) {
  if (!opts.tenantId) return;
  await (supabaseAdmin.from("tenant_audit_log") as any).insert({
    tenant_id: opts.tenantId,
    actor_id: opts.actorId || null,
    actor_email: opts.actorEmail || null,
    actor_role: opts.actorRole || null,
    event_type: opts.eventType,
    entity_type: "website_template",
    entity_id: opts.templateId || null,
    detail: {
      website_id: opts.websiteId || null,
      ...(opts.detail || {}),
    },
  });
}

async function createWebsiteForTenant(req: AuthenticatedRequest, templateId: string | null, theme: Record<string, unknown> | null = null): Promise<Record<string, unknown> | null> {
  const { data: cs } = await supabaseAdmin
    .from("company_settings")
    .select("name, trading_name")
    .eq("tenant_id", req.tenantId!)
    .eq("singleton_id", "default")
    .maybeSingle();

  const defaultName = (cs as any)?.trading_name || (cs as any)?.name || "My Website";

  const { data: website, error } = await db
    .from("websites")
    .insert({
      tenant_id: req.tenantId,
      template_id: templateId,
      site_name: defaultName,
      tagline: null,
      status: "draft",
      theme: theme || {},
      applied_at: templateId ? new Date().toISOString() : null,
    })
    .select()
    .single() as { data: Record<string, unknown> | null; error: unknown };

  if (error || !website) {
    return null;
  }

  provisionPlatformSubdomain(String(website.id), req.tenantId!, defaultName).catch((e) =>
    console.error("[website] subdomain provision failed:", e)
  );

  return website;
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
      .select("id, domain, verification_status, ssl_status, is_primary, is_active, is_platform_subdomain, www_redirect, cf_hostname_id, verification_token")
      .eq("website_id", website.id)
      .order("created_at", { ascending: true }) as { data: Record<string, unknown>[] | null };

    // Provide a preview URL using the renderer base URL (no custom domain required)
    let rendererBase = (process.env.RENDERER_BASE_URL || "").replace(/\/$/, "");
    if (!rendererBase && process.env.NODE_ENV !== "production") {
      rendererBase = "http://localhost:3002";
    }
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

    const { site_name, tagline, template_id } = req.body as {
      site_name?: string;
      tagline?: string;
      template_id?: string;
      content_mode?: string;
    };
    const requestedContentMode = normalizeContentMode((req.body as { content_mode?: string } | undefined)?.content_mode);

    let resolvedTemplateId: string | null = template_id || null;
    let resolvedTemplate: { slug?: string; default_pages: Array<Record<string, unknown>> | null; default_theme: Record<string, unknown> | null; design_tokens?: Record<string, unknown>; figma_export_info?: Record<string, unknown>; source?: Record<string, unknown> } | null = null;

    // If template_id provided, fetch and validate it
    if (resolvedTemplateId) {
      const { data: template } = await db
        .from("website_templates")
        .select("slug, default_pages, default_theme, design_tokens, figma_export_info, source")
        .eq("id", resolvedTemplateId)
        .eq("is_active", true)
        .maybeSingle() as { data: { slug?: string; default_pages: Array<Record<string, unknown>> | null; default_theme: Record<string, unknown> | null; design_tokens?: Record<string, unknown>; figma_export_info?: Record<string, unknown>; source?: Record<string, unknown> } | null };

      if (!template) {
        res.status(400).json({ error: "Selected template is not available or not live." });
        return;
      }

      resolvedTemplate = template;
    }
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
        template_id: resolvedTemplateId,
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

    // If template provided, seed default pages and theme
    if (resolvedTemplate) {
      let createdPages: Array<{ id: string; slug: string; page_type: string }> = [];
      const templateSlug = String(resolvedTemplate.slug || "") || "modern";
      const contentModeInfo = getTemplateContentModeInfo(resolvedTemplate as unknown as Record<string, unknown>);
      const selectedContentMode = contentModeInfo.modes.includes(requestedContentMode)
        ? requestedContentMode
        : contentModeInfo.defaultMode;
      let defaultPages = resolvedTemplate.default_pages?.length
        ? (resolvedTemplate.default_pages as Array<Record<string, unknown>>)
        : [];

      // If template has no stored default pages, attempt generation from uploaded Figma preview HTML.
      if (!defaultPages.length) {
        const figmaInfo = (resolvedTemplate.figma_export_info || {}) as Record<string, unknown>;
        const previewHtml = typeof figmaInfo.preview_html === "string" ? figmaInfo.preview_html : "";
        const uploadedImages = Array.isArray(figmaInfo.uploaded_images)
          ? (figmaInfo.uploaded_images as Array<{ public_url: string; file_name: string }>)
          : [];

        if (previewHtml) {
          const generatedPages = generatePagesFromFigma(previewHtml, uploadedImages);
          const validation = validateGeneratedPages(generatedPages);
          if (validation.valid && generatedPages.length > 0) {
            const genericPages = getDefaultPagesForTemplate(templateSlug);
            const generatedRecords = generatedPages as unknown as Array<Record<string, unknown>>;
            const generatedSlugs = new Set(generatedRecords.map((p) => String(p.slug || "")));
            const backfilledPages = genericPages.filter((p) => !generatedSlugs.has(String(p.slug || "")));

            defaultPages = [...generatedRecords, ...backfilledPages];
            console.log(`[website] Using ${generatedPages.length} Figma-generated pages and backfilled ${backfilledPages.length} defaults for template: ${templateSlug}`);
          } else {
            console.log(`[website] Figma page generation invalid, falling back to generic defaults: ${validation.errors.join("; ")}`);
          }
        }
      }

      if (!defaultPages.length) {
        defaultPages = getDefaultPagesForTemplate(templateSlug);
      }

      // Keep nav ordering stable and deterministic after any merges/backfills.
      defaultPages = defaultPages.map((p, i) => ({
        ...p,
        nav_order: i + 1,
      }));

      console.log(`[website] Creating ${defaultPages?.length || 0} pages for template slug: ${templateSlug}`);

      if (defaultPages?.length) {
        const pageInserts = defaultPages.map((p: Record<string, unknown>, i: number) => {
          const normalizedPageType = String(p.page_type || "") === "home" ? "home" : "custom";

          return {
            website_id: website.id,
            tenant_id: req.tenantId,
            slug: String(p.slug || ""),
            title: String(p.title || "Page"),
            page_type: normalizedPageType,
            status: "draft",
            show_in_nav: Boolean(p.show_in_nav),
            nav_label: p.nav_label ? String(p.nav_label) : null,
            nav_order: typeof p.nav_order === "number" ? p.nav_order : i + 1,
          };
        });

        const { data: pages } = await db
          .from("website_pages")
          .insert(pageInserts)
          .select("id, slug, page_type") as { data: Array<{ id: string; slug: string; page_type: string }> | null };

        createdPages = pages || [];
        console.log(`[website] Created ${pages?.length || 0} pages`);

        // Seed initial blocks from the template page definitions.
        if (createdPages.length > 0) {
          const pageIdBySlug = new Map<string, string>(
            createdPages.map((p) => [String(p.slug || ""), String(p.id || "")])
          );

          const blockInserts: Array<{
            page_id: string;
            tenant_id: string | undefined;
            block_type: string;
            content: Record<string, unknown>;
            sort_order: number;
            is_visible: boolean;
          }> = [];

          for (const pageDef of defaultPages) {
            const pageSlug = String(pageDef.slug || "");
            const pageId = pageIdBySlug.get(pageSlug);
            if (!pageId) continue;

            const pageBlocks = Array.isArray(pageDef.blocks)
              ? (pageDef.blocks as Array<Record<string, unknown>>)
              : [];

            pageBlocks.forEach((blockDef, i) => {
              const rawBlockType = String(blockDef.type || blockDef.block_type || "text");
              if (shouldSkipTenantBlock(rawBlockType)) return;
              const blockType = normalizeTenantBlockType(rawBlockType);
              const syntheticBlock = {
                block_type: rawBlockType,
                block_id: blockDef.id,
                sort_order: typeof blockDef.sort_order === "number" ? blockDef.sort_order : i + 1,
                content: (blockDef.content as Record<string, unknown>)
                  || (blockDef.props as Record<string, unknown>)
                  || {},
              };

              const modeBlockContent = resolveModeBlockProps(
                selectedContentMode,
                resolvedTemplate as unknown as Record<string, unknown>,
                pageSlug,
                syntheticBlock,
              );

              blockInserts.push({
                page_id: pageId,
                tenant_id: req.tenantId,
                block_type: blockType,
                content: modeBlockContent,
                sort_order: typeof blockDef.sort_order === "number" ? blockDef.sort_order : i,
                is_visible: blockDef.is_visible !== false,
              });
            });
          }

          if (blockInserts.length > 0) {
            const { error: blockSeedError } = await db.from("website_blocks").insert(blockInserts) as { error: unknown };
            if (blockSeedError) {
              console.error("[website] block seed failed:", blockSeedError);
            } else {
              console.log(`[website] Seeded ${blockInserts.length} blocks`);
            }
          }
        }
      }

      const hasTemplateTheme = !!resolvedTemplate.default_theme
        && Object.keys(resolvedTemplate.default_theme as Record<string, unknown>).length > 0;
      const defaultTheme = hasTemplateTheme
        ? (resolvedTemplate.default_theme as Record<string, unknown>)
        : generateDefaultTheme(resolvedTemplate.design_tokens || {});

      if (defaultTheme) {
        await db
          .from("websites")
          .update({ theme: defaultTheme })
          .eq("id", website.id);
        console.log("[website] Applied theme");
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

    // Delete in dependency order, while intentionally retaining website media.
    if (!retainsMediaLibraryOnWebsiteDelete()) {
      res.status(500).json({ error: "Delete policy violation: website media must be retained" });
      return;
    }

    for (const table of WEBSITE_DELETE_TABLE_ORDER) {
      let query = db.from(table).delete();
      if (table === "website_blocks" || table === "website_page_versions") {
        query = query.eq("tenant_id", req.tenantId);
      } else if (table === "website_pages" || table === "website_domains") {
        query = query.eq("website_id", website.id);
      } else {
        query = query.eq("id", website.id);
      }
      await query;
    }

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

    triggerTenantIndexNowAutoSubmit(req.tenantId!, "website_publish");
    const activeDomains = await getActiveDomainsForWebsite(String(website.id));
    void triggerRendererRevalidate({ domains: activeDomains, websiteIds: [String(website.id)], reason: "website_publish" });

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
      .select("id, name, slug, description, thumbnail_url, preview_url, category, sort_order, theme_json, default_theme, published_at, source")
      // Support both legacy publish status and superadmin importer publish state.
      .or("status.eq.published,status.eq.live,is_active.eq.true")
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to load templates" }); return; }
    const templates = (data || []).map((template) => ({
      ...template,
      content_modes: listTemplateContentModes(template),
      source: undefined,
    }));
    res.json(templates);
  }
);

router.post(
  "/website/templates/:templateId/apply",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { templateId } = req.params;
    const confirmReplace = Boolean((req.body as { confirmReplace?: boolean } | undefined)?.confirmReplace);
    const requestedContentMode = normalizeContentMode((req.body as { contentMode?: string } | undefined)?.contentMode);

    const { data: template, error: templateError } = await db
      .from("website_templates")
      .select("id, name, slug, version, status, theme_json, default_theme, source")
      .eq("id", templateId)
      .or("status.eq.published,status.eq.live,is_active.eq.true")
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (templateError || !template) {
      res.status(404).json({ error: "Template not found or not published" });
      return;
    }

    const { data: websitePages, error: websitePagesError } = await db
      .from("website_pages")
      .select("id, slug, status")
      .eq("tenant_id", req.tenantId!)
      .order("created_at", { ascending: true }) as { data: Array<{ id: string; slug: string; status: string }> | null; error: unknown };

    if (websitePagesError) {
      res.status(500).json({ error: "Failed to inspect existing pages", code: "TENANT_PAGE_CHECK_FAILED" });
      return;
    }

    let website = await getWebsiteForTenant(req.tenantId!);
    const hasExistingPages = (websitePages || []).length > 0;

    if (hasExistingPages && !confirmReplace) {
      await insertTenantTemplateAuditLog({
        tenantId: req.tenantId,
        actorId: req.userId,
        actorEmail: req.userEmail,
        actorRole: req.userRole,
        eventType: "website_template_apply_blocked_existing_pages",
        templateId: String(template.id),
        detail: { page_count: websitePages?.length || 0 },
      });
      res.status(409).json({
        error: "Website already has pages. Confirm replacement to continue.",
        code: "TENANT_PAGES_EXIST",
        page_count: websitePages?.length || 0,
        confirmReplaceRequired: true,
      });
      return;
    }

    if (!website) {
      website = await createWebsiteForTenant(req, String(template.id), (template.theme_json as Record<string, unknown>) || (template.default_theme as Record<string, unknown>) || {});
      if (!website) {
        res.status(500).json({ error: "Failed to create website", code: "WEBSITE_CREATE_FAILED" });
        return;
      }
    }

    const theme = (template.theme_json as Record<string, unknown>) || (template.default_theme as Record<string, unknown>) || {};

    if (hasExistingPages && confirmReplace) {
      const archivedAt = Date.now();
      for (const page of websitePages || []) {
        await db
          .from("website_pages")
          .update({
            status: "archived",
            show_in_nav: false,
            slug: buildArchivedSlug(`${page.slug}-${archivedAt}`),
          })
          .eq("id", page.id)
          .eq("tenant_id", req.tenantId!);
      }
    }

    if (!hasExistingPages && !website) {
      res.status(500).json({ error: "Failed to prepare website", code: "WEBSITE_PREPARE_FAILED" });
      return;
    }

    const { data: templatePages, error: pagesError } = await db
      .from("website_template_pages")
      .select("id, slug, title, path, page_type, sort_order, seo, settings")
      .eq("template_id", template.id)
      .order("sort_order", { ascending: true }) as { data: Array<Record<string, unknown>> | null; error: unknown };

    if (pagesError) {
      res.status(500).json({ error: "Failed to load template pages", code: "TEMPLATE_PAGES_LOAD_FAILED" });
      return;
    }

    if (!templatePages || templatePages.length === 0) {
      res.status(400).json({ error: "Template has no pages to apply", code: "TEMPLATE_NO_PAGES" });
      return;
    }

    const { data: templateBlocks, error: blocksError } = await db
      .from("website_template_blocks")
      .select("id, page_id, block_id, block_type, sort_order, content, settings")
      .eq("template_id", template.id)
      .order("sort_order", { ascending: true }) as { data: Array<Record<string, unknown>> | null; error: unknown };

    if (blocksError) {
      res.status(500).json({ error: "Failed to load template blocks", code: "TEMPLATE_BLOCKS_LOAD_FAILED" });
      return;
    }

    const contentModeInfo = getTemplateContentModeInfo(template);
    const selectedContentMode = contentModeInfo.modes.includes(requestedContentMode)
      ? requestedContentMode
      : contentModeInfo.defaultMode;

    const pageInserts = templatePages.map((page, index) => {
      const seo = (page.seo as Record<string, unknown>) || {};
      const settings = (page.settings as Record<string, unknown>) || {};
      return {
        website_id: website!.id,
        tenant_id: req.tenantId,
        slug: String(page.slug || `page-${index + 1}`),
        title: String(page.title || page.slug || "Page"),
        page_type: normalizeTenantPageType(page.page_type),
        status: "draft",
        meta_title: typeof seo.meta_title === "string" ? seo.meta_title : null,
        meta_description: typeof seo.meta_description === "string" ? seo.meta_description : null,
        og_image_url: typeof seo.og_image_url === "string" ? seo.og_image_url : null,
        canonical_url: typeof seo.canonical_url === "string" ? seo.canonical_url : null,
        no_index: Boolean(seo.no_index),
        schema_markup: seo.schema_markup || null,
        show_in_nav: settings.show_in_nav !== false,
        nav_label: typeof settings.nav_label === "string" ? settings.nav_label : String(page.title || page.slug || "Page"),
        nav_order: typeof settings.nav_order === "number" ? settings.nav_order : index + 1,
      };
    });

    const { data: insertedPages, error: insertedPagesError } = await db
      .from("website_pages")
      .insert(pageInserts)
      .select("id, slug");

    if (insertedPagesError || !insertedPages) {
      res.status(500).json({ error: "Failed to create tenant pages", code: "TENANT_PAGES_CREATE_FAILED" });
      return;
    }

    const pageIdBySlug = new Map<string, string>((insertedPages || []).map((page: Record<string, unknown>) => [String(page.slug), String(page.id)]));
    const templateBlocksList = templateBlocks || [];
    const blockInserts = templateBlocksList.flatMap((block) => {
      if (shouldSkipTenantBlock(block.block_type)) return [];
      const targetPage = templatePages.find((page: Record<string, unknown>) => String(page.id) === String(block.page_id));
      const tenantPageId = targetPage ? pageIdBySlug.get(String(targetPage.slug)) : null;
      if (!tenantPageId) return [];

      const modeBlockContent = resolveModeBlockProps(
        selectedContentMode,
        template,
        String(targetPage?.slug || ""),
        {
          block_type: block.block_type,
          block_id: block.block_id,
          sort_order: block.sort_order,
          content: (block.content as Record<string, unknown>) || {},
        },
      );

      const blockContent = mergeTemplateBlockContent(
        modeBlockContent,
        (block.settings as Record<string, unknown>) || {},
      );

      return [{
        page_id: tenantPageId,
        tenant_id: req.tenantId,
        block_type: normalizeTenantBlockType(block.block_type),
        content: blockContent,
        sort_order: typeof block.sort_order === "number" ? block.sort_order : 0,
        is_visible: true,
      }];
    });

    if (blockInserts.length > 0) {
      const { error: blockInsertError } = await db.from("website_blocks").insert(blockInserts) as { error: unknown };
      if (blockInsertError) {
        res.status(500).json({ error: "Failed to create tenant blocks", code: "TENANT_BLOCKS_CREATE_FAILED" });
        return;
      }
    }

    const { error: websiteUpdateError } = await db
      .from("websites")
      .update({
        template_id: template.id,
        applied_template_version: typeof template.version === "number" ? template.version : null,
        applied_at: new Date().toISOString(),
        theme,
      })
      .eq("id", website.id);

    if (websiteUpdateError) {
      res.status(500).json({ error: "Failed to update website template settings", code: "WEBSITE_UPDATE_FAILED" });
      return;
    }

    await insertTenantTemplateAuditLog({
      tenantId: req.tenantId,
      actorId: req.userId,
      actorEmail: req.userEmail,
      actorRole: req.userRole,
      eventType: "website_template_applied",
      websiteId: String(website.id),
      templateId: String(template.id),
      detail: {
        pages_created: insertedPages.length,
        blocks_created: blockInserts.length,
        replaced_existing_pages: hasExistingPages,
      },
    });

    res.json({
      success: true,
      website_id: website.id,
      template_id: template.id,
      pages_created: insertedPages.length,
      blocks_created: blockInserts.length,
      confirm_replace: hasExistingPages,
    });
  }
);

router.get(
  "/website/analytics",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    const cacheKey = `${req.tenantId}:${website.id}`;
    const cached = websiteAnalyticsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < WEBSITE_ANALYTICS_CACHE_TTL_MS) {
      res.set("Cache-Control", "private, max-age=60");
      res.set("X-Cache", "HIT");
      res.json(cached.data);
      return;
    }

    const now = new Date();
    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 29);
    const start30Iso = start30.toISOString();

    const [
      { data: pages },
      { data: forms },
      { data: submissions },
      { data: submissionsLast30 },
      { data: websiteEnquiries },
      { count: totalSubmissionsCount },
      { count: submissionsLast30Count },
      { count: newCount },
      { count: readCount },
      { count: convertedCount },
      { count: spamCount },
      { count: leadsLast30Count },
      { data: pageViewEvents },
      { data: sessionEndEvents },
    ] = await Promise.all([
      db
        .from("website_pages")
        .select("id, status")
        .eq("website_id", website.id) as Promise<{ data: Array<{ id: string; status: string }> | null }>,
      db
        .from("website_forms")
        .select("id, name, is_active")
        .eq("website_id", website.id) as Promise<{ data: Array<{ id: string; name: string; is_active: boolean }> | null }>,
      db
        .from("website_form_submissions")
        .select("id, form_id, status, created_at, data")
        .eq("website_id", website.id)
        .order("created_at", { ascending: false })
        .limit(2000) as Promise<{ data: Array<{ id: string; form_id: string; status: string; created_at: string; data: Record<string, unknown> }> | null }>,
      db
        .from("website_form_submissions")
        .select("created_at")
        .eq("website_id", website.id)
        .gte("created_at", start30Iso)
        .order("created_at", { ascending: false })
        .limit(5000) as Promise<{ data: Array<{ created_at: string }> | null }>,
      db
        .from("enquiries")
        .select("id, source, created_at")
        .eq("tenant_id", req.tenantId)
        .in("source", ["website", "website_contact_form", "website_free_survey"])
        .order("created_at", { ascending: false })
        .limit(2000) as Promise<{ data: Array<{ id: string; source: string; created_at: string }> | null }>,
      db
        .from("website_form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("website_id", website.id),
      db
        .from("website_form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("website_id", website.id)
        .gte("created_at", start30Iso),
      db
        .from("website_form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("website_id", website.id)
        .eq("status", "new"),
      db
        .from("website_form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("website_id", website.id)
        .eq("status", "read"),
      db
        .from("website_form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("website_id", website.id)
        .eq("status", "converted"),
      db
        .from("website_form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("website_id", website.id)
        .eq("status", "spam"),
      db
        .from("enquiries")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", req.tenantId)
        .in("source", ["website", "website_contact_form", "website_free_survey"])
        .gte("created_at", start30Iso),
      db
        .from("website_traffic_events")
        .select("session_id, visitor_id, path, referrer, created_at")
        .eq("website_id", website.id)
        .eq("event_type", "page_view")
        .gte("created_at", start30Iso)
        .order("created_at", { ascending: false })
        .limit(50000) as Promise<{
          data: Array<{
            session_id: string | null;
            visitor_id: string | null;
            path: string | null;
            referrer: string | null;
            created_at: string;
          }> | null;
        }>,
      db
        .from("website_traffic_events")
        .select("session_id, session_elapsed_seconds, session_page_index")
        .eq("website_id", website.id)
        .eq("event_type", "session_end")
        .gte("created_at", start30Iso)
        .order("created_at", { ascending: false })
        .limit(20000) as Promise<{
          data: Array<{
            session_id: string | null;
            session_elapsed_seconds: number | null;
            session_page_index: number | null;
          }> | null;
        }>,
    ]);

    const pagesList = pages || [];
    const formsList = forms || [];
    const submissionList = submissions || [];
    const submissionsLast30List = submissionsLast30 || [];
    const websiteLeadList = websiteEnquiries || [];
    const pageViewList = pageViewEvents || [];
    const sessionEndList = sessionEndEvents || [];

    const totalPages = pagesList.length;
    const publishedPages = pagesList.filter((p) => p.status === "published").length;
    const activeForms = formsList.filter((f) => f.is_active).length;

    const funnel = {
      new: Number(newCount || 0),
      read: Number(readCount || 0),
      converted: Number(convertedCount || 0),
      spam: Number(spamCount || 0),
    };

    const totalSubmissions = Number(totalSubmissionsCount || 0);
    const conversionRate = totalSubmissions > 0 ? Math.round((funnel.converted / totalSubmissions) * 1000) / 10 : 0;
    const leadsLast30 = Number(leadsLast30Count || 0);

    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start30);
      d.setDate(start30.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, 0);
    }
    for (const s of submissionsLast30List) {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
    }
    const daily = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));

    const formsById = new Map(formsList.map((f) => [f.id, f]));
    const formAgg = new Map<string, { form_id: string; form_name: string; submissions: number; converted: number }>();
    for (const s of submissionList) {
      const existing = formAgg.get(s.form_id) || {
        form_id: s.form_id,
        form_name: formsById.get(s.form_id)?.name || "Untitled form",
        submissions: 0,
        converted: 0,
      };
      existing.submissions += 1;
      if (s.status === "converted") existing.converted += 1;
      formAgg.set(s.form_id, existing);
    }
    const topForms = Array.from(formAgg.values())
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 5)
      .map((f) => ({
        ...f,
        conversion_rate: f.submissions > 0 ? Math.round((f.converted / f.submissions) * 1000) / 10 : 0,
      }));

    const sourceCounts = new Map<string, number>();
    for (const e of websiteLeadList) {
      sourceCounts.set(e.source, (sourceCounts.get(e.source) || 0) + 1);
    }
    const sourceBreakdown = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const recentSubmissions = submissionList.slice(0, 10).map((s) => {
      const payload = (s.data || {}) as Record<string, unknown>;
      return {
        id: s.id,
        created_at: s.created_at,
        status: s.status,
        form_name: formsById.get(s.form_id)?.name || "Untitled form",
        name: String(payload.name || payload.full_name || ""),
        email: String(payload.email || ""),
        phone: String(payload.phone || payload.telephone || ""),
      };
    });

    const trafficDailyMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start30);
      d.setDate(start30.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      trafficDailyMap.set(key, 0);
    }

    const topPagesMap = new Map<string, number>();
    const channelMap = new Map<string, number>();
    const uniqueVisitors = new Set<string>();
    const sessionAgg = new Map<string, { elapsed_seconds: number; page_count: number }>();
    let pageViews = 0;

    const classifyChannel = (referrer: string | null): string => {
      if (!referrer) return "direct";
      const ref = referrer.toLowerCase();
      if (ref.includes("google.") || ref.includes("bing.") || ref.includes("duckduckgo.") || ref.includes("yahoo.")) return "search";
      if (ref.includes("facebook.") || ref.includes("instagram.") || ref.includes("t.co") || ref.includes("twitter.") || ref.includes("linkedin.") || ref.includes("youtube.")) return "social";
      return "referral";
    };

    for (const ev of sessionEndList) {
      const sessionId = (ev.session_id || "").trim();
      if (sessionId) {
        const existing = sessionAgg.get(sessionId) || { elapsed_seconds: 0, page_count: 0 };
        const elapsed = Math.max(0, Number(ev.session_elapsed_seconds || 0));
        const pageCount = Math.max(0, Number(ev.session_page_index || 0));
        existing.elapsed_seconds = Math.max(existing.elapsed_seconds, elapsed);
        existing.page_count = Math.max(existing.page_count, pageCount);
        sessionAgg.set(sessionId, existing);
      }
    }

    for (const ev of pageViewList) {
      const sessionId = (ev.session_id || "").trim();
      if (sessionId && !sessionAgg.has(sessionId)) {
        sessionAgg.set(sessionId, { elapsed_seconds: 0, page_count: 0 });
      }
      if (sessionId) {
        const existing = sessionAgg.get(sessionId) || { elapsed_seconds: 0, page_count: 0 };
        existing.page_count += 1;
        sessionAgg.set(sessionId, existing);
      }

      pageViews += 1;

      const visitorId = (ev.visitor_id || "").trim();
      if (visitorId) uniqueVisitors.add(visitorId);

      const path = (ev.path || "/").trim() || "/";
      topPagesMap.set(path, (topPagesMap.get(path) || 0) + 1);

      const channel = classifyChannel(ev.referrer || null);
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);

      const key = new Date(String(ev.created_at)).toISOString().slice(0, 10);
      if (trafficDailyMap.has(key)) trafficDailyMap.set(key, (trafficDailyMap.get(key) || 0) + 1);
    }

    const sessions = sessionAgg.size;
    const totalElapsedSeconds = Array.from(sessionAgg.values()).reduce((sum, s) => sum + s.elapsed_seconds, 0);
    const avgSessionDurationSeconds = sessions > 0 ? Math.round(totalElapsedSeconds / sessions) : 0;
    const bouncedSessions = Array.from(sessionAgg.values()).filter((s) => s.page_count <= 1).length;
    const bounceRatePercent = sessions > 0 ? Math.round((bouncedSessions / sessions) * 1000) / 10 : 0;
    const pagesPerSession = sessions > 0 ? Math.round((pageViews / sessions) * 100) / 100 : 0;

    const topPages = Array.from(topPagesMap.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    const trafficChannels = Array.from(channelMap.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count);

    const dailyTraffic = Array.from(trafficDailyMap.entries()).map(([date, count]) => ({ date, count }));

    const trafficToSubmissionRate = pct1(Number(submissionsLast30Count || 0), pageViews);
    const visitorToLeadRate = pct1(leadsLast30, uniqueVisitors.size);
    const readOrConverted = Number(funnel.read || 0) + Number(funnel.converted || 0);
    const followUpProgressRate = pct1(readOrConverted, totalSubmissions);
    const publishedCoverageRate = pct1(publishedPages, Math.max(1, totalPages));

    const benchmarkStatus = (value: number, good: number, ok: number, inverse = false): "green" | "amber" | "red" => {
      if (!inverse) {
        if (value >= good) return "green";
        if (value >= ok) return "amber";
        return "red";
      }
      if (value <= good) return "green";
      if (value <= ok) return "amber";
      return "red";
    };

    const statusPoints = (status: "green" | "amber" | "red"): number => {
      if (status === "green") return 100;
      if (status === "amber") return 65;
      return 30;
    };

    const benchmarkRows = [
      { key: "visitors", status: benchmarkStatus(uniqueVisitors.size, 300, 120), weight: 15 },
      { key: "traffic_to_submission", status: benchmarkStatus(trafficToSubmissionRate, 1.5, 0.8), weight: 20 },
      { key: "visitor_to_lead", status: benchmarkStatus(visitorToLeadRate, 2.0, 1.0), weight: 15 },
      { key: "bounce", status: benchmarkStatus(bounceRatePercent, 50, 65, true), weight: 15 },
      { key: "pages_per_session", status: benchmarkStatus(pagesPerSession, 1.8, 1.4), weight: 10 },
      { key: "follow_up", status: benchmarkStatus(followUpProgressRate, 75, 50), weight: 15 },
      { key: "published_coverage", status: benchmarkStatus(publishedCoverageRate, 80, 50), weight: 10 },
    ];

    const healthScore = Math.round(
      benchmarkRows.reduce((sum, row) => sum + (statusPoints(row.status) * row.weight) / 100, 0)
    );
    const healthLabel = healthScore >= 80 ? "Strong" : healthScore >= 60 ? "Needs Attention" : "At Risk";

    const weekStart = weekStartDateIso(now);
    await db
      .from("website_health_snapshots")
      .upsert({
        website_id: website.id,
        tenant_id: req.tenantId,
        week_start: weekStart,
        health_score: healthScore,
        health_label: healthLabel,
        metrics: {
          traffic_to_submission_rate: trafficToSubmissionRate,
          visitor_to_lead_rate: visitorToLeadRate,
          follow_up_progress_rate: followUpProgressRate,
          published_coverage_rate: publishedCoverageRate,
          page_views_last_30_days: pageViews,
          unique_visitors_last_30_days: uniqueVisitors.size,
          bounce_rate_percent: bounceRatePercent,
          pages_per_session: pagesPerSession,
        },
      }, { onConflict: "website_id,week_start" });

    const twelveWeeksAgo = new Date(now);
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 7 * 12);
    const { data: healthHistoryRows } = await db
      .from("website_health_snapshots")
      .select("week_start, health_score, health_label")
      .eq("website_id", website.id)
      .gte("week_start", twelveWeeksAgo.toISOString().slice(0, 10))
      .order("week_start", { ascending: true }) as {
        data: Array<{ week_start: string; health_score: number; health_label: string }> | null;
      };

    const responseBody = {
      summary: {
        total_pages: totalPages,
        published_pages: publishedPages,
        active_forms: activeForms,
        total_submissions: totalSubmissions,
        submissions_last_30_days: Number(submissionsLast30Count || 0),
        website_leads_last_30_days: leadsLast30,
        conversion_rate_percent: conversionRate,
      },
      traffic_summary: {
        page_views_last_30_days: pageViews,
        unique_visitors_last_30_days: uniqueVisitors.size,
        sessions_last_30_days: sessions,
        avg_session_duration_seconds: avgSessionDurationSeconds,
        bounce_rate_percent: bounceRatePercent,
        pages_per_session: pagesPerSession,
      },
      funnel,
      daily,
      daily_traffic: dailyTraffic,
      top_forms: topForms,
      top_pages: topPages,
      traffic_channels: trafficChannels,
      source_breakdown: sourceBreakdown,
      recent_submissions: recentSubmissions,
      health: {
        score: healthScore,
        label: healthLabel,
      },
      health_history: (healthHistoryRows || []).map((r) => ({
        week_start: r.week_start,
        score: Number(r.health_score || 0),
        label: String(r.health_label || "Needs Attention"),
      })),
    };

    websiteAnalyticsCache.set(cacheKey, { data: responseBody, ts: Date.now() });
    res.set("Cache-Control", "private, max-age=60");
    res.set("X-Cache", "MISS");
    res.json(responseBody);
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

    if ("slug" in updates || "no_index" in updates) {
      triggerTenantIndexNowAutoSubmit(req.tenantId!, "page_url_or_indexing_change");
    }

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
      .select("id, website_id, title, meta_title, meta_description")
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

    triggerTenantIndexNowAutoSubmit(req.tenantId!, "page_publish");
    const websiteId = String(page.website_id || "");
    if (websiteId) {
      const activeDomains = await getActiveDomainsForWebsite(websiteId);
      void triggerRendererRevalidate({ domains: activeDomains, websiteIds: [websiteId], reason: "page_publish" });
    }

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
      .select("id, website_id")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string; website_id: string | null } | null };

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }

    // Delete existing blocks
    await db.from("website_blocks").delete().eq("page_id", id);

    // Insert new blocks
    if (blocks.length > 0) {
      const inserts = blocks
        .filter((b) => !shouldSkipTenantBlock(b.block_type))
        .map((b, i) => ({
          page_id: id,
          tenant_id: req.tenantId,
          block_type: normalizeTenantBlockType(b.block_type),
          content: b.content || {},
          sort_order: i,
          is_visible: b.is_visible !== false,
        }));

      if (inserts.length > 0) {
        const { error } = await db.from("website_blocks").insert(inserts) as { error: unknown };
        if (error) { res.status(500).json({ error: "Failed to save blocks" }); return; }

        const sharedContentByType = new Map<string, Record<string, unknown>>();
        for (const row of inserts) {
          if (!SHARED_BLOCK_TYPES.has(row.block_type)) continue;
          sharedContentByType.set(row.block_type, row.content as Record<string, unknown>);
        }

        if (page?.website_id && req.tenantId && sharedContentByType.size > 0) {
          await syncSharedBlockTypesAcrossWebsite({
            tenantId: req.tenantId,
            websiteId: page.website_id,
            sharedContentByType,
          });
        }
      }
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

function sanitizeFileName(input: string): string {
  const base = input.replace(/\.[^.]+$/, "");
  return base.replace(/[^a-z0-9_-]/gi, "_").slice(0, 60) || "image";
}

function bucketForAttachment(file: { file_type?: unknown; storage_path?: unknown }): string {
  const storagePath = String(file.storage_path || "");
  if (storagePath.startsWith("form-submissions/")) return "public-uploads";
  const fileType = String(file.file_type || "").toLowerCase();
  return fileType.startsWith("image/") ? "service-photos" : "service-documents";
}

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

router.delete(
  "/website/media/purge",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const confirm = String((req.body as { confirm?: unknown } | undefined)?.confirm || "").trim();
    if (confirm !== "PURGE_MEDIA") {
      res.status(400).json({ error: "Confirmation phrase required: PURGE_MEDIA" });
      return;
    }

    const { data: mediaRows } = await db
      .from("website_media")
      .select("storage_path")
      .eq("website_id", website.id) as { data: Array<{ storage_path: string }> | null };

    const paths = (mediaRows || []).map((row) => row.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(paths);
    }

    await db.from("website_media").delete().eq("website_id", website.id);
    await db.from("website_gallery_items").delete().eq("website_id", website.id);

    res.json({ purged: paths.length });
  }
);

router.get(
  "/website/gallery-items",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data, error } = await db
      .from("website_gallery_items")
      .select("id, image_url, caption, alt_text, category, sort_order, is_visible, created_at")
      .eq("website_id", website.id)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to fetch gallery items" }); return; }
    res.json(data || []);
  }
);

router.post(
  "/website/gallery-items",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const image_url = String((req.body as { image_url?: unknown }).image_url || "").trim();
    if (!image_url) { res.status(400).json({ error: "image_url is required" }); return; }

    const { data: maxSort } = await db
      .from("website_gallery_items")
      .select("sort_order")
      .eq("website_id", website.id)
      .order("sort_order", { ascending: false })
      .limit(1) as { data: Array<{ sort_order: number }> | null };

    const nextSort = typeof maxSort?.[0]?.sort_order === "number" ? maxSort[0].sort_order + 1 : 0;

    const payload = {
      tenant_id: req.tenantId,
      website_id: website.id,
      image_url,
      caption: String((req.body as { caption?: unknown }).caption || "").trim() || null,
      alt_text: String((req.body as { alt_text?: unknown }).alt_text || "").trim() || null,
      category: String((req.body as { category?: unknown }).category || "").trim() || null,
      is_visible: (req.body as { is_visible?: unknown }).is_visible !== false,
      sort_order: typeof (req.body as { sort_order?: unknown }).sort_order === "number"
        ? Number((req.body as { sort_order?: unknown }).sort_order)
        : nextSort,
    };

    const { data, error } = await db
      .from("website_gallery_items")
      .insert(payload)
      .select("id, image_url, caption, alt_text, category, sort_order, is_visible, created_at")
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !data) { res.status(500).json({ error: "Failed to create gallery item" }); return; }
    res.status(201).json(data);
  }
);

router.patch(
  "/website/gallery-items/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const allowed = ["image_url", "caption", "alt_text", "category", "sort_order", "is_visible"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = (req.body as Record<string, unknown>)[key];
    }

    const { data, error } = await db
      .from("website_gallery_items")
      .update(updates)
      .eq("id", req.params.id)
      .eq("website_id", website.id)
      .select("id, image_url, caption, alt_text, category, sort_order, is_visible, created_at")
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !data) { res.status(404).json({ error: "Gallery item not found" }); return; }
    res.json(data);
  }
);

router.delete(
  "/website/gallery-items/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    await db
      .from("website_gallery_items")
      .delete()
      .eq("id", req.params.id)
      .eq("website_id", website.id);

    res.sendStatus(204);
  }
);

router.get(
  "/website/gallery-items/importable-job-images",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const limit = Math.min(120, Math.max(1, Number(req.query.limit || 60)));

    const { data: attachments, error } = await db
      .from("file_attachments")
      .select("id, entity_id, file_name, file_type, storage_path, description, created_at")
      .eq("tenant_id", req.tenantId)
      .eq("entity_type", "job")
      .ilike("file_type", "image/%")
      .order("created_at", { ascending: false })
      .limit(limit) as { data: Array<Record<string, unknown>> | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to fetch job images" }); return; }

    const rows = attachments || [];
    const jobIds = Array.from(new Set(rows.map((row) => String(row.entity_id || "")).filter(Boolean)));

    const { data: jobs } = jobIds.length > 0
      ? await db
          .from("jobs")
          .select("id, job_ref, description")
          .in("id", jobIds)
          .eq("tenant_id", req.tenantId) as { data: Array<{ id: string; job_ref: string | null; description: string | null }> | null }
      : { data: [] as Array<{ id: string; job_ref: string | null; description: string | null }> };

    const jobMap = new Map((jobs || []).map((job) => [job.id, job]));

    const withUrls = await Promise.all(rows.map(async (row) => {
      const bucket = bucketForAttachment({ file_type: row.file_type, storage_path: row.storage_path });
      const { data: urlData } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(String(row.storage_path || ""), 3600);
      const job = jobMap.get(String(row.entity_id || ""));
      return {
        id: row.id,
        file_name: row.file_name,
        signed_url: urlData?.signedUrl || null,
        created_at: row.created_at,
        description: row.description,
        job_id: row.entity_id,
        job_ref: job?.job_ref || null,
        job_description: job?.description || null,
      };
    }));

    res.json(withUrls.filter((row) => Boolean(row.signed_url)));
  }
);

router.post(
  "/website/gallery-items/import-from-jobs",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const attachmentIds = Array.isArray((req.body as { attachment_ids?: unknown }).attachment_ids)
      ? ((req.body as { attachment_ids?: unknown[] }).attachment_ids || []).map((id) => String(id)).filter(Boolean)
      : [];

    if (attachmentIds.length === 0) { res.status(400).json({ error: "attachment_ids is required" }); return; }
    if (attachmentIds.length > 30) { res.status(400).json({ error: "You can import up to 30 images at once" }); return; }

    const { data: rows, error } = await db
      .from("file_attachments")
      .select("id, file_name, file_type, storage_path, description")
      .in("id", attachmentIds)
      .eq("tenant_id", req.tenantId)
      .eq("entity_type", "job")
      .ilike("file_type", "image/%") as { data: Array<Record<string, unknown>> | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to load selected attachments" }); return; }
    if (!rows || rows.length === 0) { res.status(404).json({ error: "No matching job images found" }); return; }

    const { data: maxSort } = await db
      .from("website_gallery_items")
      .select("sort_order")
      .eq("website_id", website.id)
      .order("sort_order", { ascending: false })
      .limit(1) as { data: Array<{ sort_order: number }> | null };

    let nextSort = typeof maxSort?.[0]?.sort_order === "number" ? maxSort[0].sort_order + 1 : 0;
    const importedMediaRows: Array<Record<string, unknown>> = [];
    const importedGalleryRows: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const sourceBucket = bucketForAttachment({ file_type: row.file_type, storage_path: row.storage_path });
      const sourcePath = String(row.storage_path || "");

      const { data: downloaded, error: downloadError } = await supabaseAdmin.storage
        .from(sourceBucket)
        .download(sourcePath);

      if (downloadError || !downloaded) continue;

      const sourceBuffer = Buffer.from(await downloaded.arrayBuffer()) as Buffer<ArrayBufferLike>;

      let processedBuffer: Buffer<ArrayBufferLike> = sourceBuffer;
      let width: number | null = null;
      let height: number | null = null;
      try {
        const image = sharp(sourceBuffer).rotate();
        const meta = await image.metadata();
        const w = meta.width || 0;
        const h = meta.height || 0;
        let pipeline = image;
        if (w > MEDIA_MAX_DIMENSION || h > MEDIA_MAX_DIMENSION) {
          pipeline = pipeline.resize(MEDIA_MAX_DIMENSION, MEDIA_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
        }
        const webp = await pipeline.webp({ quality: MEDIA_JPEG_QUALITY }).toBuffer({ resolveWithObject: true });
        processedBuffer = webp.data;
        width = webp.info.width || null;
        height = webp.info.height || null;
      } catch {
        // keep original buffer
      }

      const safeBase = sanitizeFileName(String(row.file_name || "job_image"));
      const storagePath = `${req.tenantId}/${website.id}/import-${Date.now()}-${safeBase}.webp`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, processedBuffer, { contentType: "image/webp", upsert: false });

      if (uploadError) continue;

      const { data: publicUrlData } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
      const publicUrl = publicUrlData.publicUrl;
      const altText = String(row.description || row.file_name || "Imported job image").trim();

      importedMediaRows.push({
        tenant_id: req.tenantId,
        website_id: website.id,
        file_name: String(row.file_name || "job-image"),
        storage_path: storagePath,
        public_url: publicUrl,
        width,
        height,
        file_size: processedBuffer.length,
        mime_type: "image/webp",
        alt_text: altText,
      });

      importedGalleryRows.push({
        tenant_id: req.tenantId,
        website_id: website.id,
        image_url: publicUrl,
        caption: null,
        alt_text: altText,
        category: "Imported from jobs",
        sort_order: nextSort++,
        is_visible: true,
      });
    }

    if (importedMediaRows.length > 0) {
      await db.from("website_media").insert(importedMediaRows);
    }
    if (importedGalleryRows.length > 0) {
      await db.from("website_gallery_items").insert(importedGalleryRows);
    }

    res.json({ imported: importedGalleryRows.length });
  }
);

export default router;
