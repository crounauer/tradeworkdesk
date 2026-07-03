import type { TemplatePage } from "./TemplatePageRenderer";

const siteHeader = {
  type: "site.header",
  props: {
    logoText: "Professional Trade Services",
    navItems: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Services", href: "/services" },
      { label: "Areas", href: "/areas-covered" },
      { label: "Reviews", href: "/reviews" },
      { label: "Contact", href: "/contact" },
    ],
    phone: "01224 456789",
    ctaLabel: "Request a quote",
    ctaHref: "#contact",
  },
} as const;

const siteFooter = {
  type: "site.footer",
  props: {
    logoText: "Professional Trade Services",
    description:
      "Professional plumbing, heating and property maintenance support for homes, landlords and local businesses.",
    phone: "01224 456789",
    email: "hello@example.co.uk",
    navItems: [
      { label: "About", href: "/about" },
      { label: "Services", href: "/services" },
      { label: "Areas", href: "/areas-covered" },
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
    title: "Looking for a dependable local trade partner?",
    subtitle:
      "Speak with established local engineers for clear quotations, planned maintenance and responsive support.",
    primaryCtaLabel: "Request a quote",
    secondaryCtaLabel: "Call now",
    phone: "01224 456789",
  },
} as const;

const contactSplit = {
  type: "contact.split",
  props: {
    eyebrow: "Contact",
    title: "Arrange a visit or request a clear quotation",
    subtitle:
      "Tell us what you need and we will provide a practical next step and realistic timescale.",
    phone: "01224 456789",
    email: "hello@example.co.uk",
    address: "Aberdeen and Aberdeenshire",
    openingHours: "Monday to Friday, 8am to 5pm",
  },
} as const;

export const professionalTradeHomePage: TemplatePage = {
  title: "Home",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Established local engineers",
        title: "Reliable plumbing and heating services with a professional standard",
        subtitle:
          "Professional Trade Services helps homeowners, landlords and small businesses with clear advice, quality workmanship and well-managed service visits.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 456789",
        imageAlt: "Professional engineer carrying out planned heating maintenance",
      },
    },
    {
      type: "trust.badges",
      props: {
        badges: [
          {
            label: "Clear quotations",
            description:
              "Straightforward scope and pricing before work is scheduled.",
          },
          {
            label: "Planned maintenance",
            description:
              "Structured service support for homes, rentals and managed properties.",
          },
          {
            label: "Reliable delivery",
            description:
              "Professional communication from first enquiry to completion.",
          },
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Services",
        title: "Core services for local properties",
        subtitle:
          "A practical service structure suited to established plumbing, heating and maintenance businesses.",
        services: [
          {
            title: "Boiler servicing and maintenance",
            description:
              "Routine servicing and maintenance support to keep heating systems dependable.",
            href: "/services/boiler-servicing",
          },
          {
            title: "Heating and plumbing repairs",
            description:
              "Responsive diagnosis and repair work for heating and plumbing faults.",
            href: "/services/heating-plumbing-repairs",
          },
          {
            title: "System upgrades and renewals",
            description:
              "Planned upgrades, controls improvements and replacement system work.",
            href: "/services/system-upgrades",
          },
        ],
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Reviews",
        title: "What local customers value",
        reviews: [
          {
            quote:
              "Very professional communication and a clear quotation. The work was completed exactly as discussed.",
            name: "Customer",
            location: "Ellon",
            rating: 5,
          },
          {
            quote:
              "Helpful advice, tidy workmanship and a dependable team we can call again.",
            name: "Customer",
            location: "Inverurie",
            rating: 5,
          },
          {
            quote:
              "Excellent local service for our rental property maintenance schedule.",
            name: "Customer",
            location: "Aberdeen",
            rating: 5,
          },
        ],
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Areas covered",
        title: "Serving local towns and surrounding communities",
        subtitle:
          "Professional support across established service areas in the North East.",
        areas: [
          { name: "Ellon", href: "/areas/ellon" },
          { name: "Inverurie", href: "/areas/inverurie" },
          { name: "Peterhead", href: "/areas/peterhead" },
          { name: "Aberdeen", href: "/areas/aberdeen" },
          { name: "Oldmeldrum", href: "/areas/oldmeldrum" },
          { name: "Mintlaw", href: "/areas/mintlaw" },
        ],
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "FAQ",
        title: "Common questions before booking",
        faqs: [
          {
            question: "What type of work does this template support?",
            answer:
              "It suits plumbing, heating, electrical, renewables, building and property maintenance businesses.",
          },
          {
            question: "Can we include planned maintenance services?",
            answer:
              "Yes, the service pages and process blocks are structured for both reactive and planned work.",
          },
          {
            question: "Which areas are included in the sample content?",
            answer:
              "The starter content includes Ellon, Inverurie, Peterhead, Aberdeen, Oldmeldrum and Mintlaw.",
          },
        ],
      },
    },
    commonCta,
    contactSplit,
    siteFooter,
  ],
};

