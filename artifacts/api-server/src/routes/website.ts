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

    res.json({ ...website, domains: domains || [] });
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
