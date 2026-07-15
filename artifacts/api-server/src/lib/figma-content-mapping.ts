/**
 * Figma content → block props mapping
 *
 * Takes the raw content extracted from a Figma App.tsx export and produces a map
 * of blockType → component props, matching the block component prop contract in
 * business-app/src/twd/types.ts. Used by both the admin preview endpoint and
 * Phase 2 instance generation so previews and tenant sites render real copy.
 */

export type FigmaContent = {
  company: string;
  phone: string;
  tagline: string;
  location: string;
  navLinks: Array<{ label: string; page: string }>;
  services: Array<{ title: string; description: string; slug: string }>;
  testimonials: Array<{ name: string; location: string; text: string; date: string; stars: number }>;
  areas: string[];
  faq: Array<{ q: string; a: string }>;
  processSteps: Array<{ step: string; title: string; desc: string }>;
  blogPosts: Array<{ slug: string; title: string; excerpt: string; date: string; category: string }>;
  galleryImages: Array<{ url: string; alt: string }>;
  whyChoose: Array<{ title: string; desc: string }>;
  badges: string[];
  pageHeroes?: Record<string, { title?: string; subtitle?: string; bgImage?: string; emergencyMode?: boolean; showTrust?: boolean }>;
};

type Props = Record<string, unknown>;

function navItems(content: FigmaContent): Array<{ label: string; href: string }> {
  if (content.navLinks.length > 0) {
    return content.navLinks.map((l) => ({
      label: l.label,
      href: l.page === "home" ? "/" : `/${l.page}`,
    }));
  }
  return [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "Contact", href: "/contact" },
  ];
}

function email(content: FigmaContent): string {
  const domain = content.company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^-+|-+$/g, "");
  return `info@${domain || "example"}.co.uk`;
}

function pageLabel(pageSlug: string): string {
  switch (pageSlug) {
    case "service-detail":
      return "Service Detail";
    case "blog-index":
      return "Blog";
    case "blog-post":
      return "Article";
    case "404":
      return "Page Not Found";
    default:
      return pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1);
  }
}

/**
 * Build props for a single (raw) block type from extracted content.
 * Returns null when there is no meaningful content mapping for the type.
 */
