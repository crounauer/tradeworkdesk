/**
 * Phase 3: Template Application to Websites
 * 
 * Allows tenants to select active templates and apply them to their websites
 * Generates site_pages and site_blocks from template configuration
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";

export interface ApplyTemplateParams {
  websiteId: string;
  templateId: string;
  tenantId: string;
  userId: string;
}

export interface ApplyTemplateResult {
  success: boolean;
  website_id: string;
  pages_created: number;
  blocks_created: number;
  error?: string;
}

/**
 * Apply a template to a website
 * Generates site_pages and site_blocks from template configuration
 */
export async function applyTemplateToWebsite(
  supabase: SupabaseClient,
  params: ApplyTemplateParams,
): Promise<ApplyTemplateResult> {
  const { websiteId, templateId, tenantId, userId } = params;

  try {
    // 1. Fetch template
    const { data: template, error: templateError } = await supabase
      .from("website_templates")
      .select("*")
      .eq("id", templateId)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      throw new Error("Template not found or not active");
    }

    // 2. Fetch website (verify ownership)
    const { data: website, error: websiteError } = await supabase
      .from("websites")
      .select("tenant_id")
      .eq("id", websiteId)
      .single();

    if (websiteError || !website) {
      throw new Error("Website not found");
    }

    if (website.tenant_id !== tenantId) {
      throw new Error("Unauthorized: website does not belong to tenant");
    }

    // 3. Fetch block mapping from template conversion
    // For now, we'll use hardcoded page/block map (stored during Phase 2)
    // In future, fetch from template.demo_pages or stored mapping
    const pageBlockMap = getDefaultPageBlockMap();

    // 4. Delete existing pages and blocks (if any)
    await supabase.from("site_blocks").delete().eq("website_id", websiteId);
    await supabase.from("site_pages").delete().eq("website_id", websiteId);

    // 5. Create pages and blocks
    let pagesCreated = 0;
    let blocksCreated = 0;
    const designTokens = template.design_tokens || {};

    for (const [pageSlug, blockTypes] of Object.entries(pageBlockMap)) {
      const pageId = uuid();

      // Create page
      const { error: pageError } = await supabase.from("site_pages").insert({
        id: pageId,
        website_id: websiteId,
        template_id: templateId,
        slug: pageSlug,
        page_type: pageSlug === "404" ? "404" : pageSlug,
        title: formatPageTitle(pageSlug),
        status: "published",
        show_in_nav: pageSlug !== "404",
        nav_label: formatPageTitle(pageSlug),
        nav_order: Object.keys(pageBlockMap).indexOf(pageSlug),
      });

      if (pageError) {
        throw new Error(`Failed to create page '${pageSlug}': ${pageError.message}`);
      }
      pagesCreated++;

      // Create blocks for this page
      const blockTypesArray = Array.isArray(blockTypes) ? blockTypes : [];
      for (let i = 0; i < blockTypesArray.length; i++) {
        const blockType = blockTypesArray[i];
        if (!blockType) continue;

        const blockContent = {
          layout: getDefaultLayout(blockType),
          // Apply design tokens
          accent_color: designTokens?.colors?.accent || "#f97316",
          primary_color: designTokens?.colors?.primary || "#000000",
          background_color: designTokens?.colors?.background || "#ffffff",
          text_color: designTokens?.colors?.text || "#1f2937",
          heading_font_family:
            designTokens?.typography?.headingFont || "system-ui, -apple-system, sans-serif",
          body_font_family:
            designTokens?.typography?.bodyFont || "system-ui, -apple-system, sans-serif",
          button_font_family:
            designTokens?.typography?.buttonFont || "system-ui, -apple-system, sans-serif",
        };

        const { error: blockError } = await supabase.from("site_blocks").insert({
          id: uuid(),
          page_id: pageId,
          website_id: websiteId,
          block_type: blockType,
          content: blockContent,
          sort_order: i,
          hidden: false,
        });

        if (blockError) {
          throw new Error(`Failed to create block '${blockType}': ${blockError.message}`);
        }
        blocksCreated++;
      }
    }

    // 6. Update website to reference template
    await supabase
      .from("websites")
      .update({
        template_id: templateId,
        template_slug: template.slug,
      })
      .eq("id", websiteId);

    console.log(`[applyTemplateToWebsite] Applied template '${template.slug}' to website '${websiteId}': ${pagesCreated} pages, ${blocksCreated} blocks`);

    return {
      success: true,
      website_id: websiteId,
      pages_created: pagesCreated,
      blocks_created: blocksCreated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[applyTemplateToWebsite] Error:", errorMessage);

    return {
      success: false,
      website_id: websiteId,
      pages_created: 0,
      blocks_created: 0,
      error: errorMessage,
    };
  }
}

