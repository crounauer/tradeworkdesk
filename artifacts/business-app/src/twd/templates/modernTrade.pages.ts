import type { TemplatePage } from "./TemplatePageRenderer";

const siteHeader = {
  type: "site.header",
  props: {
    logoText: "North East Eco Heat",
    navItems: [
      { label: "Home", href: "/" },
      { label: "Services", href: "/services" },
      { label: "Areas", href: "/areas-covered" },
      { label: "Reviews", href: "/reviews" },
      { label: "Contact", href: "/contact" },
    ],
    phone: "01224 000000",
    ctaLabel: "Book a visit",
    ctaHref: "#contact",
    scheduleText: "Mon-Sat 7am-8pm | Emergency 24/7",
    locationText: "Reading & Surrounding Areas",
    variant: "figma",
  },
} as const;

const siteFooter = {
  type: "site.footer",
  props: {
    logoText: "North East Eco Heat",
    description: "Local plumbing and heating support for homeowners and landlords.",
    phone: "01224 000000",
    email: "hello@example.co.uk",
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
    title: "Need help with your heating?",
    subtitle: "Get practical advice and a clear next step from a local trade business.",
    primaryCtaLabel: "Request a quote",
    secondaryCtaLabel: "Call now",
    phone: "01224 000000",
  },
} as const;

const contactSplit = {
  type: "contact.split",
  props: {
    eyebrow: "Contact",
    title: "Request a quote or ask a question",
    subtitle: "Tell us what you need help with and we will get back to you.",
    phone: "01224 000000",
    email: "hello@example.co.uk",
    address: "Aberdeenshire, Scotland",
    openingHours: "Monday to Friday, 8am to 5pm",
  },
} as const;

