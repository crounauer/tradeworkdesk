/**
 * Superadmin Template Management Routes
 * 
 * API endpoints for managing imported templates:
 * - List all templates
 * - View template details
 * - View page details
 * - Publish/unpublish templates
 * 
 * Requires superadmin authentication
 */

import { Router, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Response types
type TemplateListItem = {
  id: string;
  slug: string;
  name: string;
  status: string;
  category?: string;
  version?: number;
  page_count: number;
  updated_at?: string;
};

type TemplateDetail = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: string;
  category?: string;
  version?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  theme?: Record<string, unknown>;
  cms_mapping?: Record<string, unknown>;
  template_json?: Record<string, unknown>;
};

type PageDetail = {
  id: string;
  slug: string;
  title: string;
  path: string;
  page_type: string;
  sort_order: number;
  seo?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  blocks: Array<{
    id: string;
    block_type: string;
    label?: string;
    sort_order: number;
    content?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  }>;
};

type BlockRegistry = {
  id: string;
  block_type: string;
  label?: string;
  category?: string;
  sort_order: number;
};

type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  details?: Record<string, unknown>;
};

/**
 * GET /api/superadmin/templates
 * List all templates with basic metadata
 */
router.get(
  "/api/superadmin/templates",
  requireSuperAdmin as any,
  async (req: AuthenticatedRequest, res: Response<ApiResponse<TemplateListItem[]>>) => {
    try {
      // Get templates with page count
      const { data: templates, error: templatesError } = await supabaseAdmin
        .from("website_templates")
        .select("id, slug, name, status, category, version, updated_at")
        .order("updated_at", { ascending: false });

      if (templatesError) {
        console.error("[superadmin-templates-mgmt] List templates failed:", templatesError);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch templates",
          details: { code: "FETCH_FAILED" },
        });
      }

      // Get page counts for each template
      const templatesWithCounts = await Promise.all(
        (templates || []).map(async (template) => {
          const { count, error } = await supabaseAdmin
            .from("website_template_pages")
            .select("id", { count: "exact", head: true })
            .eq("template_id", template.id);

          return {
            id: template.id,
            slug: template.slug,
            name: template.name,
            status: template.status,
            category: template.category,
            version: template.version,
            page_count: count || 0,
            updated_at: template.updated_at,
          };
        }),
      );

      return res.json({
        success: true,
        data: templatesWithCounts,
      });
    } catch (error) {
      console.error("[superadmin-templates-mgmt] List templates error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/superadmin/templates/:slug
 * Get template detail with pages and block registry
 */
router.get(
  "/api/superadmin/templates/:slug",
  requireSuperAdmin as any,
  async (req: AuthenticatedRequest, res: Response<ApiResponse<{
    template: TemplateDetail;
    pages: Array<{ id: string; slug: string; title: string; page_type: string; sort_order: number }>;
    blockRegistry?: BlockRegistry[];
  }>>) => {
    try {
      const { slug } = req.params;

      // Get template
      const { data: template, error: templateError } = await supabaseAdmin
        .from("website_templates")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (templateError) {
        console.error("[superadmin-templates-mgmt] Get template failed:", templateError);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch template",
          details: { code: "TEMPLATE_FETCH_FAILED" },
        });
      }

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
          details: { code: "NOT_FOUND" },
        });
      }

      // Get pages
      const { data: pages, error: pagesError } = await supabaseAdmin
        .from("website_template_pages")
        .select("id, slug, title, page_type, sort_order")
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (pagesError) {
        console.error("[superadmin-templates-mgmt] Get pages failed:", pagesError);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch template pages",
          details: { code: "PAGES_FETCH_FAILED" },
        });
      }

      // Get block registry (if exists)
      let blockRegistry: BlockRegistry[] = [];
      const { data: registry, error: registryError } = await supabaseAdmin
        .from("website_template_block_registry")
        .select("id, block_type, label, category, sort_order")
        .eq("template_id", template.id)
        .order("sort_order", { ascending: true });

      if (!registryError && registry) {
        blockRegistry = registry;
      }

      return res.json({
        success: true,
        data: {
          template: {
            id: template.id,
            slug: template.slug,
            name: template.name,
            description: template.description,
            status: template.status,
            category: template.category,
            version: template.version,
            is_active: template.is_active,
            created_at: template.created_at,
            updated_at: template.updated_at,
            theme: template.theme || template.theme_json,
            cms_mapping: template.cms_mapping || template.cms_mapping_json,
            template_json: template.template_json,
          },
          pages: pages || [],
          blockRegistry,
        },
      });
    } catch (error) {
      console.error("[superadmin-templates-mgmt] Get template error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/superadmin/templates/:slug/pages/:pageSlug
 * Get page detail with its blocks
 */
router.get(
  "/api/superadmin/templates/:slug/pages/:pageSlug",
  requireSuperAdmin as any,
  async (req: AuthenticatedRequest, res: Response<ApiResponse<PageDetail>>) => {
    try {
      const { slug, pageSlug } = req.params;

      // Get template first
      const { data: template, error: templateError } = await supabaseAdmin
        .from("website_templates")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (templateError || !template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
          details: { code: "TEMPLATE_NOT_FOUND" },
        });
      }

      // Get page
      const { data: page, error: pageError } = await supabaseAdmin
        .from("website_template_pages")
        .select("*")
        .eq("template_id", template.id)
        .eq("slug", pageSlug)
        .maybeSingle();

      if (pageError) {
        console.error("[superadmin-templates-mgmt] Get page failed:", pageError);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch page",
          details: { code: "PAGE_FETCH_FAILED" },
        });
      }

      if (!page) {
        return res.status(404).json({
          success: false,
          error: "Page not found",
          details: { code: "PAGE_NOT_FOUND" },
        });
      }

      // Get blocks for this page
      const { data: blocks, error: blocksError } = await supabaseAdmin
        .from("website_template_blocks")
        .select("id, block_type, label, sort_order, content, settings")
        .eq("page_id", page.id)
        .order("sort_order", { ascending: true });

      if (blocksError) {
        console.error("[superadmin-templates-mgmt] Get blocks failed:", blocksError);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch page blocks",
          details: { code: "BLOCKS_FETCH_FAILED" },
        });
      }

      return res.json({
        success: true,
        data: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          path: page.path,
          page_type: page.page_type,
          sort_order: page.sort_order,
          seo: page.seo,
          settings: page.settings,
          blocks: blocks || [],
        },
      });
    } catch (error) {
      console.error("[superadmin-templates-mgmt] Get page error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/superadmin/templates/:slug/publish
 * Publish a template (set status to 'live')
 */
router.post(
  "/api/superadmin/templates/:slug/publish",
  requireSuperAdmin as any,
  async (req: AuthenticatedRequest, res: Response<ApiResponse<{ status: string; updated_at: string }>>) => {
    try {
      const { slug } = req.params;

      // Get template
      const { data: template, error: templateError } = await supabaseAdmin
        .from("website_templates")
        .select("id, status")
        .eq("slug", slug)
        .maybeSingle();

      if (templateError || !template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
          details: { code: "TEMPLATE_NOT_FOUND" },
        });
      }

      if (template.status === "live") {
        return res.json({
          success: true,
          data: {
            status: "live",
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Update status to 'live'
      const { error: updateError } = await supabaseAdmin
        .from("website_templates")
        .update({
          status: "live",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (updateError) {
        console.error("[superadmin-templates-mgmt] Publish failed:", updateError);
        return res.status(500).json({
          success: false,
          error: "Failed to publish template",
          details: { code: "PUBLISH_FAILED" },
        });
      }

      return res.json({
        success: true,
        data: {
          status: "live",
          updated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[superadmin-templates-mgmt] Publish error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/superadmin/templates/:slug/unpublish
 * Unpublish a template (set status to 'draft')
 */
router.post(
  "/api/superadmin/templates/:slug/unpublish",
  requireSuperAdmin as any,
  async (req: AuthenticatedRequest, res: Response<ApiResponse<{ status: string; updated_at: string }>>) => {
    try {
      const { slug } = req.params;

      // Get template
      const { data: template, error: templateError } = await supabaseAdmin
        .from("website_templates")
        .select("id, status")
        .eq("slug", slug)
        .maybeSingle();

      if (templateError || !template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
          details: { code: "TEMPLATE_NOT_FOUND" },
        });
      }

      if (template.status === "draft") {
        return res.json({
          success: true,
          data: {
            status: "draft",
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Update status to 'draft'
      const { error: updateError } = await supabaseAdmin
        .from("website_templates")
        .update({
          status: "draft",
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (updateError) {
        console.error("[superadmin-templates-mgmt] Unpublish failed:", updateError);
        return res.status(500).json({
          success: false,
          error: "Failed to unpublish template",
          details: { code: "UNPUBLISH_FAILED" },
        });
      }

      return res.json({
        success: true,
        data: {
          status: "draft",
          updated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[superadmin-templates-mgmt] Unpublish error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