/**
 * Get active templates for tenant selection
 */
export async function getActiveTemplates(supabase: SupabaseClient): Promise<any[]> {
  const { data, error } = await supabase
    .from("website_templates")
    .select("id, name, slug, description, category, design_tokens")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getActiveTemplates] Error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Default page → block type mapping (matches generateBlockMapping in Phase 1)
 */
function getDefaultPageBlockMap(): Record<string, string[]> {
  return {
    home: [
      "site.header",
      "hero.standard",
      "trust.badges",
      "features.list",
      "spacer",
      "testimonials",
      "services.grid",
      "process.steps",
      "amazon",
      "cta.banner",
      "site.footer",
    ],
    services: [
      "site.header",
      "hero.standard",
      "services.grid",
      "why.choose.us",
      "faq.accordion",
      "cta.banner",
      "site.footer",
    ],
    "service-detail": [
      "site.header",
      "hero.standard",
      "features.list",
      "process.steps",
      "cta.banner",
      "site.footer",
    ],
    emergency: [
      "site.header",
      "hero.standard",
      "process.steps",
      "cta.banner",
      "site.footer",
    ],
    areas: [
      "site.header",
      "hero.standard",
      "areas.grid",
      "contact.split",
      "site.footer",
    ],
    reviews: [
      "site.header",
      "hero.standard",
      "reviews.grid",
      "testimonials",
      "brands",
      "cta.banner",
      "site.footer",
    ],
    gallery: [
      "site.header",
      "hero.standard",
      "gallery.grid",
      "project.showcase",
      "spacer",
      "site.footer",
    ],
    "blog-index": [
      "site.header",
      "hero.standard",
      "blog.index",
      "cta.banner",
      "site.footer",
    ],
    "blog-post": [
      "site.header",
      "hero.standard",
      "legal.content",
      "cta.banner",
      "site.footer",
    ],
    booking: [
      "site.header",
      "hero.standard",
      "online.booking",
      "cta.banner",
      "sticky.mobile.cta",
      "site.footer",
    ],
    contact: [
      "site.header",
      "hero.standard",
      "contact.split",
      "accreditations",
      "site.footer",
    ],
    legal: [
      "site.header",
      "legal.content",
      "faq.accordion",
      "site.footer",
    ],
    "404": [
      "site.header",
      "system.notFound",
      "cta.banner",
      "site.footer",
    ],
  };
}

/**
 * Get default layout for block type
 */
function getDefaultLayout(blockType: string): string {
  const layoutMap: Record<string, string> = {
    hero: "standard",
    hero_split: "standard",
    services: "grid",
    services_grid: "grid",
    process: "timeline",
    testimonials: "grid",
    reviews: "grid",
    faq: "accordion",
    features_bar: "horizontal",
    contact_form: "full-width",
    areas: "card-grid",
    gallery: "grid",
    blog_index: "list",
    brands: "logo-grid",
    why_choose_us: "icons",
    accreditations: "badges",
    project_showcase: "grid",
    online_booking: "centered-card",
    sticky_mobile_cta: "bottom-bar",
  };

  return layoutMap[blockType] || "standard";
}

/**
 * Format page slug to title
 */
function formatPageTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
