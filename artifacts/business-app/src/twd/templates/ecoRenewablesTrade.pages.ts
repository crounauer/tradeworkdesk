import type { TemplatePage } from "./TemplatePageRenderer";

const siteHeader = {
  type: "site.header",
  props: {
    logoText: "Eco Renewables Trade",
    navItems: [
      { label: "Home", href: "/" },
      { label: "Services", href: "/services" },
      { label: "Areas", href: "/areas-covered" },
      { label: "Reviews", href: "/reviews" },
      { label: "Contact", href: "/contact" },
    ],
    phone: "01224 700900",
    ctaLabel: "Request a quote",
    ctaHref: "#contact",
  },
} as const;

const siteFooter = {
  type: "site.footer",
  props: {
    logoText: "Eco Renewables Trade",
    description: "Low-carbon heating and renewable energy services for homes and small commercial properties.",
    phone: "01224 700900",
    email: "hello@ecorenewablestrade.co.uk",
    navItems: [
      { label: "Services", href: "/services" },
      { label: "Areas", href: "/areas-covered" },
      { label: "Reviews", href: "/reviews" },
      { label: "Contact", href: "/contact" },
    ],
    legalLinks: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Cookie Policy", href: "/cookie-policy" },
      { label: "Terms", href: "/terms-conditions" },
    ],
  },
} as const;

const commonCta = {
  type: "cta.banner",
  props: {
    title: "Need advice on a low-carbon upgrade?",
    subtitle: "Clear guidance for surveys, quotations, installations and planned maintenance.",
    primaryCtaLabel: "Request a quote",
    secondaryCtaLabel: "Call now",
    phone: "01224 700900",
  },
} as const;

const contactSplit = {
  type: "contact.split",
  props: {
    eyebrow: "Contact",
    title: "Request a quote or ask a question",
    subtitle: "Tell us about your property and goals, and we will recommend a practical next step.",
    phone: "01224 700900",
    email: "hello@ecorenewablestrade.co.uk",
    address: "Aberdeenshire, Scotland",
    openingHours: "Monday to Friday, 8am to 5pm",
  },
} as const;

export const ecoRenewablesTradeHomePage: TemplatePage = {
  title: "Home",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Renewable energy specialists",
        title: "Clean energy and low-carbon heating services across Aberdeenshire",
        subtitle:
          "Heat pump, solar PV, battery storage and EV charging support with clear advice and practical planning.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Engineer working on a heating system",
      },
    },
    {
      type: "trust.badges",
      props: {
        badges: [
          { label: "Local team", description: "Supporting customers across Aberdeenshire and nearby areas." },
          { label: "Clear pricing", description: "Straightforward advice before work begins." },
          { label: "Practical planning", description: "Focused on suitable upgrades and realistic project scope." },
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Services",
        title: "Renewable services for homes and small sites",
        subtitle: "Specialist support for homeowners, landlords and light commercial properties.",
        services: [
          { title: "Heat pumps", description: "Design, installation and optimisation of air source heat pump systems.", href: "/services/heat-pumps" },
          { title: "Solar PV and battery", description: "Solar generation and battery storage planning for resilient day-to-day energy use.", href: "/services/solar-battery" },
          { title: "EV charging", description: "Smart EV charger installations with practical load-management advice.", href: "/services/ev-charging" },
        ],
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Reviews",
        title: "What customers say",
        reviews: [
          { quote: "Survey was clear, options were explained properly, and the heat pump install was tidy.", name: "Customer", location: "Ellon", rating: 5 },
          { quote: "Great communication from first visit to commissioning, with practical advice throughout.", name: "Customer", location: "Inverurie", rating: 5 },
          { quote: "Solar and battery setup was well organised and everything was explained in plain English.", name: "Customer", location: "Peterhead", rating: 5 },
        ],
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Areas we cover",
        title: "Serving homes across the North East",
        subtitle: "Renewable heating and clean energy support across towns and rural areas.",
        areas: [
          { name: "Ellon", href: "/areas/ellon" },
          { name: "Inverurie", href: "/areas/inverurie" },
          { name: "Peterhead", href: "/areas/peterhead" },
          { name: "Aberdeen", href: "/areas/aberdeen" },
        ],
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "FAQ",
        title: "Common questions",
        faqs: [
          { question: "What renewable services do you provide?", answer: "This template suits heat pumps, solar PV, battery storage, EV charging and energy-efficiency upgrades." },
          { question: "Can customers request a quote online?", answer: "Yes, use the enquiry form or call to discuss the work required." },
          { question: "Which areas do you cover?", answer: "We cover Ellon, Inverurie, Peterhead, Aberdeen and surrounding rural areas." },
        ],
      },
    },
    commonCta,
    contactSplit,
    siteFooter,
  ],
};