export function buildBlockProps(rawBlockType: string, content: FigmaContent): Props | null {
  const type = rawBlockType.toLowerCase();

  switch (type) {
    case "site.header":
      return {
        logoText: content.company,
        navItems: navItems(content),
        ctaLabel: "Call Now",
        ctaHref: `tel:${content.phone.replace(/\s+/g, '')}`,
        phone: content.phone,
        headerStyle: "light",
        tone: "default",
        ctaStyle: "amber-solid",
        variant: "figma",
        scheduleText: "Mon–Sat 7am–8pm | Emergency 24/7",
        locationText: "Reading & Surrounding Areas",
      };

    case "site.footer":
      return {
        logoText: content.company,
        description: content.tagline,
        navItems: navItems(content).slice(0, 6),
        legalLinks: [
          { label: "Privacy Policy", href: "/legal" },
          { label: "Terms", href: "/legal" },
        ],
        phone: content.phone,
        email: email(content),
        variant: "classic",
        layout: "traditional",
        background: "navy",
        tone: "formal",
      };

    case "hero.standard":
      return {
        title: content.tagline || `${content.company}`,
        subtitle: `Honest, fast and fully insured — serving ${content.location}.`,
        primaryCtaLabel: "Request a Quote",
        primaryCtaHref: "#contact",
        secondaryCtaLabel: "Call Now",
        phone: content.phone,
      };

    case "trust.badges":
    case "brands":
    case "accreditations": {
      if (content.badges.length === 0) return null;
      return {
        badges: content.badges.map((label) => ({ label, description: "" })),
        variant: "classic",
        background: "light",
        cardStyle: "bordered-traditional",
        density: "compact",
      };
    }

    case "features.list":
    case "why.choose.us": {
      if (content.whyChoose.length === 0) return null;
      return {
        eyebrow: "Why Us",
        title: `Why Choose ${content.company}?`,
        features: content.whyChoose.map((w) => ({ title: w.title, description: w.desc })),
      };
    }

    case "services.grid": {
      if (content.services.length === 0) return null;
      return {
        eyebrow: "Services",
        title: "Plumbing Services We Cover",
        subtitle: "Trusted local plumbing support for homes and landlords.",
        services: content.services.map((s) => ({
          title: s.title,
          description: s.description,
          href: s.slug ? `/services/${s.slug}` : undefined,
        })),
        variant: "classic",
        background: "white",
        cardStyle: "bordered-traditional",
      };
    }

    case "services.rates": {
      return {
        eyebrow: "Rates",
        title: "Transparent Service Rates",
        subtitle: "Show service pricing from Service Catalogue, or add manual rates in the website editor.",
        note: "VAT included where applicable. Emergency and out-of-hours call-outs may vary.",
        variation: "cards",
        background: "light",
        rates: [],
      };
    }

    case "process.steps": {
      if (content.processSteps.length === 0) return null;
      return {
        eyebrow: "Process",
        title: "Our Simple 4-Step Process",
        steps: content.processSteps.map((p) => ({ title: p.title, description: p.desc })),
        variant: "classic",
        tone: "light",
      };
    }

    case "testimonials":
    case "reviews.grid": {
      if (content.testimonials.length === 0) return null;
      return {
        eyebrow: "Reviews",
        title: "What Our Customers Say",
        reviews: content.testimonials.map((t) => ({
          quote: t.text,
          name: t.name,
          location: t.location,
          rating: t.stars,
        })),
        variant: "classic",
        cardStyle: "quote",
        background: "light",
      };
    }

    case "areas.grid": {
      if (content.areas.length === 0) return null;
      return {
        eyebrow: "Areas",
        title: "Areas We Cover",
        subtitle: `Local ${content.company} serving ${content.location} and surrounding towns.`,
        areas: content.areas.map((name) => ({ name })),
      };
    }

    case "faq.accordion": {
      if (content.faq.length === 0) return null;
      return {
        eyebrow: "FAQs",
        title: "Frequently Asked Questions",
        faqs: content.faq.map((f) => ({ question: f.q, answer: f.a })),
      };
    }

    case "gallery.grid":
    case "project.showcase": {
      if (content.galleryImages.length === 0) return null;
      return {
        eyebrow: "Projects",
        title: "Recent Projects",
        images: content.galleryImages.map((g) => ({ alt: g.alt, caption: g.alt })),
      };
    }

    case "blog.index": {
      if (content.blogPosts.length === 0) return null;
      return {
        eyebrow: "Blog",
        title: "Latest Advice & Guides",
        posts: content.blogPosts.map((b) => ({
          title: b.title,
          excerpt: b.excerpt,
          href: b.slug ? `/blog/${b.slug}` : "/blog",
          date: b.date,
        })),
      };
    }

    case "contact.split":
    case "online.booking":
      return {
        eyebrow: "Contact",
        title: "Request a Free Quote",
        subtitle: "Tell us what you need and we'll get back to you quickly.",
        phone: content.phone,
        email: email(content),
        address: content.location,
        openingHours: "Mon–Sat 7am–8pm",
      };

    case "cta.banner":
    case "sticky.mobile.cta":
      return {
        title: "Ready to Book or Need Advice?",
        subtitle: `Call ${content.company} today for a free, no-obligation quote.`,
        primaryCtaLabel: "Call Now",
        secondaryCtaLabel: "Request a Quote",
        phone: content.phone,
        ctaStyle: "classic-navy",
        tone: "practical",
        background: "navy",
      };

    case "legal.content":
      return {
        title: "Legal Information",
        updatedDate: "Updated July 2026",
        sections: [
          {
            heading: "About This Site",
            body: `This website is operated by ${content.company}, ${content.location}.`,
          },
        ],
      };

    case "system.notfound":
    case "system.404":
      return {
        title: "Page Not Found",
        subtitle: "The page you are looking for could not be found.",
        ctaLabel: "Back to Home",
        ctaHref: "/",
      };

    case "amazon":
      return {
        badges: content.badges.slice(0, 6).map((label) => ({ label, description: "" })),
        variant: "classic",
        background: "light",
        cardStyle: "bordered-traditional",
        density: "compact",
      };

    default:
      return null;
  }
}

/**
 * Build props for a block with optional per-page context.
 */
