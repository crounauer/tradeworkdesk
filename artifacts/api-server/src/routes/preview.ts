/**
 * Template Preview API
 * GET /api/preview/templates/:slug/ - Get template preview HTML
 */

import { Router, Request, Response } from "express";
import { supabaseAdmin as supabase } from "../lib/supabase";

const router = Router();

// Store preview HTML in memory (in production, use Redis or DB)
const previewCache = new Map<string, { html: string; timestamp: number }>();

/**
 * GET /api/preview/templates/:slug/
 * Serve template preview HTML
 */
router.get("/:slug/", async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug || "");

  try {
    // Check cache first
    const cached = previewCache.get(slug);
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      // Cache for 30 minutes
      res.type("text/html").send(cached.html);
      return;
    }

    // Fetch template
    const { data: template, error } = await supabase
      .from("website_templates")
      .select("name, design_tokens")
      .eq("slug", slug)
      .single();

    if (error || !template) {
      res.status(404).send("<h1>Template not found</h1>");
      return;
    }

    // Generate preview HTML
    const html = generatePreviewHtml(template.name, template.design_tokens);

    // Cache it
    previewCache.set(slug, { html, timestamp: Date.now() });

    res.type("text/html").send(html);
  } catch (error) {
    console.error("[preview] Error:", error);
    res.status(500).send("<h1>Error loading preview</h1>");
  }
});

/**
 * Generate a simple preview HTML for a template
 */
function generatePreviewHtml(
  templateName: string,
  designTokens?: Record<string, string>
): string {
  const cssVars = designTokens
    ? Object.entries(designTokens)
        .map(([key, value]) => `  --${key}: ${value};`)
        .join("\n")
    : "";

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
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      color: var(--muted-foreground, #999);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${templateName} Template</h1>
    
    <div class="preview-info">
      <p><strong>Template Name:</strong> ${templateName}</p>
      <p><strong>Status:</strong> Preview Ready</p>
      <p>This is a preview of your template. The template includes design tokens and can be applied to new websites.</p>
    </div>
    
    <div class="design-tokens">
      <h2>Design Tokens Preview</h2>
      <p>The template includes the following design system colors:</p>
      <div class="color-grid">
        <div class="color-sample" style="background-color: var(--primary, #3b82f6);">Primary</div>
        <div class="color-sample" style="background-color: var(--secondary, #8b5cf6);">Secondary</div>
        <div class="color-sample" style="background-color: var(--background, #ffffff);">Background</div>
        <div class="color-sample" style="background-color: var(--foreground, #000000);">Foreground</div>
        <div class="color-sample" style="background-color: var(--card, #f5f5f5);">Card</div>
        <div class="color-sample" style="background-color: var(--border, #e0e0e0);">Border</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default router;