export const ecoRenewablesTradeAboutPage: TemplatePage = {
  title: "About",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "About us",
        title: "A trusted local team for practical low-carbon upgrades",
        subtitle:
          "Approachable technical support for customers who want clear advice, reliable workmanship and sensible low-carbon options.",
        primaryCtaLabel: "Get in touch",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Local heating engineer profile placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Who we are",
        title: "Experienced renewable support for homes and small properties",
        body:
          "We help homeowners, landlords and small commercial customers with surveys, design advice, installation and ongoing maintenance. The focus is simple: practical advice, careful workmanship and no unnecessary confusion.",
        bullets: [
          "Heat pumps, solar PV, battery storage and EV charging",
          "Clear communication and practical recommendations",
          "Local support across Aberdeenshire",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Our approach",
        title: "Built around clear communication",
        subtitle: "Customers should understand what is happening, what it costs and what happens next.",
        features: [
          { title: "Clear explanations", description: "Issues are explained in plain English before work begins." },
          { title: "Practical options", description: "Advice is based on what the property actually needs." },
          { title: "Respect for your home", description: "Work is carried out carefully and tidily." },
          { title: "Local accountability", description: "A local business with a reputation to protect." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const ecoRenewablesTradeServicesPage: TemplatePage = {
  title: "Services",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Services",
        title: "Low-carbon heating and renewable energy services",
        subtitle:
          "From surveys to installation and maintenance, this template gives renewable businesses a clear service structure.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Ask a question",
        phone: "01224 700900",
        imageAlt: "Renewable energy services image placeholder",
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Services",
        title: "Choose a renewable service",
        subtitle: "Each service can link to its own editable detail page.",
        services: [
          { title: "Heat pump installation and servicing", description: "Heat pump design, installation and servicing for efficient low-temperature heating.", href: "/services/heat-pumps" },
          { title: "Solar PV and battery storage", description: "Solar PV and battery storage planning for resilient day-to-day energy use.", href: "/services/solar-battery" },
          { title: "EV charging", description: "EV charger installation and setup for homes and small commercial sites.", href: "/services/ev-charging" },
          { title: "Home energy surveys", description: "Property surveys to assess suitability for low-carbon upgrades.", href: "/services/home-energy-surveys" },
          { title: "Heating controls and zoning", description: "Heating control improvements to support comfort and efficient operation.", href: "/services/heating-controls" },
          { title: "Energy-efficiency upgrades", description: "Insulation-linked upgrade guidance and practical efficiency improvements.", href: "/services/energy-efficiency" },
        ],
      },
    },
    {
      type: "process.steps",
      props: {
        eyebrow: "Process",
        title: "Simple from first contact to completion",
        steps: [
          { title: "Tell us about your property", description: "Share your current setup, goals and any known constraints for the project." },
          { title: "Survey and technical recommendation", description: "We assess suitability and explain practical options with clear scope." },
          { title: "Installation and handover", description: "Work is completed carefully with commissioning guidance and follow-up support." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const ecoRenewablesTradeServiceDetailPage: TemplatePage = {
  title: "Service Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Service detail",
        title: "Heat pump surveys, installation and ongoing support",
        subtitle:
          "A dedicated service detail page for explaining what is included, who it suits and how customers can book.",
        primaryCtaLabel: "Book a survey",
        secondaryCtaLabel: "View all services",
        phone: "01224 700900",
        imageAlt: "Trade service detail image placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "What is included",
        title: "A clear survey and design visit with practical next steps",
        body:
          "This page structure is designed for a specific renewable service. It gives the business space to explain the work, set expectations and answer common customer questions.",
        bullets: [
          "Home energy and heat-loss assessment",
          "System suitability and upgrade compatibility checks",
          "Clear options with transparent quotation guidance",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Benefits",
        title: "Why planned maintenance and optimisation matter",
        subtitle: "A service detail page should help customers understand outcomes, scope and realistic timelines.",
        features: [
          { title: "Reliable year-round performance", description: "Regular checks help spot problems before they become breakdowns." },
          { title: "Safer and better-controlled systems", description: "Important components can be inspected and tested during a visit." },
          { title: "Lower waste through better setup", description: "Well-configured renewable systems can reduce avoidable energy waste without overpromising savings." },
          { title: "Clear advice", description: "Customers receive practical guidance on any issues found." },
        ],
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "Service questions",
        title: "Questions about this service",
        faqs: [
          { question: "How often should renewable systems be serviced?", answer: "Servicing schedules vary by system and manufacturer guidance, with annual reviews commonly used for planning." },
          { question: "Can optimisation be completed during a maintenance visit?", answer: "Minor setup issues can often be adjusted during a visit, while larger faults may require parts or a follow-up appointment." },
          { question: "Can landlords use this page?", answer: "Yes, this page type can be adapted for landlord-focused servicing content." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const ecoRenewablesTradeAreasCoveredPage: TemplatePage = {
  title: "Areas Covered",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Areas we cover",
        title: "Local renewable services across Aberdeenshire",
        subtitle:
          "A clear coverage page helps customers quickly confirm local availability for surveys and installations.",
        primaryCtaLabel: "Check availability",
        secondaryCtaLabel: "Contact us",
        phone: "01224 700900",
        imageAlt: "Map area placeholder",
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Service areas",
        title: "Core towns and nearby villages covered",
        subtitle: "Each area can link to a dedicated local landing page.",
        areas: [
          { name: "Ellon", href: "/areas/ellon" },
          { name: "Inverurie", href: "/areas/inverurie" },
          { name: "Peterhead", href: "/areas/peterhead" },
          { name: "Aberdeen", href: "/areas/aberdeen" },
          { name: "Oldmeldrum", href: "/areas/oldmeldrum" },
          { name: "Mintlaw", href: "/areas/mintlaw" },
          { name: "Newburgh", href: "/areas/newburgh" },
          { name: "Balmedie", href: "/areas/balmedie" },
          { name: "Turriff", href: "/areas/turriff" },
          { name: "Fraserburgh", href: "/areas/fraserburgh" },
          { name: "Huntly", href: "/areas/huntly" },
          { name: "Dyce", href: "/areas/dyce" },
        ],
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const ecoRenewablesTradeAreaDetailPage: TemplatePage = {
  title: "Area Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Ellon",
        title: "Renewable energy specialists in Ellon",
        subtitle:
          "A local area landing page for targeting service searches in a specific town or village.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Ellon service area image placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Local service",
        title: "Practical low-carbon support close to home",
        body:
          "This area page can be adapted for any town or village. It gives the business space to explain local availability, common services and how customers can get help.",
        bullets: [
          "Heat pumps and servicing in Ellon",
          "Survey and installation support in surrounding villages",
          "Support for homeowners and landlords",
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Popular services",
        title: "Common services in this area",
        subtitle: "Area pages can highlight the services most relevant locally.",
        services: [
          { title: "Heat pumps", description: "Heat pump installation, servicing and optimisation support for local properties.", href: "/services/heat-pumps" },
          { title: "Solar PV and battery", description: "Solar generation and battery options for homes looking to improve energy resilience.", href: "/services/solar-battery" },
          { title: "EV charging", description: "EV charger installation with practical setup advice for home and small business use.", href: "/services/ev-charging" },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const ecoRenewablesTradeReviewsPage: TemplatePage = {
  title: "Reviews",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Reviews",
        title: "Customer feedback on renewable projects",
        subtitle:
          "A dedicated reviews page helps build trust for specialist renewable services.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Contact us",
        phone: "01224 700900",
        imageAlt: "Customer review image placeholder",
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Customer feedback",
        title: "What customers say",
        reviews: [
          { quote: "Excellent survey process and a clear recommendation without pressure.", name: "Customer", location: "Ellon", rating: 5 },
          { quote: "Heat pump installation was tidy and the team explained controls clearly.", name: "Customer", location: "Inverurie", rating: 5 },
          { quote: "Solar and battery quote was practical and easy to understand.", name: "Customer", location: "Peterhead", rating: 5 },
          { quote: "Professional communication throughout and no unrealistic claims.", name: "Customer", location: "Aberdeen", rating: 5 },
          { quote: "EV charger installation was smooth and everything was demonstrated on handover.", name: "Customer", location: "Oldmeldrum", rating: 5 },
          { quote: "Reliable local service with sensible advice for phased upgrades.", name: "Customer", location: "Mintlaw", rating: 5 },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const ecoRenewablesTradeGalleryPage: TemplatePage = {
  title: "Gallery",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Gallery",
        title: "Recent renewable projects and upgrade examples",
        subtitle:
          "A gallery page helps renewable businesses show real project types and installation quality.",
        primaryCtaLabel: "Discuss a job",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Recent work gallery hero placeholder",
      },
    },
    {
      type: "gallery.grid",
      props: {
        eyebrow: "Recent work",
        title: "Example renewable projects",
        images: [
          { alt: "Installation work photo placeholder", caption: "Heat pump outdoor unit installation" },
          { alt: "Heating controls photo placeholder", caption: "Smart heating controls and zoning upgrade" },
          { alt: "Plant room photo placeholder", caption: "Solar PV array installation" },
          { alt: "Cylinder cupboard photo placeholder", caption: "Battery storage and inverter setup" },
          { alt: "Pipework photo placeholder", caption: "Plant room tidy-up and hydraulic improvements" },
          { alt: "External service photo placeholder", caption: "EV charger installation and commissioning" },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const ecoRenewablesTradeFaqPage: TemplatePage = {
  title: "FAQ",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "FAQ",
        title: "Frequently asked questions",
        subtitle:
          "A practical FAQ page helps customers understand suitability, process and expectations.",
        primaryCtaLabel: "Ask a question",
        secondaryCtaLabel: "Contact us",
        phone: "01224 700900",
        imageAlt: "FAQ image placeholder",
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "Common questions",
        title: "Helpful answers before you book",
        faqs: [
          { question: "Do you install both heat pumps and solar PV?", answer: "Yes, this template supports both technologies along with battery and EV charging services." },
          { question: "Do you provide home energy surveys?", answer: "Yes, surveys help identify practical upgrade options before quoting installation work." },
          { question: "Can I request a quote online?", answer: "Yes, the contact block can be connected to the TWD enquiry system." },
          { question: "Do you cover rural properties and small commercial sites?", answer: "Yes, coverage can include rural homes, farms and small commercial properties depending on location." },
          { question: "Can I edit these questions?", answer: "Yes, questions and answers are passed as editable page data." },
        ],
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const ecoRenewablesTradeContactPage: TemplatePage = {
  title: "Contact",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Contact",
        title: "Get in touch about renewable upgrades and surveys",
        subtitle:
          "A focused contact page with phone, email, opening hours and enquiry form placement.",
        primaryCtaLabel: "Send an enquiry",
        secondaryCtaLabel: "Call now",
        phone: "01224 700900",
        imageAlt: "Contact image placeholder",
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const ecoRenewablesTradeBlogIndexPage: TemplatePage = {
  title: "Blog Index",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Advice",
        title: "Renewable energy advice",
        subtitle:
          "A blog index gives the business space to publish useful articles and support SEO.",
        primaryCtaLabel: "View services",
        secondaryCtaLabel: "Contact us",
        phone: "01224 700900",
        imageAlt: "Blog advice image placeholder",
      },
    },
    {
      type: "blog.index",
      props: {
        eyebrow: "Latest articles",
        title: "Useful guides for homeowners and property managers",
        posts: [
          { title: "How to prepare your home for a heat pump survey", excerpt: "A practical checklist covering radiators, insulation and space requirements before survey day.", href: "/blog/prepare-for-a-heat-pump-survey", date: "12 June 2026" },
          { title: "Heat pumps, solar and batteries: choosing the right upgrade path", excerpt: "How to compare options and sequence upgrades without overcommitting your budget.", href: "/blog/heat-pump-solar-battery-upgrade-path", date: "18 June 2026" },
          { title: "Questions to ask before installing EV charging at home", excerpt: "What to discuss about charger location, power supply and long-term usability.", href: "/blog/questions-before-ev-charger-installation", date: "24 June 2026" },
        ],
      },
    },
    siteFooter,
  ],
};

export const ecoRenewablesTradeBlogPostPage: TemplatePage = {
  title: "Blog Post",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Service advice",
        title: "How to plan a practical low-carbon upgrade for your property?",
        subtitle:
          "A blog post page structure for publishing useful advice while keeping the design consistent with the template.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Renewable service advice image placeholder",
      },
    },
    {
      type: "legal.content",
      props: {
        title: "How to plan a practical low-carbon upgrade for your property?",
        updatedDate: "24 June 2026",
        sections: [
          { heading: "Start with a property survey", body: "A good survey maps current heating and electrical setup, then prioritises realistic upgrade options." },
          { heading: "Sequence upgrades sensibly", body: "Many projects work best in stages, for example controls and insulation first, then heat pump, then solar and storage." },
          { heading: "Avoid unrealistic promises", body: "Focus on measurable technical suitability and transparent quotations rather than guaranteed savings claims." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const ecoRenewablesTradePrivacyPolicyPage: TemplatePage = {
  title: "Privacy Policy",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Privacy Policy",
        updatedDate: "24 June 2026",
        sections: [
          { heading: "Who we are", body: "This website is operated by the business shown on this site. Contact details are provided on the contact page." },
          { heading: "Information we collect", body: "When a visitor submits an enquiry, the website may collect contact details and information about the requested work." },
          { heading: "How information is used", body: "Information is used to respond to enquiries, arrange work and provide customer support." },
          { heading: "Data retention", body: "Information should only be kept for as long as needed for legitimate business, legal or accounting reasons." },
        ],
      },
    },
    siteFooter,
  ],
};

export const ecoRenewablesTradeCookiePolicyPage: TemplatePage = {
  title: "Cookie Policy",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Cookie Policy",
        updatedDate: "24 June 2026",
        sections: [
          { heading: "What cookies are", body: "Cookies are small files used by websites to remember information or support basic functionality." },
          { heading: "How this site may use cookies", body: "This website may use essential cookies, analytics cookies or similar technologies depending on the features enabled." },
          { heading: "Managing cookies", body: "Visitors can manage cookies through their browser settings or any cookie controls provided on the website." },
        ],
      },
    },
    siteFooter,
  ],
};

export const ecoRenewablesTradeTermsConditionsPage: TemplatePage = {
  title: "Terms Conditions",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Terms & Conditions",
        updatedDate: "24 June 2026",
        sections: [
          { heading: "Use of this website", body: "This website provides general information about the business, services and ways to make contact." },
          { heading: "Quotes and availability", body: "Any prices, availability or timescales should be confirmed directly with the business before work begins." },
          { heading: "Website content", body: "The business aims to keep information accurate, but service details may change over time." },
        ],
      },
    },
    siteFooter,
  ],
};

export const ecoRenewablesTradeNotFoundPage: TemplatePage = {
  title: "404",
  blocks: [
    siteHeader,
    {
      type: "system.notFound",
      props: {
        title: "Page not found",
        subtitle: "The page you are looking for may have moved or no longer exists.",
        ctaLabel: "Return home",
        ctaHref: "/",
      },
    },
    siteFooter,
  ],
};

const stickyMobileCta = {
  type: "sticky_mobile_cta",
  props: {
    primary_label: "Call Now",
    primary_href: "tel:+441224000000",
    secondary_label: "Book Online",
    secondary_href: "/book",
    background_color: "#0f172a",
    text_color: "#ffffff",
    enabled: true,
  },
} as const;

function withStickyMobileCta(page: TemplatePage): TemplatePage {
  const hasSticky = page.blocks.some((block) => String(block.type || block.block_type || "").trim().toLowerCase() === "sticky_mobile_cta");
  if (hasSticky) return page;
  return { ...page, blocks: [...page.blocks, stickyMobileCta] };
}

function withEcoRenewablesStyleMix(page: TemplatePage): TemplatePage {
  return {
    ...page,
    blocks: page.blocks.map((block, index) => {
      const rawType = String(block.type || block.block_type || "").trim().toLowerCase();
      const normalizedType = ({
        "hero.standard": "hero",
        "about.intro": "text",
        "trust.badges": "accreditations",
        "services.grid": "services",
        "reviews.grid": "testimonials",
        "areas.grid": "areas",
        "gallery.grid": "gallery",
        "cta.banner": "cta",
        "contact.split": "contact",
        "faq.accordion": "faq",
        "process.steps": "process",
        "features.list": "feature_cards",
        "blog.index": "blog_index",
        "blog.post": "blog_post",
        "legal.content": "legal_content",
      } as Record<string, string>)[rawType] || rawType;

      const props = (block.props && typeof block.props === "object") ? block.props as Record<string, unknown> : {};
      const slot = index % 4;
      const baseTheme = {
        accent_color: "#65A30D",
        heading_color: "#1F3A27",
        body_color: "#557462",
        border_color: "#BFD9C2",
        card_bg: "#FFFFFF",
        section_bg: "#F5FAF4",
      } as Record<string, unknown>;

      const byType: Record<string, Record<string, unknown>> = {
        hero: {
          layout: ["full", "split", "centered", "split"][slot],
          variant: ["modern", "default", "classic", "modern"][slot],
          heroStyle: ["modern", "default", "classic", "modern"][slot],
          tone: ["light", "default", "navy", "light"][slot],
          ...baseTheme,
        },
        cta: {
          layout_variant: ["minimal-strip", "center-banner", "split-inline", "stacked-card"][slot],
          layout: ["minimal-strip", "center-banner", "split-inline", "stacked-card"][slot],
          ...baseTheme,
        },
        services: {
          layout_variant: ["split-list", "icon-panels", "card-grid", "compact-rows"][slot],
          layout: ["split-list", "icon-panels", "card-grid", "compact-rows"][slot],
          ...baseTheme,
        },
        testimonials: {
          layout_variant: ["spotlight", "editorial-list", "card-grid", "compact-rows"][slot],
          layout: ["spotlight", "editorial-list", "card-grid", "compact-rows"][slot],
          ...baseTheme,
        },
        areas: {
          layout_variant: ["pill-cloud", "split-columns", "card-grid", "minimal-list"][slot],
          layout: ["pill-cloud", "split-columns", "card-grid", "minimal-list"][slot],
          ...baseTheme,
        },
        faq: {
          layout_variant: ["accordion-card", "split-panels", "minimal-list", "stacked-cards"][slot],
          layout: ["accordion-card", "split-panels", "minimal-list", "stacked-cards"][slot],
          ...baseTheme,
        },
        process: {
          layout_variant: ["minimal-steps", "timeline", "numbered-cards", "split-list"][slot],
          layout: ["minimal-steps", "timeline", "numbered-cards", "split-list"][slot],
          ...baseTheme,
        },
        gallery: {
          layout_variant: ["masonry", "collage", "grid", "strip"][slot],
          layout: ["masonry", "collage", "grid", "strip"][slot],
          ...baseTheme,
        },
        feature_cards: {
          layout_variant: ["icon-panels", "card-grid", "minimal-tiles", "split-list"][slot],
          layout: ["icon-panels", "card-grid", "minimal-tiles", "split-list"][slot],
          ...baseTheme,
        },
        blog_index: {
          layout_variant: ["magazine", "editorial-list", "card-grid", "minimal-list"][slot],
          layout: ["magazine", "editorial-list", "card-grid", "minimal-list"][slot],
          ...baseTheme,
        },
        blog_post: {
          layout_variant: ["hero-lead", "classic-article", "split-aside", "minimal-prose"][slot],
          layout: ["hero-lead", "classic-article", "split-aside", "minimal-prose"][slot],
          ...baseTheme,
        },
        legal_content: {
          layout_variant: ["boxed-note", "classic-doc", "split-aside", "minimal-prose"][slot],
          layout: ["boxed-note", "classic-doc", "split-aside", "minimal-prose"][slot],
          ...baseTheme,
        },
        sticky_mobile_cta: {
          layout_variant: ["stacked-copy", "dual-pill", "single-primary", "split-label"][slot],
          layout: ["stacked-copy", "dual-pill", "single-primary", "split-label"][slot],
          background_color: "#1F4D2E",
          text_color: "#FFFFFF",
          primary_color: "#65A30D",
          secondary_color: "rgba(255,255,255,0.12)",
          border_color: "rgba(255,255,255,0.24)",
        },
        "site.footer": {
          layout_variant: ["split-brand", "four-column", "minimal-columns", "centered-stack"][slot],
          layout: ["split-brand", "four-column", "minimal-columns", "centered-stack"][slot],
          background_color: "#173A23",
          text_color: "#A8C2AE",
          heading_color: "#FFFFFF",
          accent_color: "#65A30D",
        },
      };

      const overrides = byType[normalizedType];
      if (!overrides) return block;
      return { ...block, props: { ...props, ...overrides } };
    }),
  };
}

export const ecoRenewablesTradePages = {
  home: withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeHomePage)),
  about: withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeAboutPage)),
  services: withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeServicesPage)),
  "service-detail": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeServiceDetailPage)),
  "areas-covered": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeAreasCoveredPage)),
  "area-detail": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeAreaDetailPage)),
  reviews: withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeReviewsPage)),
  gallery: withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeGalleryPage)),
  faq: withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeFaqPage)),
  contact: withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeContactPage)),
  "blog-index": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeBlogIndexPage)),
  "blog-post": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeBlogPostPage)),
  "privacy-policy": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradePrivacyPolicyPage)),
  "cookie-policy": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeCookiePolicyPage)),
  "terms-conditions": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeTermsConditionsPage)),
  "404": withStickyMobileCta(withEcoRenewablesStyleMix(ecoRenewablesTradeNotFoundPage)),
} satisfies Record<string, TemplatePage>;
