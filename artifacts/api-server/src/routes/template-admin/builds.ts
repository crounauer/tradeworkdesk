/**
 * Template Build & Preview API
 * POST /api/admin/template-builds/:slug - Start a template build
 * GET /api/admin/template-builds/:slug/status - Get build status
 * GET /api/preview/templates/:slug/ - View template preview
 */

import { Router, Request, Response } from "express";
import { supabaseAdmin as supabase } from "../../lib/supabase";
import { requireAuth, requireRole } from "../../middlewares/auth";

const router = Router();

// In-memory build status tracking (in production, use Redis or DB)
const buildStatus = new Map<string, { status: 'idle' | 'building' | 'success' | 'failed'; error?: string; previewUrl?: string; timestamp: number }>();
type BuildState = { status: 'idle' | 'building' | 'success' | 'failed'; error?: string; previewUrl?: string; timestamp?: number };

/**
 * POST /api/admin/template-builds/:slug
 * Trigger a template preview build
 */
router.post(
  "/:slug",
  requireAuth,
  requireRole("super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params.slug || "");

    try {
      // Check template exists
      const { data: template, error: templateError } = await supabase
        .from("website_templates")
        .select("id, name, design_tokens, figma_export_info")
        .eq("slug", slug)
        .single();

      if (templateError || !template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      // Mark as building
      buildStatus.set(slug, { status: 'building', timestamp: Date.now() });

      // Simulate build process (in production, this would trigger actual rendering)
      // For MVP, just generate a success status after a short delay
      setTimeout(() => {
        const previewHtml = generatePreviewHtml(template.name, template.design_tokens);
        const previewUrl = `/api/preview/templates/${slug}/index.html`;

        buildStatus.set(slug, {
          status: 'success',
          previewUrl,
          timestamp: Date.now(),
        });

        console.log(`[template-build] Build succeeded for template: ${template.name}`);
      }, 1000);

      res.json({ status: 'building', message: 'Build started' });
    } catch (error) {
      console.error("[template-build] Error:", error);
      buildStatus.set(slug, {
        status: 'failed',
        error: 'Build failed',
        timestamp: Date.now(),
      });
      res.status(500).json({ error: "Failed to start build" });
    }
  }
);

/**
 * GET /api/admin/template-builds/:slug/status
 * Check build status
 */
router.get(
  "/:slug/status",
  requireAuth,
  requireRole("super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params.slug || "");

    try {
      const status: BuildState = buildStatus.get(slug) || { status: 'idle' };

      // Treat as idle if older than 5 minutes
      if (typeof status.timestamp === "number" && Date.now() - status.timestamp > 5 * 60 * 1000) {
        buildStatus.delete(slug);
        res.json({ status: 'idle' });
        return;
      }

      res.json(status);
    } catch (error) {
      console.error("[template-build-status] Error:", error);
      res.status(500).json({ error: "Failed to fetch build status" });
    }
  }
);

/**
 * Generate a simple preview HTML for a template
 */
function generatePreviewHtml(templateName: string, designTokens?: Record<string, unknown>): string {
  const cssVars = designTokens
    ? Object.entries(designTokens)
        .map(([key, value]) => `  --${key}: ${value};`)
        .join('\n')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${templateName} - Template Preview</title>
  <style>
    :root {
${cssVars}
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: var(--background, #ffffff);
      color: var(--foreground, #000000);
      padding: 2rem;
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 {
      margin-bottom: 1rem;
      color: var(--primary, #000000);
    }
    
    .preview-info {
      background-color: var(--card, #f5f5f5);
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
    
    .preview-info p {
      margin-bottom: 0.5rem;
      opacity: 0.8;
    }
    
    .design-tokens {
      background-color: var(--card, #f5f5f5);
      border-radius: 8px;
      padding: 1.5rem;
      margin-top: 2rem;
    }
    
    .design-tokens h2 {
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }
    
    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    
    .color-sample {
      border-radius: 4px;
      height: 60px;
      border: 1px solid var(--border, #e0e0e0);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${templateName} Template</h1>
    
    <div class="preview-info">
      <p><strong>Template Name:</strong> ${templateName}</p>
      <p><strong>Status:</strong> Preview Ready</p>
      <p>This is a preview of your template. Customize your design tokens and rebuild to update this preview.</p>
    </div>
    
    <div class="design-tokens">
      <h2>Design Tokens Preview</h2>
      <p>The template includes the following design system colors:</p>
      <div class="color-grid">
        <div class="color-sample" style="background-color: var(--primary, #3b82f6);"></div>
        <div class="color-sample" style="background-color: var(--secondary, #8b5cf6);"></div>
        <div class="color-sample" style="background-color: var(--background, #ffffff);"></div>
        <div class="color-sample" style="background-color: var(--foreground, #000000);"></div>
        <div class="color-sample" style="background-color: var(--card, #f5f5f5);"></div>
        <div class="color-sample" style="background-color: var(--border, #e0e0e0);"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default router;
