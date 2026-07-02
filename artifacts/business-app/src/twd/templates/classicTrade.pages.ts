import type { TemplatePage } from "./TemplatePageRenderer";

const siteHeader = {
  type: "site.header",
  props: {
    logoText: "Classic Trade Services",
    navItems: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Services", href: "/services" },
      { label: "Areas", href: "/areas-covered" },
      { label: "Reviews", href: "/reviews" },
      { label: "Contact", href: "/contact" },
    ],
    phone: "01224 123456",
    ctaLabel: "Request a quote",
    ctaHref: "#contact",
  },
} as const;

const siteFooter = {
  type: "site.footer",
  props: {
    logoText: "Classic Trade Services",
    description: "Reliable plumbing, heating and property service support from an established local trade business.",
    phone: "01224 123456",
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
    title: "Need dependable help from a local trade business?",
    subtitle: "Speak to experienced local engineers for practical advice, clear quotations and well-organised work.",
    primaryCtaLabel: "Request a quote",
    secondaryCtaLabel: "Call now",
    phone: "01224 123456",
  },
} as const;

const contactSplit = {
  type: "contact.split",
  props: {
    eyebrow: "Contact",
    title: "Arrange a visit or request a quotation",
    subtitle: "Tell us about the work required and we will come back with a clear next step.",
    phone: "01224 123456",
    email: "hello@example.co.uk",
    address: "Aberdeen and Aberdeenshire",
    openingHours: "Monday to Friday, 8am to 5pm",
  },
} as const;

export const classicTradeHomePage: TemplatePage = {
  title: "Home",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Established local trade business",
        title: "Reliable plumbing and heating services for homes and small properties",
        subtitle:
          "Classic Trade Services helps homeowners, landlords and local businesses with dependable plumbing, heating and repair work delivered with clear communication.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 123456",
        imageAlt: "Local engineer carrying out plumbing and heating work",
      },
    },
    {
      type: "trust.badges",
      props: {
        badges: [
          { label: "Local engineers", description: "Serving customers across Aberdeen and Aberdeenshire with practical support." },
          { label: "Clear quotations", description: "Straightforward pricing and sensible recommendations before work starts." },
          { label: "Established service", description: "A professional, dependable approach suited to homes, landlords and local businesses." },
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Services",
        title: "Practical support across core trade services",
        subtitle: "Structured service pages for the work local customers ask about most often.",
        services: [
          { title: "Boiler servicing", description: "Routine servicing to help keep heating systems dependable and efficient.", href: "/services/boiler-servicing" },
          { title: "Plumbing repairs", description: "Responsive help with leaks, pipework faults and common household plumbing issues.", href: "/services/plumbing-repairs" },
          { title: "Heating installations", description: "Replacement heating equipment, controls and system improvement work.", href: "/services/heating-installations" },
        ],
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Reviews",
        title: "What local customers appreciate",
        reviews: [
          { quote: "Professional from the first call to the finished job, with everything explained clearly.", name: "Customer", location: "Ellon", rating: 5 },
          { quote: "The quotation was straightforward and the work was completed carefully and on time.", name: "Customer", location: "Inverurie", rating: 5 },
          { quote: "Reliable local service and good communication throughout.", name: "Customer", location: "Aberdeen", rating: 5 },
        ],
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Areas covered",
        title: "Supporting customers across local towns and surrounding areas",
        subtitle: "Ideal for trade businesses serving established local catchments.",
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
          { question: "What type of work can this site structure cover?", answer: "The template suits plumbing, heating, electrical, roofing, building and similar local service trades." },
          { question: "Can customers request quotations online?", answer: "Yes, the contact section can support online enquiries alongside phone-first bookings." },
          { question: "Which areas are shown by default?", answer: "The sample content covers Ellon, Inverurie, Peterhead, Aberdeen, Oldmeldrum and Mintlaw." },
        ],
      },
    },
    commonCta,
    contactSplit,
    siteFooter,
  ],
};

