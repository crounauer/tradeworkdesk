/**
 * Generate website pages and blocks from Figma preview HTML
 * Parses the structure and creates pages that match the design
 */

interface FigmaSection {
  type: string;
  title?: string;
  content?: string;
  imageUrl?: string;
  className?: string;
  elements?: string[];
}

interface GeneratedPage {
  slug: string;
  title: string;
  page_type: string;
  show_in_nav: boolean;
  nav_order: number;
  blocks: Array<{
    type: string;
    sort_order: number;
    content?: Record<string, unknown>;
  }>;
}

/**
 * Parse HTML to extract main sections and identify page structure
 */
function parseHtmlStructure(html: string): FigmaSection[] {
  const sections: FigmaSection[] = [];

  // Remove scripts and styles
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Extract main semantic sections: nav, header, hero, main, footer, etc.
  const sectionMatches = cleaned.matchAll(
    /<(header|nav|section|main|footer|article|div)\b[^>]*class="[^"]*(?:hero|banner|intro|showcase|features|services|testimonials|contact|footer)[^"]*"[^>]*>(.*?)<\/\1>/gis
  );

  for (const match of sectionMatches) {
    const tag = match[1].toLowerCase();
    const content = match[2];
    const classAttr = match[0].match(/class="([^"]*)/)?.[1] || "";

    let sectionType = "content";
    if (classAttr.includes("hero") || classAttr.includes("banner")) {
      sectionType = "hero";
    } else if (classAttr.includes("feature")) {
      sectionType = "features";
    } else if (classAttr.includes("testimon")) {
      sectionType = "testimonials";
    } else if (classAttr.includes("contact")) {
      sectionType = "contact";
    } else if (classAttr.includes("service")) {
      sectionType = "services_grid";
    } else if (tag === "nav" || classAttr.includes("nav")) {
      continue; // Skip nav sections
    } else if (tag === "footer" || classAttr.includes("footer")) {
      sectionType = "footer";
    }

    // Extract text content
    const textContent = content
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    // Extract images
    const imageMatches = content.match(/<img\b[^>]*src="([^"]*)"[^>]*>/gi) || [];
    const images = imageMatches.map((img) => {
      const src = img.match(/src="([^"]*)"/)?.[1] || "";
      return src;
    });

    sections.push({
      type: sectionType,
      content: textContent,
      elements: images,
      className: classAttr,
    });
  }

  return sections;
}

/**
 * Generate website pages from parsed Figma sections
 * Maps sections to pages/blocks with content
 */
export function generatePagesFromFigma(
  html: string,
  uploadedImages: Array<{ public_url: string; file_name: string }>
): GeneratedPage[] {
  const sections = parseHtmlStructure(html);
  const pages: GeneratedPage[] = [];

  // Always start with a home page
  const homeBlocks: GeneratedPage["blocks"] = [];
  let blockOrder = 0;

  // Add hero section if found, otherwise create a default one
  const heroSection = sections.find((s) => s.type === "hero");
  if (heroSection) {
    homeBlocks.push({
      type: "hero",
      sort_order: blockOrder++,
      content: {
        heading: heroSection.content?.split("\n")[0] || "Welcome",
        subheading: "Professional services you can trust",
        cta_text: "Get Started",
        cta_url: "/contact",
      },
    });
  } else {
    homeBlocks.push({
      type: "hero",
      sort_order: blockOrder++,
      content: {
        heading: "Welcome to Our Business",
        subheading: "Professional services you can trust",
        cta_text: "Get Started",
        cta_url: "/contact",
      },
    });
  }

  // Add features section
  const featuresSection = sections.find((s) => s.type === "features");
  if (featuresSection || uploadedImages.length > 0) {
    homeBlocks.push({
      type: "features",
      sort_order: blockOrder++,
      content: {
        heading: featuresSection?.content || "Why Choose Us",
        items: [
          { title: "Professional", description: "Expert service delivered" },
          { title: "Reliable", description: "Consistent quality" },
          { title: "Quality", description: "Guaranteed results" },
        ],
      },
    });
  }

  // Add gallery if we have uploaded images
  if (uploadedImages.length > 0) {
    homeBlocks.push({
      type: "gallery",
      sort_order: blockOrder++,
      content: {
        heading: "Our Work",
        items: uploadedImages.slice(0, 6).map((img, idx) => ({
          image_url: img.public_url,
          title: img.file_name,
          order: idx + 1,
        })),
      },
    });
  }

  // Add services section
  const servicesSection = sections.find((s) => s.type === "services_grid");
  if (servicesSection) {
    homeBlocks.push({
      type: "services_grid",
      sort_order: blockOrder++,
      content: {
        heading: servicesSection.content || "Our Services",
        items: [
          { title: "Service 1", description: "Professional service" },
          { title: "Service 2", description: "Quality assured" },
          { title: "Service 3", description: "Reliable delivery" },
        ],
      },
    });
  }

  // Add testimonials section
  const testimonialSection = sections.find((s) => s.type === "testimonials");
  if (testimonialSection) {
    homeBlocks.push({
      type: "testimonials",
      sort_order: blockOrder++,
      content: {
        heading: "What Our Clients Say",
        items: [
          { author: "Client Name", review: "Excellent service!", rating: 5 },
          { author: "Another Client", review: "Highly recommended", rating: 5 },
        ],
      },
    });
  }

  // Add CTA section
  homeBlocks.push({
    type: "cta",
    sort_order: blockOrder++,
    content: {
      heading: "Ready to Get Started?",
      button_text: "Contact Us",
      button_url: "/contact",
    },
  });

  // Add contact form
  homeBlocks.push({
    type: "contact_form",
    sort_order: blockOrder++,
    content: {
      heading: "Get in Touch",
      fields: ["name", "email", "phone", "message"],
    },
  });

  pages.push({
    slug: "home",
    title: "Home",
    page_type: "home",
    show_in_nav: true,
    nav_order: 1,
    blocks: homeBlocks,
  });

  // Create Services page if there are service sections
  if (servicesSection) {
    pages.push({
      slug: "services",
      title: "Services",
      page_type: "services",
      show_in_nav: true,
      nav_order: 2,
      blocks: [
        {
          type: "services_grid",
          sort_order: 0,
          content: {
            heading: "Our Services",
            items: [
              { title: "Service 1", description: "Professional service" },
              { title: "Service 2", description: "Quality assured" },
              { title: "Service 3", description: "Reliable delivery" },
              { title: "Service 4", description: "Fast turnaround" },
            ],
          },
        },
      ],
    });
  }

  // Create Contact page
  pages.push({
    slug: "contact",
    title: "Contact",
    page_type: "contact",
    show_in_nav: true,
    nav_order: 3,
    blocks: [
      {
        type: "contact_form",
        sort_order: 0,
        content: {
          heading: "Get in Touch",
          fields: ["name", "email", "phone", "message"],
        },
      },
      {
        type: "map",
        sort_order: 1,
        content: {
          heading: "Visit Us",
        },
      },
    ],
  });

  return pages;
}

/**
 * Validate that generated pages have required fields
 */
export function validateGeneratedPages(pages: GeneratedPage[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pages.length) {
    errors.push("No pages generated from template");
  }

  for (const page of pages) {
    if (!page.slug) errors.push(`Page missing slug: ${page.title}`);
    if (!page.title) errors.push("Page missing title");
    if (!Array.isArray(page.blocks)) errors.push(`Page ${page.slug} blocks not an array`);
    for (const block of page.blocks || []) {
      if (!block.type) errors.push(`Block in page ${page.slug} missing type`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
