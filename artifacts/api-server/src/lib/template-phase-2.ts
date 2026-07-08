/**
 * Phase 2: Template Instance Generation
 * 
 * Converts approved template conversions into fully functional template instances
 * with site pages, blocks, and applied design tokens.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";

export interface BlockContent {
  layout?: string;
  [key: string]: any;
}

export interface GeneratedPage {
  id: string;
  slug: string;
  page_type: string;
  title: string;
  status: "published" | "draft";
  show_in_nav: boolean;
  nav_label: string | null;
  nav_order: number;
}

export interface GeneratedBlock {
  id: string;
  block_type: string;
  content: BlockContent;
  sort_order: number;
}

export interface TemplateInstance {
  template_id: string;
  pages: GeneratedPage[];
  block_count: number;
  success: boolean;
  error?: string;
}

/**
 * Default layout variations for each block type
 */
const DEFAULT_LAYOUTS: Record<string, string> = {
  hero: "standard",
  hero_split: "standard",
  services: "grid",
  services_grid: "grid",
  "services.rates": "cards",
  services_rates: "cards",
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

/**
 * Map block types to each page (default block distribution)
 */
const DEFAULT_PAGE_BLOCKS: Record<string, string[]> = {
  home: [
    "site.header",
    "hero.standard",
    "trust.badges",
    "features.list",
    "spacer",
    "testimonials",
    "services.grid",
    "services.rates",
    "process.steps",
    "amazon",
    "cta.banner",
    "site.footer",
  ],
  services: [
    "site.header",
    "hero.standard",
    "services.grid",
    "services.rates",
    "why.choose.us",
    "faq.accordion",
    "cta.banner",
    "site.footer",
  ],
  "service-detail": [
    "site.header",
    "hero.standard",
    "features.list",
    "services.rates",
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
    "hero.standard",
    "legal.content",
    "faq.accordion",
    "site.footer",
  ],
  "404": [
    "site.header",
    "hero.standard",
    "system.notFound",
    "cta.banner",
    "site.footer",
  ],
};

/**
 * Map block types to default page placement and order
 */
const BLOCK_PAGE_MAP: Record<string, Record<string, number>> = {
  home: {
    "site.header": 0,
    "hero.standard": 1,
    "trust.badges": 2,
    "features.list": 3,
    "spacer": 4,
    "testimonials": 5,
    "services.grid": 6,
    "services.rates": 7,
    "process.steps": 8,
    "amazon": 9,
    "cta.banner": 10,
    "site.footer": 11,
  },
  services: {
    "site.header": 0,
    "hero.standard": 1,
    "services.grid": 2,
    "services.rates": 3,
    "why.choose.us": 4,
    "faq.accordion": 5,
    "cta.banner": 6,
    "site.footer": 7,
  },
  // ... other pages
};

/**
 * Apply design tokens to block content
 */
function applyDesignTokens(
  blockType: string,
  content: BlockContent,
  designTokens: Record<string, any>,
): BlockContent {
  const defaultLayout = DEFAULT_LAYOUTS[blockType] || "standard";
  
  return {
    layout: content.layout || defaultLayout,
    // Apply color tokens
    accent_color: content.accent_color || designTokens?.colors?.accent || "#f97316",
    primary_color: content.primary_color || designTokens?.colors?.primary || "#000000",
    background_color: content.background_color || designTokens?.colors?.background || "#ffffff",
    text_color: content.text_color || designTokens?.colors?.text || "#1f2937",
    // Apply typography tokens
    heading_font_family: content.heading_font_family || designTokens?.typography?.headingFont || "system-ui, -apple-system, sans-serif",
    body_font_family: content.body_font_family || designTokens?.typography?.bodyFont || "system-ui, -apple-system, sans-serif",
    button_font_family: content.button_font_family || designTokens?.typography?.buttonFont || "system-ui, -apple-system, sans-serif",
    // Preserve block-specific content
    ...content,
  };
}

/**
 * Generate default site pages and blocks from template conversion
 */
export async function generateTemplateInstance(
  supabase: SupabaseClient,
  conversionId: string,
  templateSlug: string,
  userId: string,
): Promise<TemplateInstance> {
  try {
    // 1. Fetch conversion record
    const { data: conversion, error: conversionError } = await supabase
      .from("template_conversions")
      .select("*")
      .eq("id", conversionId)
      .single();

    if (conversionError || !conversion) {
      throw new Error(`Conversion not found: ${conversionId}`);
    }

    const blockMappingReport = conversion.block_mapping_report || {};
    const designTokens = conversion.design_tokens || {};

    // Real block props extracted from the Figma design (Phase 1). Prefer the
    // precomputed map; fall back to rebuilding it from the stored content.
    let blockProps: Record<string, Record<string, unknown>> =
      blockMappingReport.blockProps && typeof blockMappingReport.blockProps === "object"
        ? (blockMappingReport.blockProps as Record<string, Record<string, unknown>>)
        : {};
    let pageBlockProps: Record<string, Record<string, Record<string, unknown>>> =
      blockMappingReport.pageBlockProps && typeof blockMappingReport.pageBlockProps === "object"
        ? (blockMappingReport.pageBlockProps as Record<string, Record<string, Record<string, unknown>>>)
        : {};
    if (Object.keys(blockProps).length === 0 && blockMappingReport.content) {
      try {
        const { buildBlockPropsMap, buildPageBlockPropsMap } = await import("./figma-content-mapping");
        const allTypes = Array.from(
          new Set(Object.values(DEFAULT_PAGE_BLOCKS).flat()),
        );
        blockProps = buildBlockPropsMap(blockMappingReport.content, allTypes);
        pageBlockProps = buildPageBlockPropsMap(blockMappingReport.content, DEFAULT_PAGE_BLOCKS);
      } catch (err) {
        console.warn("[generateTemplateInstance] Could not rebuild block props:", err);
      }
    }

    // 2. Generate pages and blocks structure first (for demo_pages)
    // Use DEFAULT_PAGE_BLOCKS since blockMappingReport.pages is just an array of page names
    const generatedPages: GeneratedPage[] = [];
    const demoPagesData: Array<{
      slug: string;
      title: string;
      block_count: number;
      block_types: string[];
    }> = [];
    let blockCount = 0;
    const pageBlocksMap: Record<string, GeneratedBlock[]> = {};

    // Process each page using the default block mapping
    for (const [pageSlug, blockTypes] of Object.entries(DEFAULT_PAGE_BLOCKS)) {
      const pageId = uuid();
      const pageType = pageSlug === "404" ? "404" : pageSlug;

      // Create page record
      generatedPages.push({
        id: pageId,
        slug: pageSlug,
        page_type: pageType,
        title: pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1),
        status: "published",
        show_in_nav: !pageSlug.startsWith("404"),
        nav_label: pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1),
        nav_order: Object.keys(DEFAULT_PAGE_BLOCKS).indexOf(pageSlug),
      });

      // Generate blocks for this page
      const generatedBlocks: GeneratedBlock[] = [];
      const pageBlockTypes: string[] = [];

      for (let i = 0; i < blockTypes.length; i++) {
        const blockType = blockTypes[i];
        if (!blockType) continue;

        const blockId = uuid();
        const props = pageBlockProps?.[pageSlug]?.[blockType] || blockProps[blockType];
        const blockContent = applyDesignTokens(blockType, props ? { props } : {}, designTokens);

        generatedBlocks.push({
          id: blockId,
          block_type: blockType,
          content: blockContent,
          sort_order: i,
        });

        blockCount++;
        pageBlockTypes.push(blockType);
      }

      // Add to demo pages (for admin preview)
      demoPagesData.push({
        slug: pageSlug,
        title: generatedPages[generatedPages.length - 1].title,
        block_count: pageBlockTypes.length,
        block_types: pageBlockTypes,
      });

      pageBlocksMap[pageId] = generatedBlocks;
    }

    const cmsMappingJson = {
      pages: Array.isArray(blockMappingReport.pages)
        ? blockMappingReport.pages
        : Object.keys(DEFAULT_PAGE_BLOCKS),
      blocksPerPage:
        blockMappingReport.blocksPerPage && typeof blockMappingReport.blocksPerPage === "object"
          ? blockMappingReport.blocksPerPage
          : Object.fromEntries(demoPagesData.map((p) => [p.slug, p.block_count])),
      blockTypes: Array.isArray(blockMappingReport.blockTypes)
        ? blockMappingReport.blockTypes
        : Array.from(new Set(demoPagesData.flatMap((p) => p.block_types))),
      blockProps,
      pageBlockProps,
    };
    // 3. Create website_templates record with demo_pages.
    // Some Supabase projects can briefly report schema-cache misses right after migrations.
    const templateId = uuid();
    const baseTemplatePayload = {
      id: templateId,
      name: conversion.template_name,
      slug: templateSlug,
      description: conversion.template_description,
      category: "imported",
      version: 1,
      theme_json: designTokens,
      cms_mapping_json: cmsMappingJson,
      default_theme: designTokens,
      design_tokens: designTokens,
      figma_export_info: {
        figma_url: conversion.figma_url,
        imported_at: new Date().toISOString(),
        block_count: blockMappingReport.blockCount || 0,
      },
      is_active: true,
      is_featured: false,
      created_by: userId,
    };

    const { error: firstInsertError } = await supabase
      .from("website_templates")
      .insert({
        ...baseTemplatePayload,
        demo_pages: demoPagesData,
      });

    const isDemoPagesSchemaCacheError =
      firstInsertError?.message?.includes("Could not find the 'demo_pages' column") ||
      firstInsertError?.message?.includes("schema cache");

    let templateError = firstInsertError;
    if (templateError && isDemoPagesSchemaCacheError) {
      console.warn(
        "[generateTemplateInstance] demo_pages unavailable in schema cache; retrying insert without demo_pages"
      );
      const { error: retryInsertError } = await supabase
        .from("website_templates")
        .insert(baseTemplatePayload);
      templateError = retryInsertError;
    }

    if (templateError) {
      const errorMsg = `Failed to create template: ${templateError.message}. 
      If you see "relation does not exist", migrations patch-070 and patch-071 need to be deployed to Supabase.
      See: supabase/patch-070-template-conversions.sql and supabase/patch-071-site-pages-and-blocks.sql`;
      throw new Error(errorMsg);
    }

    // 4. Note: Pages and blocks are NOT inserted here
    // They will be inserted when a website applies this template
    // This keeps the template conversion fast and the template reusable
    const { error: updateError } = await supabase
      .from("template_conversions")
      .update({
        status: "approved",
        processed_at: new Date().toISOString(),
        converted_package_url: `https://templates.tradeworkdesk.com/${templateSlug}`,
      })
      .eq("id", conversionId);

    if (updateError) {
      throw new Error(`Failed to update conversion: ${updateError.message}`);
    }

    return {
      template_id: templateId,
      pages: generatedPages,
      block_count: blockCount,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generateTemplateInstance] Error:", errorMessage);

    // Update conversion with error
    try {
      await supabase
        .from("template_conversions")
        .update({
          status: "failed",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversionId);
    } catch {
      // Silently fail if we can't update conversion
    }

    return {
      template_id: "",
      pages: [],
      block_count: 0,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Apply template to a website (instantiate pages and blocks)
 */
export async function applyTemplateToWebsite(
  supabase: SupabaseClient,
  websiteId: string,
  templateId: string,
): Promise<{ success: boolean; pageCount: number; blockCount: number; error?: string }> {
  try {
    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from("website_templates")
      .select("design_tokens, demo_pages")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      throw new Error("Template not found");
    }

    // TODO: Generate pages and blocks for this website from template
    // This is part of Phase 3 (applying templates to websites)

    return {
      success: true,
      pageCount: (template.demo_pages || []).length,
      blockCount: 0, // Will be calculated after block generation
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      pageCount: 0,
      blockCount: 0,
      error: errorMessage,
    };
  }
}