export const classicTradeAboutPage: TemplatePage = {
  title: "About",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "About us",
        title: "A traditional service approach built around clear communication",
        subtitle:
          "Classic Trade Services is designed for established local businesses that want to present dependable workmanship, sensible advice and a professional customer experience.",
        primaryCtaLabel: "Get in touch",
        secondaryCtaLabel: "View services",
        phone: "01224 123456",
        imageAlt: "Local service business team profile placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Who we are",
        title: "Professional support for homes, landlords and local businesses",
        body:
          "This sample content is intended for a practical trade business with a more formal tone than the Modern Trade template. It emphasises reliability, clear expectations and good local service.",
        bullets: [
          "Dependable local service",
          "Clear quotations and practical recommendations",
          "Work organised with care and professionalism",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Our approach",
        title: "What customers expect from an established local business",
        subtitle: "The focus is on trust, clarity and work carried out properly.",
        features: [
          { title: "Clear communication", description: "Customers understand the work required, the likely cost and the next step." },
          { title: "Practical solutions", description: "Recommendations are based on the property, the problem and the customer's priorities." },
          { title: "Professional conduct", description: "Visits are organised properly and work areas are treated with respect." },
          { title: "Local accountability", description: "A business serving the local area depends on reputation and repeat custom." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const classicTradeServicesPage: TemplatePage = {
  title: "Services",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Services",
        title: "Well-structured service pages for a local trade website",
        subtitle:
          "Use this layout to present core services clearly, with enough detail to help customers understand what is offered and how to enquire.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Ask a question",
        phone: "01224 123456",
        imageAlt: "Classic trade services image placeholder",
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Our services",
        title: "Choose a service",
        subtitle: "Each service can link to an editable detail page using the same importer-compatible structure.",
        services: [
          { title: "Boiler servicing", description: "Routine servicing to help keep heating systems dependable and efficient.", href: "/services/boiler-servicing" },
          { title: "Heating repairs", description: "Fault finding and repair work when heating or hot water performance drops.", href: "/services/heating-repairs" },
          { title: "Boiler installations", description: "Replacement boiler work and planned heating improvements for suitable properties.", href: "/services/boiler-installations" },
          { title: "General plumbing", description: "Repairs, replacements and practical plumbing support for homes and rentals.", href: "/services/general-plumbing" },
          { title: "Bathrooms and upgrades", description: "Small upgrade work and practical improvements where needed.", href: "/services/bathroom-upgrades" },
          { title: "Landlord maintenance", description: "Ongoing property support and maintenance-focused service content.", href: "/services/landlord-maintenance" },
        ],
      },
    },
    {
      type: "process.steps",
      props: {
        eyebrow: "How it works",
        title: "Simple and well organised from first enquiry to completion",
        steps: [
          { title: "Tell us about the work", description: "Explain the issue or the planned job by phone or through the enquiry form." },
          { title: "Receive clear advice", description: "The likely next step, visit requirements and quotation process are explained properly." },
          { title: "Work completed carefully", description: "Jobs are carried out with a practical, professional approach and clear follow-up where needed." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const classicTradeServiceDetailPage: TemplatePage = {
  title: "Service Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Boiler servicing",
        title: "Boiler servicing with a careful, professional approach",
        subtitle:
          "A dedicated service page for explaining what is included, the type of customer it suits and how bookings can be arranged.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View all services",
        phone: "01224 123456",
        imageAlt: "Boiler servicing detail page placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "What is included",
        title: "A straightforward visit with sensible checks and clear advice",
        body:
          "This page format gives a local trade business room to explain the service clearly, outline expectations and help customers understand when booking is appropriate.",
        bullets: [
          "Routine visual and operational checks",
          "Advice on condition, wear and likely maintenance needs",
          "Clear explanation of any follow-up work recommended",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Why it matters",
        title: "Useful reasons customers book regular servicing",
        subtitle: "The aim is to explain value in a practical and trustworthy way.",
        features: [
          { title: "Dependability", description: "Regular checks can help reduce the likelihood of avoidable breakdowns." },
          { title: "Better system awareness", description: "Customers receive a clearer view of the condition and maintenance needs of the system." },
          { title: "Planned maintenance", description: "Potential issues may be identified early enough for sensible planned work." },
          { title: "Clear quotations", description: "Any additional recommendations can be discussed and quoted clearly." },
        ],
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "Service questions",
        title: "Questions about this service",
        faqs: [
          { question: "How often should servicing be arranged?", answer: "Many customers book annual servicing, but timing depends on the equipment, usage and manufacturer guidance." },
          { question: "Can this page be adapted for other trades?", answer: "Yes, the same structure can support electrical, roofing, building or other service-detail content." },
          { question: "Is this sample wording fixed?", answer: "No, page copy is editable and intended as realistic starter content." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const classicTradeAreasCoveredPage: TemplatePage = {
  title: "Areas Covered",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Areas covered",
        title: "Serving customers across Aberdeen and Aberdeenshire",
        subtitle:
          "A clear coverage page helps local customers see whether the business works in their town, village or nearby area.",
        primaryCtaLabel: "Check availability",
        secondaryCtaLabel: "Contact us",
        phone: "01224 123456",
        imageAlt: "Coverage area map placeholder",
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Service areas",
        title: "Towns and local areas we can feature",
        subtitle: "Each area can link to an editable local landing page.",
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

export const classicTradeAreaDetailPage: TemplatePage = {
  title: "Area Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Ellon",
        title: "Plumbing and heating services in Ellon",
        subtitle:
          "A local landing page format for targeting service searches in a specific town while keeping the content practical and trustworthy.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 123456",
        imageAlt: "Ellon local service area placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Local service",
        title: "Dependable local support close to home",
        body:
          "Area pages like this give the business a way to explain local availability, common job types and how nearby customers can get in touch.",
        bullets: [
          "Boiler servicing in Ellon",
          "Plumbing repairs in nearby villages",
          "Support for homeowners, landlords and small local properties",
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Popular services",
        title: "Common work in this area",
        subtitle: "Area pages can highlight the services most relevant to local customers.",
        services: [
          { title: "Boiler servicing", description: "Routine servicing for dependable household heating.", href: "/services/boiler-servicing" },
          { title: "Plumbing repairs", description: "Leaks, faulty fittings and common plumbing issues resolved carefully.", href: "/services/plumbing-repairs" },
          { title: "Heating upgrades", description: "Controls, improvements and planned upgrade work where suitable.", href: "/services/heating-upgrades" },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const classicTradeReviewsPage: TemplatePage = {
  title: "Reviews",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Reviews",
        title: "Feedback from local customers",
        subtitle:
          "A dedicated reviews page helps a trade business demonstrate trust, professionalism and good communication.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Contact us",
        phone: "01224 123456",
        imageAlt: "Customer feedback page placeholder",
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Customer feedback",
        title: "What customers say about the service",
        reviews: [
          { quote: "Good communication, a sensible quotation and tidy workmanship.", name: "Customer", location: "Ellon", rating: 5 },
          { quote: "They turned up when arranged and kept us updated throughout the job.", name: "Customer", location: "Oldmeldrum", rating: 5 },
          { quote: "A professional local business and easy to deal with from start to finish.", name: "Customer", location: "Mintlaw", rating: 5 },
          { quote: "The advice was practical and the work was completed without fuss.", name: "Customer", location: "Inverurie", rating: 5 },
          { quote: "Straightforward service and clear explanation of the options available.", name: "Customer", location: "Peterhead", rating: 5 },
          { quote: "Reliable and well organised, which is exactly what we were looking for.", name: "Customer", location: "Aberdeen", rating: 5 },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const classicTradeGalleryPage: TemplatePage = {
  title: "Gallery",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Gallery",
        title: "Examples of completed work",
        subtitle:
          "A gallery page helps a trade business show the type of work it carries out while keeping the site structure simple.",
        primaryCtaLabel: "Discuss a job",
        secondaryCtaLabel: "View services",
        phone: "01224 123456",
        imageAlt: "Recent project gallery placeholder",
      },
    },
    {
      type: "gallery.grid",
      props: {
        eyebrow: "Recent work",
        title: "Sample project highlights",
        images: [
          { alt: "Boiler cupboard installation placeholder", caption: "Replacement boiler installation" },
          { alt: "New radiator fitting placeholder", caption: "Heating system improvement work" },
          { alt: "Pipework maintenance placeholder", caption: "Neat repair and maintenance work" },
          { alt: "Bathroom plumbing placeholder", caption: "Bathroom plumbing upgrades" },
          { alt: "Hot water cylinder placeholder", caption: "Cylinder and hot water system work" },
          { alt: "Plant room service placeholder", caption: "Planned servicing and plant maintenance" },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const classicTradeFaqPage: TemplatePage = {
  title: "FAQ",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "FAQ",
        title: "Frequently asked questions",
        subtitle:
          "A practical FAQ page helps answer routine questions and keeps the tone clear and professional.",
        primaryCtaLabel: "Ask a question",
        secondaryCtaLabel: "Contact us",
        phone: "01224 123456",
        imageAlt: "Frequently asked questions placeholder",
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "Common questions",
        title: "Helpful answers before you book",
        faqs: [
          { question: "Can this template be adapted for different trades?", answer: "Yes, the same block structure can support plumbers, heating engineers, electricians, roofers, builders and other local service trades." },
          { question: "Can areas be changed?", answer: "Yes, towns, villages and local coverage pages are editable sample content." },
          { question: "Can I replace the sample quotations and wording?", answer: "Yes, the importer-compatible package keeps all block props editable." },
          { question: "Does the template support blog and legal pages?", answer: "Yes, it includes blog index, blog post and standard legal page examples using the same working format." },
          { question: "Is phone-first contact supported?", answer: "Yes, phone details appear throughout the sample content and can be edited later." },
        ],
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const classicTradeContactPage: TemplatePage = {
  title: "Contact",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Contact",
        title: "Speak to a local trade business about your project or repair",
        subtitle:
          "A focused contact page with space for phone, email, opening hours and the enquiry form placement used by TWD.",
        primaryCtaLabel: "Send an enquiry",
        secondaryCtaLabel: "Call now",
        phone: "01224 123456",
        imageAlt: "Contact page image placeholder",
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const classicTradeBlogIndexPage: TemplatePage = {
  title: "Blog Index",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Advice",
        title: "Useful guides for homeowners and property managers",
        subtitle:
          "A blog index provides space for helpful articles, seasonal advice and service-related guidance.",
        primaryCtaLabel: "View services",
        secondaryCtaLabel: "Contact us",
        phone: "01224 123456",
        imageAlt: "Advice blog page placeholder",
      },
    },
    {
      type: "blog.index",
      props: {
        eyebrow: "Latest articles",
        title: "Recent advice and maintenance guidance",
        posts: [
          { title: "When should a boiler be serviced?", excerpt: "A straightforward guide to planning routine servicing and avoiding preventable issues.", href: "/blog/when-to-service-a-boiler", date: "12 June 2026" },
          { title: "Common signs of a plumbing issue at home", excerpt: "What to look out for before a minor problem becomes a larger repair.", href: "/blog/signs-of-a-plumbing-issue", date: "19 June 2026" },
          { title: "Planning heating improvements for older properties", excerpt: "Practical considerations when upgrading controls, radiators or ageing equipment.", href: "/blog/heating-improvements-for-older-properties", date: "26 June 2026" },
        ],
      },
    },
    siteFooter,
  ],
};

export const classicTradeBlogPostPage: TemplatePage = {
  title: "Blog Post",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Home maintenance advice",
        title: "When should a boiler be serviced?",
        subtitle:
          "A sample blog post structure for helpful local service content that stays consistent with the rest of the template.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View services",
        phone: "01224 123456",
        imageAlt: "Boiler servicing advice article placeholder",
      },
    },
    {
      type: "legal.content",
      props: {
        title: "When should a boiler be serviced?",
        updatedDate: "26 June 2026",
        sections: [
          { heading: "Why routine servicing matters", body: "Routine servicing can help identify wear, maintain dependable performance and give homeowners a clearer picture of the condition of their heating system." },
          { heading: "How often is typical", body: "Many households book annual servicing, although the right timing depends on the equipment, usage pattern and manufacturer guidance." },
          { heading: "When to ask for advice sooner", body: "Unusual noises, recurring lockouts, poor heating performance or visible leaks should be looked at promptly rather than left to worsen." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const classicTradePrivacyPolicyPage: TemplatePage = {
  title: "Privacy Policy",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Privacy Policy",
        updatedDate: "26 June 2026",
        sections: [
          { heading: "Who operates this website", body: "This website is operated by the business identified on the site. Contact details are available on the contact page." },
          { heading: "Information provided by visitors", body: "When an enquiry is submitted, the website may collect contact details and information about the work requested." },
          { heading: "How the information may be used", body: "Information is used to respond to enquiries, arrange work, provide quotations and support customers." },
          { heading: "How long information may be kept", body: "Information should only be retained for as long as needed for legitimate business, legal or accounting purposes." },
        ],
      },
    },
    siteFooter,
  ],
};

export const classicTradeCookiePolicyPage: TemplatePage = {
  title: "Cookie Policy",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Cookie Policy",
        updatedDate: "26 June 2026",
        sections: [
          { heading: "What cookies are", body: "Cookies are small files used by websites to remember information and support basic functionality." },
          { heading: "How this site may use them", body: "Depending on the final website setup, cookies may support essential features, visitor analytics or similar functions." },
          { heading: "Managing cookies", body: "Visitors can control cookies through browser settings or any controls that may be provided on the website." },
        ],
      },
    },
    siteFooter,
  ],
};

export const classicTradeTermsConditionsPage: TemplatePage = {
  title: "Terms Conditions",
  blocks: [
    siteHeader,
    {
      type: "legal.content",
      props: {
        title: "Terms & Conditions",
        updatedDate: "26 June 2026",
        sections: [
          { heading: "Use of this website", body: "This website provides general information about the business, its services and ways to get in touch." },
          { heading: "Quotations and availability", body: "Any prices, availability or timescales should be confirmed directly with the business before work is arranged." },
          { heading: "Accuracy of content", body: "The business aims to keep information current, although service details and coverage may change over time." },
        ],
      },
    },
    siteFooter,
  ],
};

export const classicTradeNotFoundPage: TemplatePage = {
  title: "404",
  blocks: [
    siteHeader,
    {
      type: "system.notFound",
      props: {
        title: "Page not found",
        subtitle: "The page you were looking for may have moved or no longer be available.",
        ctaLabel: "Return home",
        ctaHref: "/",
      },
    },
    siteFooter,
  ],
};

export const classicTradePages = {
  home: classicTradeHomePage,
  about: classicTradeAboutPage,
  services: classicTradeServicesPage,
  "service-detail": classicTradeServiceDetailPage,
  "areas-covered": classicTradeAreasCoveredPage,
  "area-detail": classicTradeAreaDetailPage,
  reviews: classicTradeReviewsPage,
  gallery: classicTradeGalleryPage,
  faq: classicTradeFaqPage,
  contact: classicTradeContactPage,
  "blog-index": classicTradeBlogIndexPage,
  "blog-post": classicTradeBlogPostPage,
  "privacy-policy": classicTradePrivacyPolicyPage,
  "cookie-policy": classicTradeCookiePolicyPage,
  "terms-conditions": classicTradeTermsConditionsPage,
  "404": classicTradeNotFoundPage,
} satisfies Record<string, TemplatePage>;