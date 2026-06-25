import { parseClassicHomeTsx } from "@/features/website-builder/websiteContentSchema";
import type { WebsiteTemplate, WebsiteTemplateBlock, WebsiteBlockType } from "@/features/website-builder/websiteBuilderTypes";

function b(id: string, type: WebsiteBlockType, name: string, description: string): WebsiteTemplateBlock {
  return { id, type, name, description };
}

const HOME_BLOCK_DEFAULTS: WebsiteTemplateBlock[] = [
  b("business-info", "business_info", "Business Info", "Core business details used across header/footer and contact areas."),
  b("hero", "hero", "Hero", "Primary above-the-fold headline, CTA, and hero image."),
  b("benefits", "benefits", "Benefits", "Trust and value proposition feature cards."),
  b("services", "services", "Services Preview", "Top service cards shown on homepage."),
  b("process", "process", "Process", "How it works step section."),
  b("featured-project", "featured_project", "Featured Project", "One project highlight section."),
  b("trust-bar", "trust_bar", "Trust Bar", "Accreditation strip and trust indicators."),
  b("reviews", "reviews", "Reviews Preview", "Customer review cards on homepage."),
  b("areas", "areas", "Areas Preview", "Area coverage highlights."),
];

export const classicTemplate: WebsiteTemplate = {
  id: "classic",
  name: "Classic",
  pages: [
    {
      slug: "home",
      name: "Home",
      blocks: HOME_BLOCK_DEFAULTS,
    },
    {
      slug: "services",
      name: "Services",
      blocks: [
        b("services-page", "services", "Services", "Full service catalogue and cards."),
      ],
    },
    {
      slug: "reviews",
      name: "Reviews",
      blocks: [
        b("reviews-page", "reviews", "Reviews", "Customer reviews and ratings."),
      ],
    },
    {
      slug: "areas",
      name: "Areas",
      blocks: [
        b("areas-page", "areas", "Areas", "Coverage areas and service region details."),
      ],
    },
    {
      slug: "faq",
      name: "FAQ",
      blocks: [
        b("faq-page", "faq", "FAQs", "Frequently asked questions section."),
      ],
    },
    {
      slug: "contact",
      name: "Contact",
      blocks: [
        b("contact-page", "contact", "Contact Details", "Contact channels, hours and contact form."),
      ],
    },
  ],
};

const HOME_COMPONENT_TO_BLOCK: Record<string, WebsiteBlockType> = {
  Hero: "hero",
  Benefits: "benefits",
  ServicesPreview: "services",
  HowItWorksPreview: "process",
  FeaturedProject: "featured_project",
  TrustBar: "trust_bar",
  ReviewsPreview: "reviews",
  AreasPreview: "areas",
  FAQ: "faq",
  Contact: "contact",
};

export function applyHomeTsxToClassicTemplate(source: string): WebsiteTemplate {
  const parsed = parseClassicHomeTsx(source);
  if (!parsed.blockTypes.length) {
    return classicTemplate;
  }

  const enrichedHomeBlocks = parsed.componentNames
    .map((componentName, idx) => {
      const type = HOME_COMPONENT_TO_BLOCK[componentName];
      if (!type) return null;
      return b(
        `home-${idx}-${type}`,
        type,
        componentName,
        `Parsed from Home.tsx section: ${componentName}`,
      );
    })
    .filter((x): x is WebsiteTemplateBlock => Boolean(x));

  return {
    ...classicTemplate,
    pages: classicTemplate.pages.map((page) =>
      page.slug === "home"
        ? {
            ...page,
            name: parsed.pageName || page.name,
            blocks: enrichedHomeBlocks.length ? enrichedHomeBlocks : page.blocks,
          }
        : page,
    ),
  };
}