export const modernTradeHomePage: TemplatePage = {
  title: "Home",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Plumbing & heating specialists",
        title: "Reliable plumbing and heating services across Aberdeenshire",
        subtitle:
          "Professional boiler servicing, breakdowns, installations and heating upgrades from a trusted local business.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 000000",
        trustBadges: ["Fully Insured", "Local Engineers", "Fast Response", "Free Quotes"],
        imageAlt: "Engineer working on a heating system",
      },
    },
    {
      type: "trust.badges",
      props: {
        badges: [
          { label: "Local business", description: "Based in the North East and trusted by local homeowners." },
          { label: "Clear pricing", description: "Straightforward advice before work begins." },
          { label: "Practical repairs", description: "Focused on reliable fixes, not unnecessary upselling." },
        ],
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Services",
        title: "How we can help",
        subtitle: "Core services for homeowners, landlords and small commercial properties.",
        services: [
          { title: "Oil boiler servicing", description: "Annual servicing to keep your boiler running safely and efficiently.", href: "/services/oil-boiler-servicing" },
          { title: "Boiler breakdowns", description: "Fault finding and repairs when your heating stops working.", href: "/services/boiler-breakdowns" },
          { title: "Heating upgrades", description: "Replacement boilers, controls and system improvements.", href: "/services/heating-upgrades" },
        ],
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Reviews",
        title: "What customers say",
        reviews: [
          { quote: "Arrived when agreed, explained the issue clearly and got the boiler running again.", name: "Customer", location: "Ellon", rating: 5 },
          { quote: "Professional service and tidy work. Would happily use again.", name: "Customer", location: "Inverurie", rating: 5 },
          { quote: "Helpful advice and a straightforward repair without any fuss.", name: "Customer", location: "Peterhead", rating: 5 },
        ],
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Areas covered",
        title: "Serving homes across the North East",
        subtitle: "Local plumbing and heating support across towns and rural areas.",
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
          { question: "Do you service oil boilers?", answer: "Yes, we service and repair oil boilers for homeowners and landlords." },
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

export const modernTradeAboutPage: TemplatePage = {
  title: "About",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "About us",
        title: "A local trade business built on practical service",
        subtitle:
          "Straightforward plumbing and heating support for customers who want clear advice, reliable workmanship and proper communication.",
        primaryCtaLabel: "Get in touch",
        secondaryCtaLabel: "View services",
        phone: "01224 000000",
        imageAlt: "Local heating engineer profile placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Who we are",
        title: "Experienced support for homes and small properties",
        body:
          "We help homeowners, landlords and small commercial customers keep their plumbing and heating systems working properly. The focus is simple: practical advice, careful workmanship and no unnecessary confusion.",
        bullets: [
          "Oil boiler servicing and repairs",
          "Heating controls and system upgrades",
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

export const modernTradeServicesPage: TemplatePage = {
  title: "Services",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Services",
        title: "Plumbing and heating services for local homes",
        subtitle:
          "From annual servicing to breakdowns and heating upgrades, this template gives trade businesses a clear service structure.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Ask a question",
        phone: "01224 000000",
        imageAlt: "Heating services image placeholder",
      },
    },
    {
      type: "services.grid",
      props: {
        eyebrow: "Services",
        title: "Choose a service",
        subtitle: "Each service can link to its own editable detail page.",
        services: [
          { title: "Oil boiler servicing", description: "Annual service visits to help keep boilers safe, efficient and reliable.", href: "/services/oil-boiler-servicing" },
          { title: "Boiler breakdowns", description: "Fault finding and practical repair work when heating or hot water fails.", href: "/services/boiler-breakdowns" },
          { title: "Boiler installations", description: "Replacement boiler work and practical system improvements.", href: "/services/boiler-installations" },
          { title: "Heating controls", description: "Thermostats, programmers and controls to improve heating management.", href: "/services/heating-controls" },
          { title: "Cylinders and hot water", description: "Support with hot water cylinders, valves and system components.", href: "/services/hot-water" },
          { title: "General plumbing", description: "Repairs and small plumbing jobs for local homes and landlords.", href: "/services/general-plumbing" },
        ],
      },
    },
    {
      type: "process.steps",
      props: {
        eyebrow: "Process",
        title: "Simple from first contact to completion",
        steps: [
          { title: "Tell us what you need", description: "Send an enquiry or call with the problem or work required." },
          { title: "Get practical advice", description: "We explain the likely next step and arrange a visit where needed." },
          { title: "Work completed properly", description: "The job is carried out carefully with clear follow-up where required." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const modernTradeServiceDetailPage: TemplatePage = {
  title: "Service Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Oil boiler servicing",
        title: "Oil boiler servicing for safer, more reliable heating",
        subtitle:
          "A dedicated service detail page for explaining what is included, who it suits and how customers can book.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View all services",
        phone: "01224 000000",
        imageAlt: "Oil boiler service image placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "What is included",
        title: "A clear service visit with practical checks",
        body:
          "This page structure is designed for a specific trade service. It gives the business space to explain the work, set expectations and answer common customer questions.",
        bullets: [
          "Visual condition checks",
          "Combustion and safety checks where applicable",
          "Advice on issues found during the visit",
        ],
      },
    },
    {
      type: "features.list",
      props: {
        eyebrow: "Benefits",
        title: "Why regular servicing matters",
        subtitle: "A service detail page should help customers understand the value of booking.",
        features: [
          { title: "Improved reliability", description: "Regular checks help spot problems before they become breakdowns." },
          { title: "Safer operation", description: "Important components can be inspected and tested during a visit." },
          { title: "Better efficiency", description: "A properly maintained appliance is less likely to waste fuel." },
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
          { question: "How often should an oil boiler be serviced?", answer: "Most customers arrange servicing annually, but the exact requirement depends on the appliance and usage." },
          { question: "Can faults be repaired during the service?", answer: "Minor issues may be dealt with during the visit. Larger faults may need parts or a separate repair." },
          { question: "Can landlords use this page?", answer: "Yes, this page type can be adapted for landlord-focused servicing content." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const modernTradeAreasCoveredPage: TemplatePage = {
  title: "Areas Covered",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Areas covered",
        title: "Local plumbing and heating support across the North East",
        subtitle:
          "A clear area coverage page helps local customers understand whether the business works in their town or village.",
        primaryCtaLabel: "Check availability",
        secondaryCtaLabel: "Contact us",
        phone: "01224 000000",
        imageAlt: "Map area placeholder",
      },
    },
    {
      type: "areas.grid",
      props: {
        eyebrow: "Service areas",
        title: "Towns and villages covered",
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

export const modernTradeAreaDetailPage: TemplatePage = {
  title: "Area Detail",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Ellon",
        title: "Plumbing and heating services in Ellon",
        subtitle:
          "A local area landing page for targeting service searches in a specific town or village.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "View services",
        phone: "01224 000000",
        imageAlt: "Ellon service area image placeholder",
      },
    },
    {
      type: "about.intro",
      props: {
        eyebrow: "Local service",
        title: "Heating and plumbing help close to home",
        body:
          "This area page can be adapted for any town or village. It gives the business space to explain local availability, common services and how customers can get help.",
        bullets: [
          "Boiler servicing in Ellon",
          "Heating repairs in surrounding villages",
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
          { title: "Oil boiler servicing", description: "Annual servicing for homes using oil heating.", href: "/services/oil-boiler-servicing" },
          { title: "Boiler breakdowns", description: "Fault finding and repair support when heating fails.", href: "/services/boiler-breakdowns" },
          { title: "Heating controls", description: "Control upgrades and practical heating improvements.", href: "/services/heating-controls" },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const modernTradeReviewsPage: TemplatePage = {
  title: "Reviews",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Reviews",
        title: "Customer reviews and local feedback",
        subtitle:
          "A dedicated reviews page gives local businesses a place to build trust with prospective customers.",
        primaryCtaLabel: "Request a quote",
        secondaryCtaLabel: "Contact us",
        phone: "01224 000000",
        imageAlt: "Customer review image placeholder",
      },
    },
    {
      type: "reviews.grid",
      props: {
        eyebrow: "Customer feedback",
        title: "What customers say",
        reviews: [
          { quote: "Arrived when agreed, explained the issue clearly and got the boiler running again.", name: "Customer", location: "Ellon", rating: 5 },
          { quote: "Professional service and tidy work. Would happily use again.", name: "Customer", location: "Inverurie", rating: 5 },
          { quote: "Helpful advice and a straightforward repair without any fuss.", name: "Customer", location: "Peterhead", rating: 5 },
          { quote: "Good communication and a clear explanation of the options.", name: "Customer", location: "Aberdeen", rating: 5 },
          { quote: "Reliable, tidy and easy to deal with.", name: "Customer", location: "Oldmeldrum", rating: 5 },
          { quote: "Sorted the issue quickly and gave useful follow-up advice.", name: "Customer", location: "Mintlaw", rating: 5 },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const modernTradeGalleryPage: TemplatePage = {
  title: "Gallery",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Gallery",
        title: "Recent work and project examples",
        subtitle:
          "A gallery page helps trade businesses show the type of work they carry out without overcomplicating the website.",
        primaryCtaLabel: "Discuss a job",
        secondaryCtaLabel: "View services",
        phone: "01224 000000",
        imageAlt: "Recent work gallery hero placeholder",
      },
    },
    {
      type: "gallery.grid",
      props: {
        eyebrow: "Recent work",
        title: "Example jobs",
        images: [
          { alt: "Boiler installation photo placeholder", caption: "Replacement boiler installation" },
          { alt: "Heating controls photo placeholder", caption: "Heating controls upgrade" },
          { alt: "Plant room photo placeholder", caption: "Heating system maintenance" },
          { alt: "Cylinder cupboard photo placeholder", caption: "Hot water system work" },
          { alt: "Pipework photo placeholder", caption: "Neat pipework and system improvements" },
          { alt: "External boiler photo placeholder", caption: "External boiler installation" },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const modernTradeFaqPage: TemplatePage = {
  title: "FAQ",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "FAQ",
        title: "Frequently asked questions",
        subtitle:
          "A practical FAQ page reduces repeated enquiries and helps customers understand how the business works.",
        primaryCtaLabel: "Ask a question",
        secondaryCtaLabel: "Contact us",
        phone: "01224 000000",
        imageAlt: "FAQ image placeholder",
      },
    },
    {
      type: "faq.accordion",
      props: {
        eyebrow: "Common questions",
        title: "Helpful answers before you book",
        faqs: [
          { question: "Do you offer emergency callouts?", answer: "This can be edited depending on whether the business offers emergency support." },
          { question: "Do you work with landlords?", answer: "Yes, this template can support landlord-focused service content." },
          { question: "Can I request a quote online?", answer: "Yes, the contact block can be connected to the TWD enquiry system." },
          { question: "Do you cover rural properties?", answer: "The areas page can be adapted for rural coverage and local villages." },
          { question: "Can I edit these questions?", answer: "Yes, questions and answers are passed as editable page data." },
        ],
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const modernTradeContactPage: TemplatePage = {
  title: "Contact",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Contact",
        title: "Get in touch about plumbing or heating work",
        subtitle:
          "A focused contact page with phone, email, opening hours and enquiry form placement.",
        primaryCtaLabel: "Send an enquiry",
        secondaryCtaLabel: "Call now",
        phone: "01224 000000",
        imageAlt: "Contact image placeholder",
      },
    },
    contactSplit,
    siteFooter,
  ],
};

export const modernTradeBlogIndexPage: TemplatePage = {
  title: "Blog Index",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Advice",
        title: "Heating and plumbing advice",
        subtitle:
          "A blog index gives the business space to publish useful articles and support SEO.",
        primaryCtaLabel: "View services",
        secondaryCtaLabel: "Contact us",
        phone: "01224 000000",
        imageAlt: "Blog advice image placeholder",
      },
    },
    {
      type: "blog.index",
      props: {
        eyebrow: "Latest articles",
        title: "Useful guides for homeowners",
        posts: [
          { title: "How often should an oil boiler be serviced?", excerpt: "A simple guide for homeowners who want to keep their boiler safe and efficient.", href: "/blog/oil-boiler-service", date: "12 June 2026" },
          { title: "Signs your heating system needs attention", excerpt: "Common warning signs that should not be ignored.", href: "/blog/heating-warning-signs", date: "18 June 2026" },
          { title: "Choosing better heating controls", excerpt: "How modern controls can improve comfort and reduce wasted energy.", href: "/blog/heating-controls", date: "24 June 2026" },
        ],
      },
    },
    siteFooter,
  ],
};

export const modernTradeBlogPostPage: TemplatePage = {
  title: "Blog Post",
  blocks: [
    siteHeader,
    {
      type: "hero.standard",
      props: {
        eyebrow: "Heating advice",
        title: "How often should an oil boiler be serviced?",
        subtitle:
          "A blog post page structure for publishing useful advice while keeping the design consistent with the template.",
        primaryCtaLabel: "Book a service",
        secondaryCtaLabel: "View services",
        phone: "01224 000000",
        imageAlt: "Oil boiler advice image placeholder",
      },
    },
    {
      type: "legal.content",
      props: {
        title: "How often should an oil boiler be serviced?",
        updatedDate: "24 June 2026",
        sections: [
          { heading: "Why servicing matters", body: "Regular servicing helps keep heating equipment working safely and reliably. It can also highlight issues before they become more expensive faults." },
          { heading: "Typical service frequency", body: "Many homeowners arrange a boiler service once a year, although exact requirements depend on the appliance, usage and manufacturer guidance." },
          { heading: "When to ask for help sooner", body: "Unusual smells, noises, lockouts, poor hot water performance or repeated faults should be checked rather than ignored." },
        ],
      },
    },
    commonCta,
    siteFooter,
  ],
};

export const modernTradePrivacyPolicyPage: TemplatePage = {
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

export const modernTradeCookiePolicyPage: TemplatePage = {
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

export const modernTradeTermsConditionsPage: TemplatePage = {
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

export const modernTradeNotFoundPage: TemplatePage = {
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

function withModernTradeStyleMix(page: TemplatePage): TemplatePage {
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
        accent_color: "#F59E0B",
        heading_color: "#0F172A",
        body_color: "#475569",
        border_color: "#CBD5E1",
        card_bg: "#FFFFFF",
        section_bg: "#F8FAFC",
      } as Record<string, unknown>;

      const byType: Record<string, Record<string, unknown>> = {
        hero: {
          layout: ["split", "full", "centered", "split"][slot],
          variant: ["modern", "default", "classic", "modern"][slot],
          heroStyle: ["modern", "default", "classic", "modern"][slot],
          tone: ["default", "navy", "light", "default"][slot],
          ...baseTheme,
        },
        cta: {
          layout_variant: ["center-banner", "split-inline", "stacked-card", "minimal-strip"][slot],
          layout: ["center-banner", "split-inline", "stacked-card", "minimal-strip"][slot],
          ...baseTheme,
        },
        services: {
          layout_variant: ["card-grid", "icon-panels", "split-list", "compact-rows"][slot],
          layout: ["card-grid", "icon-panels", "split-list", "compact-rows"][slot],
          ...baseTheme,
        },
        testimonials: {
          layout_variant: ["card-grid", "spotlight", "editorial-list", "compact-rows"][slot],
          layout: ["card-grid", "spotlight", "editorial-list", "compact-rows"][slot],
          ...baseTheme,
        },
        areas: {
          layout_variant: ["pill-cloud", "card-grid", "split-columns", "minimal-list"][slot],
          layout: ["pill-cloud", "card-grid", "split-columns", "minimal-list"][slot],
          ...baseTheme,
        },
        faq: {
          layout_variant: ["accordion-card", "stacked-cards", "split-panels", "minimal-list"][slot],
          layout: ["accordion-card", "stacked-cards", "split-panels", "minimal-list"][slot],
          ...baseTheme,
        },
        process: {
          layout_variant: ["numbered-cards", "timeline", "split-list", "minimal-steps"][slot],
          layout: ["numbered-cards", "timeline", "split-list", "minimal-steps"][slot],
          ...baseTheme,
        },
        project_showcase: {
          layout_variant: ["featured-split", "masonry-cards", "card-grid", "compact-list"][slot],
          layout: ["featured-split", "masonry-cards", "card-grid", "compact-list"][slot],
          ...baseTheme,
        },
        gallery: {
          layout_variant: ["grid", "collage", "masonry", "strip"][slot],
          layout: ["grid", "collage", "masonry", "strip"][slot],
          ...baseTheme,
        },
        feature_cards: {
          layout_variant: ["card-grid", "icon-panels", "split-list", "minimal-tiles"][slot],
          layout: ["card-grid", "icon-panels", "split-list", "minimal-tiles"][slot],
          ...baseTheme,
        },
        blog_index: {
          layout_variant: ["editorial-list", "magazine", "card-grid", "minimal-list"][slot],
          layout: ["editorial-list", "magazine", "card-grid", "minimal-list"][slot],
          ...baseTheme,
        },
        blog_post: {
          layout_variant: ["classic-article", "hero-lead", "split-aside", "minimal-prose"][slot],
          layout: ["classic-article", "hero-lead", "split-aside", "minimal-prose"][slot],
          ...baseTheme,
        },
        legal_content: {
          layout_variant: ["classic-doc", "boxed-note", "split-aside", "minimal-prose"][slot],
          layout: ["classic-doc", "boxed-note", "split-aside", "minimal-prose"][slot],
          ...baseTheme,
        },
        sticky_mobile_cta: {
          layout_variant: ["dual-pill", "stacked-copy", "split-label", "single-primary"][slot],
          layout: ["dual-pill", "stacked-copy", "split-label", "single-primary"][slot],
          background_color: "#0F172A",
          text_color: "#FFFFFF",
          primary_color: "#F59E0B",
          secondary_color: "rgba(255,255,255,0.12)",
          border_color: "rgba(255,255,255,0.24)",
        },
        "site.footer": {
          layout_variant: ["four-column", "split-brand", "centered-stack", "minimal-columns"][slot],
          layout: ["four-column", "split-brand", "centered-stack", "minimal-columns"][slot],
          background_color: "#0B1220",
          text_color: "#94A3B8",
          heading_color: "#FFFFFF",
          accent_color: "#F59E0B",
        },
      };

      const overrides = byType[normalizedType];
      if (!overrides) return block;
      return { ...block, props: { ...props, ...overrides } };
    }),
  };
}

export const modernTradePages = {
  home: withStickyMobileCta(withModernTradeStyleMix(modernTradeHomePage)),
  about: withStickyMobileCta(withModernTradeStyleMix(modernTradeAboutPage)),
  services: withStickyMobileCta(withModernTradeStyleMix(modernTradeServicesPage)),
  "service-detail": withStickyMobileCta(withModernTradeStyleMix(modernTradeServiceDetailPage)),
  "areas-covered": withStickyMobileCta(withModernTradeStyleMix(modernTradeAreasCoveredPage)),
  "area-detail": withStickyMobileCta(withModernTradeStyleMix(modernTradeAreaDetailPage)),
  reviews: withStickyMobileCta(withModernTradeStyleMix(modernTradeReviewsPage)),
  gallery: withStickyMobileCta(withModernTradeStyleMix(modernTradeGalleryPage)),
  faq: withStickyMobileCta(withModernTradeStyleMix(modernTradeFaqPage)),
  contact: withStickyMobileCta(withModernTradeStyleMix(modernTradeContactPage)),
  "blog-index": withStickyMobileCta(withModernTradeStyleMix(modernTradeBlogIndexPage)),
  "blog-post": withStickyMobileCta(withModernTradeStyleMix(modernTradeBlogPostPage)),
  "privacy-policy": withStickyMobileCta(withModernTradeStyleMix(modernTradePrivacyPolicyPage)),
  "cookie-policy": withStickyMobileCta(withModernTradeStyleMix(modernTradeCookiePolicyPage)),
  "terms-conditions": withStickyMobileCta(withModernTradeStyleMix(modernTradeTermsConditionsPage)),
  "404": withStickyMobileCta(withModernTradeStyleMix(modernTradeNotFoundPage)),
} satisfies Record<string, TemplatePage>;
