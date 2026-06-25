// Utility to create default pages and blocks from a template
import { SupabaseClient } from "@supabase/supabase-js";

interface TemplatePageBlock {
  type: string;
  sort_order: number;
}

interface TemplatePage {
  slug: string;
  title: string;
  page_type: string;
  show_in_nav?: boolean;
  nav_order?: number;
  blocks?: TemplatePageBlock[];
}

interface Template {
  id: string;
  default_pages?: TemplatePage[];
}

/**
 * Create default pages and blocks for a website based on its template
 */
export async function createTemplatePages(
  db: SupabaseClient,
  websiteId: string,
  tenantId: string,
  template: Template
): Promise<void> {
  if (!template.default_pages || template.default_pages.length === 0) {
    console.log("[template-pages] No default pages in template, skipping");
    return;
  }

  try {
    // Create each page and its blocks
    for (const pageConfig of template.default_pages) {
      const blocks = pageConfig.blocks || [];
      delete (pageConfig as any).blocks; // Remove blocks from page config
      const normalizedPageType = pageConfig.page_type === "home" ? "home" : "custom";

      // Create the page
      const { data: page, error: pageError } = await db
        .from("website_pages")
        .insert({
          website_id: websiteId,
          tenant_id: tenantId,
          slug: pageConfig.slug,
          title: pageConfig.title,
          page_type: normalizedPageType,
          show_in_nav: pageConfig.show_in_nav || false,
          nav_label: pageConfig.title,
          nav_order: pageConfig.nav_order ?? 999,
          status: "draft",
        })
        .select()
        .single();

      if (pageError) {
        console.error(`[template-pages] Failed to create page ${pageConfig.slug}:`, pageError);
        continue;
      }

      // Create blocks for this page
      if (page && blocks.length > 0) {
        const blockRecords = blocks.map((block) => ({
          page_id: page.id,
          tenant_id: tenantId,
          block_type: block.type,
          sort_order: block.sort_order,
          is_visible: true,
          content: getDefaultBlockContent(block.type, pageConfig.page_type),
        }));

        const { error: blockError } = await db
          .from("website_blocks")
          .insert(blockRecords);

        if (blockError) {
          console.error(`[template-pages] Failed to create blocks for page ${pageConfig.slug}:`, blockError);
        }
      }
    }

    console.log(`[template-pages] Created ${template.default_pages.length} default pages with blocks`);
  } catch (error) {
    console.error("[template-pages] Error creating template pages:", error);
    throw error;
  }
}

/**
 * Get default content for a block based on its type
 */
function getDefaultBlockContent(blockType: string, pageType?: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    hero: {
      heading: "Welcome to Our Business",
      subheading: "Professional services you can trust",
      cta_text: "Get Started",
      cta_url: "/contact",
    },
    features: {
      heading: "Why Choose Us",
      items: [
        { title: "Professional", description: "Certified experts" },
        { title: "Reliable", description: "On-time service" },
        { title: "Quality", description: "Guaranteed results" },
      ],
    },
    services_grid: {
      heading: "Our Services",
      items: [
        { title: "Service 1", description: "Description here" },
        { title: "Service 2", description: "Description here" },
        { title: "Service 3", description: "Description here" },
      ],
    },
    testimonials: {
      heading: "What Our Clients Say",
      items: [
        { author: "Client Name", review: "Great service!", rating: 5 },
        { author: "Another Client", review: "Highly recommended", rating: 5 },
      ],
    },
    trust_badges: {
      items: ["Gas Safe Registered", "Insured", "Certified"],
    },
    cta: {
      heading: "Ready to Get Started?",
      button_text: "Contact Us",
      button_url: "/contact",
    },
    gallery: {
      heading: "Our Work",
      items: [],
    },
    contact_form: {
      heading: "Get in Touch",
      fields: ["name", "email", "phone", "message"],
    },
    map: {
      heading: "Find Us",
    },
    stats: {
      items: [
        { label: "Years Experience", value: "15" },
        { label: "Happy Customers", value: "1000+" },
        { label: "Projects Completed", value: "500+" },
      ],
    },
    text: {
      content: "Add your content here",
    },
  };

  return defaults[blockType] || {};
}
