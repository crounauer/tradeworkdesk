import type { TemplatePage } from "./TemplatePageRenderer";

const siteHeader = {
  type: "site.header",
  props: {
    logoText: "Bold Industrial Trade",
    navItems: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
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
    logoText: "Bold Industrial Trade",
    description:
      "Heavy-duty trade services for installations, repairs and planned maintenance across domestic and commercial sites.",
    phone: "01224 700900",
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
    title: "Need reliable engineers for demanding jobs?",
    subtitle:
      "Speak with a no-nonsense trade team for clear quotations, planned maintenance and responsive support.",
    primaryCtaLabel: "Request a quote",
    secondaryCtaLabel: "Call now",
    phone: "01224 700900",
  },
} as const;

const contactSplit = {
  type: "contact.split",
  props: {
    eyebrow: "Contact",
    title: "Arrange a visit or request a clear quotation",
    subtitle:
      "Tell us what you need and we will provide a practical next step and realistic timescale.",
    phone: "01224 700900",
    email: "hello@example.co.uk",
    address: "Aberdeen and Aberdeenshire",
    openingHours: "Monday to Friday, 8am to 5pm",
  },
} as const;

export const boldIndustrialTradeHomePage: TemplatePage = {
  title: "Home",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Industrial trade specialists",
        title: "Heavy-duty trade services for homes, sites and commercial premises",
        subtitle:
          "Bold Industrial Trade delivers practical installations, repairs and maintenance for heating, plumbing, electrical and renewables systems.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Engineer carrying out industrial heating maintenance",
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
              "Structured support for domestic, landlord and commercial maintenance schedules.",
          },
          {
            label: "Reliable delivery",
            description:
              "Direct communication from first enquiry to handover.",
          },
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Services",
        title: "Core services for demanding work",
        subtitle:
          "A practical service structure for heating engineers, plumbers, electricians, builders and renewables installers.",
        services: [
          {
            title: "Industrial and commercial boiler servicing",
            description:
              "Routine servicing and maintenance to keep heating systems reliable under heavy use.",
            href: "/services/boiler-servicing",
          },
          {
            title: "Heating and plumbing breakdown repairs",
            description:
              "Fast diagnosis and practical repair work for heating and plumbing faults.",
            href: "/services/heating-plumbing-repairs",
          },
          {
            title: "Plantroom upgrades and renewals",
            description:
              "Planned upgrades, controls improvements and replacement system work for older or hard-working sites.",
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
              "Clear quotation, solid workmanship and no unnecessary fuss from start to finish.",
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
              "Reliable support for our mixed domestic and light commercial maintenance schedule.",
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
          "Industrial-focused local support across established service areas in the North East.",
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
              "It suits heating engineers, oil engineers, plumbers, electricians, builders, renewables installers and industrial maintenance teams.",
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

export const boldIndustrialTradeAboutPage: TemplatePage = {
  title: "About",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "About us",
        title: "A robust local team built for demanding trade work",
        subtitle:
          "Bold Industrial Trade is designed for businesses that want to present practical capability, clear communication and reliable site delivery.",
        primaryCtaLabel: "Get in touch",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Local industrial engineering team profile image",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Who we are",
        title: "Dependable support for domestic and commercial customers",
        body:
          "This sample content is tailored for a hard-working local trade business with a structured approach to quotations, scheduling and delivery.",
        bullets: [
          "Reliable local engineers and site technicians",
          "Clear quotations and sensible recommendations",
          "Consistent standards across breakdowns, installs and maintenance",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Our approach",
        title: "Built around clarity, safety and completion",
        subtitle:
          "An industrial trade website should make capability and communication standards obvious.",
        features: [
          {
            title: "Structured communication",
            description:
              "Customers receive clear updates on scope, scheduling and next steps.",
          },
          {
            title: "Practical recommendations",
            description:
              "Advice is based on site conditions, lifecycle planning and long-term value.",
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

export const boldIndustrialTradeServicesPage: TemplatePage = {
  title: "Services",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Services",
        title: "Industrial trade services with clear delivery standards",
        subtitle:
          "Use this structure to present core services in a forceful, practical format that supports local enquiries.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Ask a question",
        phone: "01224 700900",
        imageAlt: "Industrial services overview image placeholder",
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
              "Routine servicing and planned maintenance for dependable heating performance on hard-working systems.",
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
            title: "Commercial and domestic maintenance",
            description:
              "Ongoing maintenance support for landlords, homeowners and commercial premises.",
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
            title: "Work delivered reliably",
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

export const boldIndustrialTradeServiceDetailPage: TemplatePage = {
  title: "Service Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Industrial heating maintenance",
        title: "Boiler and plantroom maintenance delivered with a practical site-first approach",
        subtitle:
          "A focused service detail page for setting expectations, defining scope and supporting confident bookings.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View all services",
        phone: "01224 700900",
        imageAlt: "Industrial boiler and plantroom maintenance visit image placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "What is included",
        title: "A structured visit with clear findings and recommendations",
        body:
          "This page format gives local trade businesses room to explain maintenance standards, what checks are included and when follow-up work is recommended.",
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

export const boldIndustrialTradeAreasCoveredPage: TemplatePage = {
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
        phone: "01224 700900",
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

export const boldIndustrialTradeAreaDetailPage: TemplatePage = {
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
        phone: "01224 700900",
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

export const boldIndustrialTradeReviewsPage: TemplatePage = {
  title: "Reviews",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Reviews",
        title: "Feedback from domestic and commercial clients",
        subtitle:
          "A dedicated reviews page helps communicate trust, practical delivery and reliability.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Contact us",
        phone: "01224 700900",
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
              "Excellent communication and a reliable team throughout our boiler replacement project.",
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
              "Reliable support for our managed properties and responsive follow-up when needed on site.",
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
              "Dependable local trade business with consistent standards across every visit.",
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

export const boldIndustrialTradeGalleryPage: TemplatePage = {
  title: "Gallery",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Gallery",
        title: "Examples of recent installs, repairs and maintenance work",
        subtitle:
          "A gallery page helps present hard-working trade capability in a clear, credible format.",
        primaryCtaLabel: "Discuss a project",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
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
            caption: "Planned boiler and plantroom maintenance",
          },
          {
            alt: "Heating controls upgrade image placeholder",
            caption: "Heating controls and zoning upgrade",
          },
          {
            alt: "Property plumbing upgrade image placeholder",
            caption: "Commercial and domestic plumbing improvement works",
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
            caption: "Local commercial maintenance support",
          },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const boldIndustrialTradeFaqPage: TemplatePage = {
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
        phone: "01224 700900",
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
              "Yes, it can be adapted for heating, oil, plumbing, electrical, renewables, building and industrial maintenance businesses.",
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

export const boldIndustrialTradeContactPage: TemplatePage = {
  title: "Contact",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Contact",
        title: "Speak with a local industrial trade team about your project or repair",
        subtitle:
          "A focused contact page with room for phone, email, opening hours and enquiry form placement for urgent or planned work.",
        primaryCtaLabel: "Send an enquiry",
        secondaryCtaLabel: "Call now",
        phone: "01224 700900",
        imageAlt: "Contact page support image placeholder",
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const boldIndustrialTradeBlogIndexPage: TemplatePage = {
  title: "Blog Index",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Advice",
        title: "Practical guides for homeowners, landlords and site managers",
        subtitle:
          "A blog index for useful industrial maintenance content, local advice and service planning guidance.",
        primaryCtaLabel: "View services",
        secondaryCtaLabel: "Contact us",
        phone: "01224 700900",
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
            title: "Planning annual plantroom and boiler maintenance",
            excerpt:
              "A practical guide to planning servicing and reducing avoidable downtime on hard-working systems.",
            href: "/blog/planning-annual-plantroom-boiler-maintenance",
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
            title: "Creating a maintenance plan for mixed domestic and commercial properties",
            excerpt:
              "How landlords and site managers can structure maintenance visits for better reliability.",
            href: "/blog/mixed-property-maintenance-plan",
            date: "2 July 2026",
          },
        ],
      },
    },
    siteFooter,
  ],
};

export const boldIndustrialTradeBlogPostPage: TemplatePage = {
  title: "Blog Post",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Maintenance advice",
        title: "Planning annual plantroom and boiler maintenance",
        subtitle:
          "A sample article format for practical industrial trade guidance with consistent page styling.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View services",
        phone: "01224 700900",
        imageAlt: "Plantroom and boiler maintenance advice article image placeholder",
      },
    },
    {
      type: "legal.content",
      props: {
        title: "Planning annual plantroom and boiler maintenance",
        updatedDate: "2 July 2026",
        sections: [
          {
            heading: "Why planned maintenance matters",
            body:
              "Planned servicing helps reduce avoidable faults, supports dependable performance and gives property owners and site managers a clearer maintenance schedule.",
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

export const boldIndustrialTradePrivacyPolicyPage: TemplatePage = {
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

export const boldIndustrialTradeCookiePolicyPage: TemplatePage = {
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

export const boldIndustrialTradeTermsConditionsPage: TemplatePage = {
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

export const boldIndustrialTradeNotFoundPage: TemplatePage = {
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

const expandedDemoBlocksByPageTitle: Record<string, Array<{ type: string; props: Record<string, unknown> }>> = {
  Home: [
    {
      type: "features_bar",
      props: {
        background_color: "#0d9488",
        text_color: "#ffffff",
        items: [
          { icon: "⚡", title: "Fast response", description: "We reply quickly and keep communication clear." },
          { icon: "✅", title: "Qualified engineers", description: "Skilled local professionals for planned and reactive work." },
          { icon: "🏆", title: "Trusted service", description: "Dependable workmanship and practical advice." },
        ],
      },
    },
    {
      type: "brands",
      props: {
        heading: "Brands we work with",
        brands: [
          { name: "Vaillant", logo_url: "" },
          { name: "Worcester Bosch", logo_url: "" },
        ],
        layout_variant: "logo-cloud",
      },
    },
    {
      type: "spacer",
      props: { height: "md" },
    },
  ],
  About: [
    {
      type: "why_choose_us",
      props: {
        heading: "Why choose us",
        subheading: "A practical local service built around reliability and communication.",
        items: [
          { title: "Clear advice", description: "Straight answers before any work is booked.", icon: "🧭" },
          { title: "Tidy workmanship", description: "Careful work standards across every visit.", icon: "🛠️" },
          { title: "Local accountability", description: "A local team with a reputation to protect.", icon: "📍" },
        ],
        layout_variant: "card-grid",
      },
    },
  ],
  Services: [
    {
      type: "image",
      props: {
        image_url: "",
        alt_text: "Service image",
        caption: "",
        width: "full",
      },
    },
    {
      type: "project_showcase",
      props: {
        heading: "Recent project",
        projects: [
          {
            title: "Recent installation",
            location: "Aberdeenshire",
            image_url: "",
            description: "A sample case study block for showcasing completed work.",
            cta_text: "Request a quote",
            cta_url: "/contact",
          },
        ],
      },
    },
  ],
  Contact: [
    {
      type: "online_booking",
      props: {
        heading: "Book an appointment",
        subheading: "Choose a service and request a convenient slot.",
        require_postcode: true,
        require_description: true,
        show_price: true,
        complex_keywords: "repair,breakdown,fault,emergency,not working,no hot water,leak",
      },
    },
    {
      type: "contact_form",
      props: {
        heading: "Send an enquiry",
        subheading: "Tell us what you need and we will get back to you shortly.",
      },
    },
  ],
  "Blog Post": [
    {
      type: "blog.post",
      props: {
        heading: "Blog Post",
        subheading: "",
        html: "<p>Write your article content here.</p>",
        layout_variant: "classic-article",
      },
    },
  ],
};

function withExpandedDemoBlocks(page: TemplatePage): TemplatePage {
  const additions = expandedDemoBlocksByPageTitle[page.title] || [];
  if (!additions.length) return page;

  const blocks = [...page.blocks];
  const existing = new Set(
    blocks.map((block) => String(block.type || block.block_type || "").trim().toLowerCase())
  );
  const insertAt = Math.max(blocks.length - 1, 0);

  additions.forEach((addition) => {
    const normalized = addition.type.toLowerCase();
    if (existing.has(normalized)) return;
    blocks.splice(insertAt, 0, { type: addition.type, props: addition.props });
    existing.add(normalized);
  });

  return { ...page, blocks };
}

function withStickyMobileCta(page: TemplatePage): TemplatePage {
  const expanded = withExpandedDemoBlocks(page);
  const hasSticky = expanded.blocks.some((block) => String(block.type || block.block_type || "").trim().toLowerCase() === "sticky_mobile_cta");
  if (hasSticky) return expanded;
  return { ...expanded, blocks: [...expanded.blocks, stickyMobileCta] };
}

function withBoldIndustrialStyleMix(page: TemplatePage): TemplatePage {
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
        accent_color: "#F97316",
        heading_color: "#111827",
        body_color: "#7C5A3B",
        border_color: "#F5CBA7",
        card_bg: "#FFFFFF",
        section_bg: "#FFF7ED",
      } as Record<string, unknown>;

      const byType: Record<string, Record<string, unknown>> = {
        hero: {
          layout: ["full", "split", "centered", "full"][slot],
          variant: ["modern", "classic", "default", "modern"][slot],
          heroStyle: ["modern", "classic", "default", "modern"][slot],
          tone: ["navy", "default", "light", "default"][slot],
          ...baseTheme,
        },
        cta: {
          layout_variant: ["stacked-card", "split-inline", "center-banner", "minimal-strip"][slot],
          layout: ["stacked-card", "split-inline", "center-banner", "minimal-strip"][slot],
          ...baseTheme,
        },
        services: {
          layout_variant: ["compact-rows", "icon-panels", "card-grid", "split-list"][slot],
          layout: ["compact-rows", "icon-panels", "card-grid", "split-list"][slot],
          ...baseTheme,
        },
        testimonials: {
          layout_variant: ["spotlight", "compact-rows", "card-grid", "editorial-list"][slot],
          layout: ["spotlight", "compact-rows", "card-grid", "editorial-list"][slot],
          ...baseTheme,
        },
        areas: {
          layout_variant: ["card-grid", "split-columns", "pill-cloud", "minimal-list"][slot],
          layout: ["card-grid", "split-columns", "pill-cloud", "minimal-list"][slot],
          ...baseTheme,
        },
        faq: {
          layout_variant: ["stacked-cards", "split-panels", "accordion-card", "minimal-list"][slot],
          layout: ["stacked-cards", "split-panels", "accordion-card", "minimal-list"][slot],
          ...baseTheme,
        },
        process: {
          layout_variant: ["numbered-cards", "timeline", "split-list", "minimal-steps"][slot],
          layout: ["numbered-cards", "timeline", "split-list", "minimal-steps"][slot],
          ...baseTheme,
        },
        project_showcase: {
          layout_variant: ["masonry-cards", "featured-split", "card-grid", "compact-list"][slot],
          layout: ["masonry-cards", "featured-split", "card-grid", "compact-list"][slot],
          ...baseTheme,
        },
        gallery: {
          layout_variant: ["collage", "strip", "grid", "masonry"][slot],
          layout: ["collage", "strip", "grid", "masonry"][slot],
          ...baseTheme,
        },
        feature_cards: {
          layout_variant: ["minimal-tiles", "icon-panels", "card-grid", "split-list"][slot],
          layout: ["minimal-tiles", "icon-panels", "card-grid", "split-list"][slot],
          ...baseTheme,
        },
        blog_index: {
          layout_variant: ["magazine", "card-grid", "editorial-list", "minimal-list"][slot],
          layout: ["magazine", "card-grid", "editorial-list", "minimal-list"][slot],
          ...baseTheme,
        },
        blog_post: {
          layout_variant: ["hero-lead", "split-aside", "classic-article", "minimal-prose"][slot],
          layout: ["hero-lead", "split-aside", "classic-article", "minimal-prose"][slot],
          ...baseTheme,
        },
        legal_content: {
          layout_variant: ["boxed-note", "split-aside", "classic-doc", "minimal-prose"][slot],
          layout: ["boxed-note", "split-aside", "classic-doc", "minimal-prose"][slot],
          ...baseTheme,
        },
        sticky_mobile_cta: {
          layout_variant: ["dual-pill", "split-label", "stacked-copy", "single-primary"][slot],
          layout: ["dual-pill", "split-label", "stacked-copy", "single-primary"][slot],
          background_color: "#111827",
          text_color: "#FFFFFF",
          primary_color: "#F97316",
          secondary_color: "rgba(255,255,255,0.1)",
          border_color: "rgba(255,255,255,0.24)",
        },
        "site.footer": {
          layout_variant: ["split-brand", "four-column", "centered-stack", "minimal-columns"][slot],
          layout: ["split-brand", "four-column", "centered-stack", "minimal-columns"][slot],
          background_color: "#0B1220",
          text_color: "#C9D2E0",
          heading_color: "#FFFFFF",
          accent_color: "#F97316",
        },
      };

      const overrides = byType[normalizedType];
      if (!overrides) return block;
      return { ...block, props: { ...props, ...overrides } };
    }),
  };
}

export const boldIndustrialTradePages = {
  home: withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeHomePage)),
  about: withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeAboutPage)),
  services: withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeServicesPage)),
  "service-detail": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeServiceDetailPage)),
  "areas-covered": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeAreasCoveredPage)),
  "area-detail": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeAreaDetailPage)),
  reviews: withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeReviewsPage)),
  gallery: withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeGalleryPage)),
  faq: withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeFaqPage)),
  contact: withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeContactPage)),
  "blog-index": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeBlogIndexPage)),
  "blog-post": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeBlogPostPage)),
  "privacy-policy": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradePrivacyPolicyPage)),
  "cookie-policy": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeCookiePolicyPage)),
  "terms-conditions": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeTermsConditionsPage)),
  "404": withStickyMobileCta(withBoldIndustrialStyleMix(boldIndustrialTradeNotFoundPage)),
} satisfies Record<string, TemplatePage>;
