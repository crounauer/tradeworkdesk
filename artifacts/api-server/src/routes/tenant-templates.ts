/**
 * Tenant Template Routes
 * 
 * Endpoints for tenants to view active templates and apply them to websites
 */

import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { applyTemplateToWebsite, getActiveTemplates } from "../lib/template-phase-3";

const router = Router();

/**
 * GET /api/templates
 * Get all active templates available for selection
 */
router.get("/templates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await getActiveTemplates(supabaseAdmin);

    return res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error("[GET /templates] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch templates",
    });
  }
});

/**
 * POST /api/websites/:websiteId/apply-template
 * Apply a template to a website
 * 
 * Body: { templateId: string }
 * Returns: { success, pages_created, blocks_created }
 */
router.post(
  "/websites/:websiteId/apply-template",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { websiteId } = req.params;
      const { templateId } = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: "templateId is required",
        });
      }

      // Get user's tenant ID from JWT
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("id", req.userId)
        .single();

      if (profileError || !profile) {
        return res.status(401).json({
          success: false,
          error: "User profile not found",
        });
      }

      // Apply template
      const result = await applyTemplateToWebsite(supabaseAdmin, {
        websiteId,
        templateId,
        tenantId: profile.tenant_id,
        userId: req.userId,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || "Failed to apply template",
        });
      }

      console.log(
        `[POST /websites/:websiteId/apply-template] Applied template to website: ${result.pages_created} pages, ${result.blocks_created} blocks`
      );

      return res.json({
        success: true,
        website_id: result.website_id,
        pages_created: result.pages_created,
        blocks_created: result.blocks_created,
        message: `Template applied successfully: ${result.pages_created} pages and ${result.blocks_created} blocks created`,
      });
    } catch (error) {
      console.error("[POST /websites/:websiteId/apply-template] Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to apply template",
      });
    }
  }
);

/**
 * GET /api/websites/:websiteId/pages
 * Get all pages for a website
 */
router.get("/websites/:websiteId/pages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { websiteId } = req.params;

    // Verify ownership
    const { data: website, error: websiteError } = await supabaseAdmin
      .from("websites")
      .select("tenant_id")
      .eq("id", websiteId)
      .single();

    if (websiteError || !website) {
      return res.status(404).json({
        success: false,
        error: "Website not found",
      });
    }

    // Get user's tenant
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", req.userId)
      .single();

    if (profileError || profile?.tenant_id !== website.tenant_id) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Fetch pages with blocks
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("site_pages")
      .select(
        `
        id,
        slug,
        page_type,
        title,
        status,
        show_in_nav,
        nav_label,
        nav_order,
        site_blocks (
          id,
          block_type,
          content,
          sort_order
        )
      `
      )
      .eq("website_id", websiteId)
      .order("nav_order", { ascending: true });

    if (pagesError) {
      throw new Error(pagesError.message);
    }

    return res.json({
      success: true,
      pages: pages || [],
      count: (pages || []).length,
    });
  } catch (error) {
    console.error("[GET /websites/:websiteId/pages] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch pages",
    });
  }
});

export default router;