export const professionalTradeAboutPage: TemplatePage = {
  title: "About",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "About us",
        title: "An established local team focused on quality workmanship",
        subtitle:
          "Professional Trade Services is designed for businesses that want to present a polished, trustworthy service standard with clear communication.",
        primaryCtaLabel: "Get in touch",
        secondaryCtaLabel: "View services",
        phone: "01224 456789",
        imageAlt: "Professional local engineering team profile image",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Who we are",
        title: "Dependable support for homes, landlords and managed properties",
        body:
          "This sample content is tailored for a higher-end local service business with a structured approach to quotations, scheduling and delivery.",
        bullets: [
          "Reliable local engineers",
          "Clear quotations and sensible recommendations",
          "Professional standards across every visit",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Our approach",
        title: "Built around trust, clarity and consistency",
        subtitle:
          "A professional trade website should make service quality and communication standards obvious.",
        features: [
          {
            title: "Structured communication",
            description:
              "Customers receive clear updates on scope, scheduling and next steps.",
          },
          {
            title: "Practical recommendations",
            description:
              "Advice is based on property needs, lifecycle planning and long-term value.",
          },
          {
            title: "Quality workmanship",
            description:
              "Work is carried out carefully, cleanly and to a dependable standard.",
          },
          {
            title: "Local accountability",
            description:
              "An established local business depends on long-term trust and repeat custom.",
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const professionalTradeServicesPage: TemplatePage = {
  title: "Services",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Services",
        title: "Professional trade services with clear delivery standards",
        subtitle:
          "Use this structure to present your core services in a confident, well-organised format that supports local enquiries.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Ask a question",
        phone: "01224 456789",
        imageAlt: "Professional services overview image placeholder",
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Our services",
        title: "Choose a service",
        subtitle:
          "Each service can link to an editable detail page while keeping importer compatibility.",
        services: [
          {
            title: "Boiler servicing",
            description:
              "Routine servicing and planned maintenance for dependable heating performance.",
            href: "/services/boiler-servicing",
          },
          {
            title: "Heating and plumbing repairs",
            description:
              "Diagnosis and repair support for faults affecting comfort and reliability.",
            href: "/services/heating-plumbing-repairs",
          },
          {
            title: "Heating system upgrades",
            description:
              "Replacement equipment, control improvements and efficient upgrade plans.",
            href: "/services/heating-system-upgrades",
          },
          {
            title: "Electrical and renewables support",
            description:
              "Structured service pages for electrical and renewables-related project work.",
            href: "/services/electrical-renewables-support",
          },
          {
            title: "Property maintenance",
            description:
              "Ongoing maintenance support for landlords and managed residential portfolios.",
            href: "/services/property-maintenance",
          },
          {
            title: "Building and improvement works",
            description:
              "Planned improvement and adaptation work using the same enquiry-first journey.",
            href: "/services/building-improvements",
          },
        ],
      },
    },
    {
      type: "process.steps",
      props: {
        eyebrow: "How it works",
        title: "Simple from first enquiry to finished work",
        steps: [
          {
            title: "Share the requirement",
            description:
              "Tell us about the issue or planned project by phone or online enquiry.",
          },
          {
            title: "Receive a clear plan",
            description:
              "We explain scope, quotations and realistic scheduling before work begins.",
          },
          {
            title: "Work delivered professionally",
            description:
              "The job is completed with quality workmanship and clear follow-up guidance.",
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const professionalTradeServiceDetailPage: TemplatePage = {
  title: "Service Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Boiler servicing",
        title: "Boiler servicing delivered with a professional maintenance approach",
        subtitle:
          "A focused service detail page for setting expectations, explaining scope and supporting confident bookings.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View all services",
        phone: "01224 456789",
        imageAlt: "Planned boiler servicing visit image placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "What is included",
        title: "A structured visit with clear findings and recommendations",
        body:
          "This page format gives local service businesses room to explain maintenance standards, what checks are included and when follow-up work may be recommended.",
        bullets: [
          "Routine visual and operational checks",
          "Practical reporting on system condition",
          "Clear next-step recommendations where required",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Why book this service",
        title: "Practical benefits customers understand",
        subtitle:
          "The detail page should explain value in a clear and trustworthy way.",
        features: [
          {
            title: "Dependability",
            description:
              "Regular servicing helps identify avoidable issues before they become larger faults.",
          },
          {
            title: "Maintenance planning",
            description:
              "Customers can schedule future work with better visibility and fewer surprises.",
          },
          {
            title: "Performance confidence",
            description:
              "A maintained system is more likely to run reliably through seasonal demand.",
          },
          {
            title: "Clear documentation",
            description:
              "Findings and recommendations can be presented in straightforward terms.",
          },
        ],
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "Service questions",
        title: "Questions about this service",
        faqs: [
          {
            question: "How often should servicing be arranged?",
            answer:
              "Many customers book annual servicing, though timing depends on system type and usage.",
          },
          {
            question: "Can this page support other service types?",
            answer:
              "Yes, the same format works for plumbing, electrical, renewables and maintenance service details.",
          },
          {
            question: "Is this wording fixed?",
            answer:
              "No, all page copy is editable and intended as realistic sample content.",
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const professionalTradeAreasCoveredPage: TemplatePage = {
  title: "Areas Covered",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Areas covered",
        title: "Serving Aberdeen and Aberdeenshire with reliable local support",
        subtitle:
          "A clear area page helps customers confirm coverage quickly before requesting a quote.",
        primaryCtaLabel: "Check availability",
        secondaryCtaLabel: "Contact us",
        phone: "01224 456789",
        imageAlt: "Local coverage map placeholder",
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Service areas",
        title: "Towns and local areas we support",
        subtitle: "Each area can link to a dedicated local landing page.",
        areas: [
          { name: "Ellon", href: "/areas/ellon" },
          { name: "Inverurie", href: "/areas/inverurie" },
          { name: "Peterhead", href: "/areas/peterhead" },
          { name: "Aberdeen", href: "/areas/aberdeen" },
          { name: "Oldmeldrum", href: "/areas/oldmeldrum" },
          { name: "Mintlaw", href: "/areas/mintlaw" },
        ],
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const professionalTradeAreaDetailPage: TemplatePage = {
  title: "Area Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Ellon",
        title: "Professional plumbing and heating services in Ellon",
        subtitle:
          "A local landing page format for area-specific visibility while keeping content practical and trustworthy.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 456789",
        imageAlt: "Ellon local services image placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Local service",
        title: "Dependable support close to home",
        body:
          "Area pages like this can explain local availability, common project types and how nearby customers can arrange work.",
        bullets: [
          "Boiler servicing in Ellon",
          "Heating and plumbing repairs in nearby villages",
          "Support for homes, landlords and local businesses",
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Popular services",
        title: "Common work in this area",
        subtitle:
          "Area pages can highlight services most relevant to local customers.",
        services: [
          {
            title: "Boiler servicing",
            description:
              "Routine servicing and maintenance for dependable heating systems.",
            href: "/services/boiler-servicing",
          },
          {
            title: "Heating and plumbing repairs",
            description:
              "Responsive fault diagnosis and practical repair support.",
            href: "/services/heating-plumbing-repairs",
          },
          {
            title: "Heating upgrades",
            description:
              "Controls and system improvements for comfort and long-term value.",
            href: "/services/heating-upgrades",
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const professionalTradeReviewsPage: TemplatePage = {
  title: "Reviews",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Reviews",
        title: "Feedback from homeowners and property clients",
        subtitle:
          "A dedicated reviews page helps communicate trust, service quality and reliability.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Contact us",
        phone: "01224 456789",
        imageAlt: "Customer testimonials section image placeholder",
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Customer feedback",
        title: "What customers say about our service",
        reviews: [
          {
            quote:
              "Excellent communication and a professional team throughout our boiler replacement project.",
            name: "Customer",
            location: "Ellon",
            rating: 5,
          },
          {
            quote:
              "Clear quotation, tidy work and realistic scheduling. Very easy to work with.",
            name: "Customer",
            location: "Oldmeldrum",
            rating: 5,
          },
          {
            quote:
              "Reliable support for our managed properties and responsive follow-up when needed.",
            name: "Customer",
            location: "Mintlaw",
            rating: 5,
          },
          {
            quote:
              "The engineer explained options clearly and helped us choose the right maintenance plan.",
            name: "Customer",
            location: "Inverurie",
            rating: 5,
          },
          {
            quote:
              "Professional local business with consistent standards across every visit.",
            name: "Customer",
            location: "Peterhead",
            rating: 5,
          },
          {
            quote:
              "From enquiry to completion, everything was well organised and clearly communicated.",
            name: "Customer",
            location: "Aberdeen",
            rating: 5,
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const professionalTradeGalleryPage: TemplatePage = {
  title: "Gallery",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Gallery",
        title: "Examples of recent project and maintenance work",
        subtitle:
          "A gallery page helps present quality workmanship in a clear, credible format.",
        primaryCtaLabel: "Discuss a project",
        secondaryCtaLabel: "View services",
        phone: "01224 456789",
        imageAlt: "Project gallery hero image placeholder",
      },
    },
    {
      type: "gallery.grid",
      props: {
        eyebrow: "Recent work",
        title: "Project highlights",
        images: [
          {
            alt: "Boiler room maintenance image placeholder",
            caption: "Planned boiler and plant maintenance",
          },
          {
            alt: "Heating controls upgrade image placeholder",
            caption: "Heating controls and zoning upgrade",
          },
          {
            alt: "Property plumbing upgrade image placeholder",
            caption: "Property plumbing improvement works",
          },
          {
            alt: "Hot water system image placeholder",
            caption: "Hot water system repair and optimisation",
          },
          {
            alt: "Pipework installation image placeholder",
            caption: "Neat pipework installation and replacement",
          },
          {
            alt: "Commercial service image placeholder",
            caption: "Local small-business maintenance support",
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const professionalTradeFaqPage: TemplatePage = {
  title: "FAQ",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "FAQ",
        title: "Frequently asked questions",
        subtitle:
          "A practical FAQ section helps customers understand scope, scheduling and contact options before enquiring.",
        primaryCtaLabel: "Ask a question",
        secondaryCtaLabel: "Contact us",
        phone: "01224 456789",
        imageAlt: "Frequently asked questions hero image placeholder",
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "Common questions",
        title: "Helpful answers before you book",
        faqs: [
          {
            question: "Can this template be adapted for different trade businesses?",
            answer:
              "Yes, it can be adapted for plumbing, heating, electrical, renewables, building and property maintenance businesses.",
          },
          {
            question: "Can service and area lists be edited?",
            answer:
              "Yes, all service, area and page copy fields are editable after import.",
          },
          {
            question: "Can we use this for planned maintenance content?",
            answer:
              "Yes, the service and process blocks are well suited to planned maintenance journeys.",
          },
          {
            question: "Are blog and legal pages included?",
            answer:
              "Yes, this template includes blog index, blog post and standard legal page examples.",
          },
          {
            question: "Can customers contact by phone and enquiry form?",
            answer:
              "Yes, phone details are included throughout and contact sections support form placement.",
          },
        ],
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const professionalTradeContactPage: TemplatePage = {
  title: "Contact",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Contact",
        title: "Speak with a local professional about your project or repair",
        subtitle:
          "A focused contact page with room for phone, email, opening hours and enquiry form placement.",
        primaryCtaLabel: "Send an enquiry",
        secondaryCtaLabel: "Call now",
        phone: "01224 456789",
        imageAlt: "Contact page support image placeholder",
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const professionalTradeBlogIndexPage: TemplatePage = {
  title: "Blog Index",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Advice",
        title: "Practical guides for property owners and managers",
        subtitle:
          "A blog index for useful maintenance content, local advice and service planning guidance.",
        primaryCtaLabel: "View services",
        secondaryCtaLabel: "Contact us",
        phone: "01224 456789",
        imageAlt: "Advice blog index image placeholder",
      },
    },
    {
      type: "blog.index",
      props: {
        eyebrow: "Latest articles",
        title: "Recent guidance",
        posts: [
          {
            title: "Planning annual boiler maintenance",
            excerpt:
              "A practical guide to planning servicing and reducing avoidable downtime.",
            href: "/blog/planning-annual-boiler-maintenance",
            date: "18 June 2026",
          },
          {
            title: "Signs your heating system needs attention",
            excerpt:
              "Common warning signs that suggest a system check should be scheduled.",
            href: "/blog/signs-heating-system-needs-attention",
            date: "25 June 2026",
          },
          {
            title: "Creating a maintenance plan for rental properties",
            excerpt:
              "How landlords can structure maintenance visits for better reliability.",
            href: "/blog/rental-property-maintenance-plan",
            date: "2 July 2026",
          },
        ],
      },
    },
    siteFooter,
  ],
};

export const professionalTradeBlogPostPage: TemplatePage = {
  title: "Blog Post",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Maintenance advice",
        title: "Planning annual boiler maintenance",
        subtitle:
          "A sample article format for practical local service guidance with consistent page styling.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View services",
        phone: "01224 456789",
        imageAlt: "Boiler maintenance advice article image placeholder",
      },
    },
    {
      type: "legal.content",
      props: {
        title: "Planning annual boiler maintenance",
        updatedDate: "2 July 2026",
        sections: [
          {
            heading: "Why planned maintenance matters",
            body:
              "Planned servicing helps reduce avoidable faults, supports dependable performance and gives property owners a clearer maintenance schedule.",
          },
          {
            heading: "How often to schedule",
            body:
              "Many homes and managed properties use an annual service cycle, though timing should reflect system type and usage.",
          },
          {
            heading: "When to arrange an earlier check",
            body:
              "Recurring lockouts, unusual noises, reduced hot water performance or visible leaks should be reviewed sooner.",
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const professionalTradePrivacyPolicyPage: TemplatePage = {
  title: "Privacy Policy",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Privacy Policy",
        updatedDate: "2 July 2026",
        sections: [
          {
            heading: "Who operates this website",
            body:
              "This website is operated by the business identified on the site. Contact information is available on the contact page.",
          },
          {
            heading: "Information provided by visitors",
            body:
              "When an enquiry is submitted, the website may collect contact details and information about the requested work.",
          },
          {
            heading: "How information may be used",
            body:
              "Information is used to respond to enquiries, provide quotations, schedule work and support customers.",
          },
          {
            heading: "How long information may be kept",
            body:
              "Information should be retained only as long as required for legitimate business, legal or accounting purposes.",
          },
        ],
      },
    },
    siteFooter,
  ],
};

export const professionalTradeCookiePolicyPage: TemplatePage = {
  title: "Cookie Policy",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Cookie Policy",
        updatedDate: "2 July 2026",
        sections: [
          {
            heading: "What cookies are",
            body:
              "Cookies are small files used by websites to remember information and support core functionality.",
          },
          {
            heading: "How this site may use them",
            body:
              "Depending on final site settings, cookies may support essential features, analytics or similar functions.",
          },
          {
            heading: "Managing cookies",
            body:
              "Visitors can manage cookie preferences through browser settings or controls provided on the site.",
          },
        ],
      },
    },
    siteFooter,
  ],
};

export const professionalTradeTermsConditionsPage: TemplatePage = {
  title: "Terms Conditions",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Terms & Conditions",
        updatedDate: "2 July 2026",
        sections: [
          {
            heading: "Use of this website",
            body:
              "This website provides general information about the business, services and ways to make contact.",
          },
          {
            heading: "Quotations and availability",
            body:
              "Any prices, availability or timescales should be confirmed directly with the business before work is arranged.",
          },
          {
            heading: "Accuracy of content",
            body:
              "The business aims to keep information current, but service details and coverage may change over time.",
          },
        ],
      },
    },
    siteFooter,
  ],
};

export const professionalTradeNotFoundPage: TemplatePage = {
  title: "404",
  blocks: [
    siteHeader,
    {
      type: "system.notFound",
      props: {
        title: "Page not found",
        subtitle: "The page you requested may have moved or is no longer available.",
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

function withProfessionalStyleMix(page: TemplatePage): TemplatePage {
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
        accent_color: "#2563EB",
        heading_color: "#0F2942",
        body_color: "#4A6A88",
        border_color: "#C8D9EE",
        card_bg: "#FFFFFF",
        section_bg: "#F8FBFF",
      } as Record<string, unknown>;

      const byType: Record<string, Record<string, unknown>> = {
        hero: {
          layout: ["split", "centered", "full", "split"][slot],
          variant: ["modern", "default", "classic", "modern"][slot],
          heroStyle: ["modern", "default", "classic", "modern"][slot],
          tone: ["light", "default", "navy", "default"][slot],
          ...baseTheme,
        },
        cta: {
          layout_variant: ["split-inline", "center-banner", "stacked-card", "minimal-strip"][slot],
          layout: ["split-inline", "center-banner", "stacked-card", "minimal-strip"][slot],
          ...baseTheme,
        },
        services: {
          layout_variant: ["icon-panels", "card-grid", "compact-rows", "split-list"][slot],
          layout: ["icon-panels", "card-grid", "compact-rows", "split-list"][slot],
          ...baseTheme,
        },
        testimonials: {
          layout_variant: ["editorial-list", "card-grid", "spotlight", "compact-rows"][slot],
          layout: ["editorial-list", "card-grid", "spotlight", "compact-rows"][slot],
          ...baseTheme,
        },
        areas: {
          layout_variant: ["split-columns", "card-grid", "pill-cloud", "minimal-list"][slot],
          layout: ["split-columns", "card-grid", "pill-cloud", "minimal-list"][slot],
          ...baseTheme,
        },
        faq: {
          layout_variant: ["split-panels", "accordion-card", "stacked-cards", "minimal-list"][slot],
          layout: ["split-panels", "accordion-card", "stacked-cards", "minimal-list"][slot],
          ...baseTheme,
        },
        process: {
          layout_variant: ["timeline", "numbered-cards", "split-list", "minimal-steps"][slot],
          layout: ["timeline", "numbered-cards", "split-list", "minimal-steps"][slot],
          ...baseTheme,
        },
        project_showcase: {
          layout_variant: ["featured-split", "card-grid", "masonry-cards", "compact-list"][slot],
          layout: ["featured-split", "card-grid", "masonry-cards", "compact-list"][slot],
          ...baseTheme,
        },
        gallery: {
          layout_variant: ["grid", "masonry", "collage", "strip"][slot],
          layout: ["grid", "masonry", "collage", "strip"][slot],
          ...baseTheme,
        },
        feature_cards: {
          layout_variant: ["card-grid", "split-list", "icon-panels", "minimal-tiles"][slot],
          layout: ["card-grid", "split-list", "icon-panels", "minimal-tiles"][slot],
          ...baseTheme,
        },
        blog_index: {
          layout_variant: ["editorial-list", "card-grid", "magazine", "minimal-list"][slot],
          layout: ["editorial-list", "card-grid", "magazine", "minimal-list"][slot],
          ...baseTheme,
        },
        blog_post: {
          layout_variant: ["classic-article", "hero-lead", "split-aside", "minimal-prose"][slot],
          layout: ["classic-article", "hero-lead", "split-aside", "minimal-prose"][slot],
          ...baseTheme,
        },
        legal_content: {
          layout_variant: ["classic-doc", "split-aside", "boxed-note", "minimal-prose"][slot],
          layout: ["classic-doc", "split-aside", "boxed-note", "minimal-prose"][slot],
          ...baseTheme,
        },
        sticky_mobile_cta: {
          layout_variant: ["dual-pill", "stacked-copy", "split-label", "single-primary"][slot],
          layout: ["dual-pill", "stacked-copy", "split-label", "single-primary"][slot],
          background_color: "#0B3A6E",
          text_color: "#FFFFFF",
          primary_color: "#2563EB",
          secondary_color: "rgba(255,255,255,0.12)",
          border_color: "rgba(255,255,255,0.22)",
        },
        "site.footer": {
          layout_variant: ["four-column", "centered-stack", "split-brand", "minimal-columns"][slot],
          layout: ["four-column", "centered-stack", "split-brand", "minimal-columns"][slot],
          background_color: "#082B52",
          text_color: "#B9CCE3",
          heading_color: "#FFFFFF",
          accent_color: "#2563EB",
        },
      };

      const overrides = byType[normalizedType];
      if (!overrides) return block;
      return { ...block, props: { ...props, ...overrides } };
    }),
  };
}

export const professionalTradePages = {
  home: withStickyMobileCta(withProfessionalStyleMix(professionalTradeHomePage)),
  about: withStickyMobileCta(withProfessionalStyleMix(professionalTradeAboutPage)),
  services: withStickyMobileCta(withProfessionalStyleMix(professionalTradeServicesPage)),
  "service-detail": withStickyMobileCta(withProfessionalStyleMix(professionalTradeServiceDetailPage)),
  "areas-covered": withStickyMobileCta(withProfessionalStyleMix(professionalTradeAreasCoveredPage)),
  "area-detail": withStickyMobileCta(withProfessionalStyleMix(professionalTradeAreaDetailPage)),
  reviews: withStickyMobileCta(withProfessionalStyleMix(professionalTradeReviewsPage)),
  gallery: withStickyMobileCta(withProfessionalStyleMix(professionalTradeGalleryPage)),
  faq: withStickyMobileCta(withProfessionalStyleMix(professionalTradeFaqPage)),
  contact: withStickyMobileCta(withProfessionalStyleMix(professionalTradeContactPage)),
  "blog-index": withStickyMobileCta(withProfessionalStyleMix(professionalTradeBlogIndexPage)),
  "blog-post": withStickyMobileCta(withProfessionalStyleMix(professionalTradeBlogPostPage)),
  "privacy-policy": withStickyMobileCta(withProfessionalStyleMix(professionalTradePrivacyPolicyPage)),
  "cookie-policy": withStickyMobileCta(withProfessionalStyleMix(professionalTradeCookiePolicyPage)),
  "terms-conditions": withStickyMobileCta(withProfessionalStyleMix(professionalTradeTermsConditionsPage)),
  "404": withStickyMobileCta(withProfessionalStyleMix(professionalTradeNotFoundPage)),
} satisfies Record<string, TemplatePage>;
