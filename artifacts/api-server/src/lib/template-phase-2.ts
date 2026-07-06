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
    "process.steps": 7,
    "amazon": 8,
    "cta.banner": 9,
    "site.footer": 10,
  },
  services: {
    "site.header": 0,
    "hero.standard": 1,
    "services.grid": 2,
    "why.choose.us": 3,
    "faq.accordion": 4,
    "cta.banner": 5,
    "site.footer": 6,
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

    // 2. Generate pages and blocks structure first (for demo_pages)
    const pages = blockMappingReport.pages || {};
    const generatedPages: GeneratedPage[] = [];
    const demoPagesData: Array<{
      slug: string;
      title: string;
      block_count: number;
      block_types: string[];
    }> = [];
    let blockCount = 0;
    const pageBlocksMap: Record<string, GeneratedBlock[]> = {};

    // Process each page
    for (const [pageSlug, blockTypes] of Object.entries(pages)) {
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
        nav_order: Object.keys(pages).indexOf(pageSlug),
      });

      // Generate blocks for this page
      const generatedBlocks: GeneratedBlock[] = [];
      const blockTypesArray = Array.isArray(blockTypes) ? blockTypes : [];
      const pageBlockTypes: string[] = [];

      for (let i = 0; i < blockTypesArray.length; i++) {
        const blockType = blockTypesArray[i];
        if (!blockType) continue;

        const blockId = uuid();
        const blockContent = applyDesignTokens(blockType, {}, designTokens);

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

    // 3. Create website_templates record with demo_pages
    const templateId = uuid();
    const { error: templateError } = await supabase
      .from("website_templates")
      .insert({
        id: templateId,
        name: conversion.template_name,
        slug: templateSlug,
        description: conversion.template_description,
        category: "imported",
        version: 1,
        design_tokens: designTokens,
        demo_pages: demoPagesData,
        figma_export_info: {
          figma_url: conversion.figma_url,
          imported_at: new Date().toISOString(),
          block_count: blockMappingReport.blockCount || 0,
        },
        is_active: true,
        is_featured: false,
        created_by: userId,
      });

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