export function buildBlockPropsForPage(
  pageSlug: string,
  rawBlockType: string,
  content: FigmaContent,
): Props | null {
  const base = buildBlockProps(rawBlockType, content);
  if (!base) return null;
  const type = rawBlockType.toLowerCase();

  if (type === "hero.standard") {
    const hero = content.pageHeroes?.[pageSlug];
    if (hero) {
      const isEmergency = Boolean(hero.emergencyMode);
      const backgroundCss = hero.bgImage
        ? `linear-gradient(rgba(15,31,61,0.75), rgba(15,31,61,0.85)), url(${hero.bgImage}) center/cover no-repeat`
        : isEmergency
          ? "linear-gradient(135deg, #b91c1c 0%, #1a3a6b 100%)"
          : "linear-gradient(135deg, #1a3a6b 0%, #0f1f3d 100%)";

      return {
        ...base,
        eyebrow: "",
        ...(hero.title ? { title: hero.title } : {}),
        ...(hero.subtitle ? { subtitle: hero.subtitle } : {}),
        backgroundCss,
        headingColor: "#ffffff",
        subheadingColor: "rgba(255,255,255,0.8)",
        primaryCtaLabel: `Call Now: ${content.phone}`,
        secondaryCtaLabel: "Request a Quote",
        primaryButtonBgColor: "#00a8a8",
        primaryButtonTextColor: "#ffffff",
        secondaryButtonBgColor: "#ffffff",
        secondaryButtonTextColor: "#1a3a6b",
        secondaryButtonBorderColor: "rgba(26, 58, 107, 0.12)",
        trustBadges: hero.showTrust ? ["Fully Insured", "Local Engineers", "Fast Response", "Free Quotes"] : undefined,
        phone: undefined,
      };
    }
  }

  // Page-aware section copy and tone for non-hero blocks.
  if (type === "services.grid" && pageSlug !== "home") {
    return {
      ...base,
      title:
        pageSlug === "services"
          ? "All Plumbing Services"
          : pageSlug === "service-detail"
            ? "Related Plumbing Services"
            : base.title,
      subtitle:
        pageSlug === "services"
          ? "From minor fixes to full installations, delivered by local experts."
          : base.subtitle,
    };
  }

    if (type === "services.rates") {
      return {
        ...base,
        title:
          pageSlug === "services"
            ? "Our Service Rates"
            : pageSlug === "service-detail"
              ? "Typical Rates for Related Services"
              : base.title,
        subtitle:
          pageSlug === "services"
            ? "Choose the service that fits your needs and budget."
            : base.subtitle,
        variation: pageSlug === "services" ? "table" : base.variation,
      };
    }

  if (type === "features.list") {
    return {
      ...base,
      title:
        pageSlug === "service-detail"
          ? "Why Homeowners Choose Us for Leak Repairs"
          : pageSlug === "services"
            ? "Why Choose Local Plumbing Pro?"
            : base.title,
    };
  }

  if (type === "process.steps" && pageSlug === "emergency") {
    return {
      ...base,
      title: "Emergency Response Process",
      tone: "light",
    };
  }

  if ((type === "reviews.grid" || type === "testimonials") && pageSlug === "reviews") {
    return {
      ...base,
      title: "Customer Reviews",
      background: "white",
    };
  }

  if (type === "areas.grid" && pageSlug === "areas") {
    return {
      ...base,
      title: "Areas We Cover",
      subtitle: "Serving Reading, Berkshire and the surrounding towns and villages.",
    };
  }

  if (type === "gallery.grid" && pageSlug === "gallery") {
    return {
      ...base,
      title: "Work Gallery",
      eyebrow: "Gallery",
    };
  }

  if (type === "blog.index") {
    return {
      ...base,
      title: pageSlug === "blog-post" ? "Related Articles" : "Plumbing Tips & Advice",
    };
  }

  if (type === "contact.split" || type === "online.booking") {
    return {
      ...base,
      title:
        pageSlug === "booking"
          ? "Book an Appointment"
          : pageSlug === "contact"
            ? "Contact Us"
            : "Request a Free Quote",
      subtitle:
        pageSlug === "booking"
          ? "Choose your service and preferred time and we will confirm by phone."
          : pageSlug === "contact"
            ? "We are here to help, call, email, or send us a message."
            : base.subtitle,
    };
  }

  if (type === "cta.banner") {
    return {
      ...base,
      title:
        pageSlug === "emergency"
          ? "Need Emergency Help Right Now?"
          : pageSlug === "booking"
            ? "Ready to Schedule Your Appointment?"
            : base.title,
      subtitle:
        pageSlug === "emergency"
          ? `Call ${content.company} now for urgent plumbing support.`
          : base.subtitle,
      background: "navy",
      ctaStyle: "classic-navy",
    };
  }

  if (type === "faq.accordion") {
    return {
      ...base,
      title: pageSlug === "legal" ? "Policy Questions" : base.title,
    };
  }

  if (type === "legal.content") {
    return {
      ...base,
      title: pageSlug === "legal" ? "Legal & Policies" : base.title,
      updatedDate: "Updated July 2026",
    };
  }

  if (type === "site.header") {
    return {
      ...base,
      ctaLabel: pageSlug === "emergency" ? "Emergency Call" : "Request a Quote",
    };
  }

  if (type === "site.footer") {
    return {
      ...base,
      description: `${content.tagline} Serving ${content.location}.`,
    };
  }

  if (type === "system.notfound" || type === "system.404") {
    return {
      ...base,
      title: pageLabel(pageSlug),
    };
  }

  return base;
}

/**
 * Build a map of every mapped block type → props from extracted content.
 */
export function buildBlockPropsMap(
  content: FigmaContent,
  blockTypes: string[],
): Record<string, Props> {
  const map: Record<string, Props> = {};
  const seen = new Set<string>();
  for (const raw of blockTypes) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    const props = buildBlockProps(raw, content);
    if (props) map[raw] = props;
  }
  return map;
}

/**
 * Build page-scoped block props: pageSlug -> blockType -> props.
 */
export function buildPageBlockPropsMap(
  content: FigmaContent,
  pageBlocks: Record<string, string[]>,
): Record<string, Record<string, Props>> {
  const map: Record<string, Record<string, Props>> = {};

  for (const [pageSlug, blockTypes] of Object.entries(pageBlocks)) {
    const pageMap: Record<string, Props> = {};
    for (const blockType of blockTypes) {
      const props = buildBlockPropsForPage(pageSlug, blockType, content);
      if (props) pageMap[blockType] = props;
    }
    map[pageSlug] = pageMap;
  }

  return map;
}
