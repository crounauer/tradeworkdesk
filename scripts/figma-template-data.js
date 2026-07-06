#!/usr/bin/env node

/**
 * Figma ZIP → Template Package Generator
 * 
 * Converts React component structure from Figma export (App.tsx)
 * into the template package format with blocks
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// EXTRACTED DATA FROM APP.TSX
// ============================================================================

const COMPANY = "Local Plumbing Pro";
const PHONE = "01234 567 890";
const TAGLINE = "Reliable, Honest Plumbers in Your Area";
const LOCATION = "Reading & Surrounding Areas";

const HOURS = "Mon–Sat 7am–8pm | Emergency 24/7";

const SERVICES = [
  { icon: "droplets", title: "Leak Detection & Repair", desc: "Burst pipes, concealed leaks, dripping joints — we trace and fix leaks fast to prevent costly water damage.", slug: "leak-repair" },
  { icon: "wrench", title: "Taps & Mixers", desc: "Dripping taps, stiff handles, worn cartridges. Supply and fit of all leading UK tap brands.", slug: "taps" },
  { icon: "home", title: "Toilets & WCs", desc: "Cistern repairs, slow-fill valves, leaking bases, full toilet replacements — we handle it all.", slug: "toilets" },
  { icon: "showerhead", title: "Showers & Enclosures", desc: "Electric shower fitting, thermostatic valves, shower tray leaks, and pump installations.", slug: "showers" },
  { icon: "zap", title: "Pipework & Repairs", desc: "Copper re-piping, plastic push-fit alterations, pressure testing and pipe lagging.", slug: "pipework" },
  { icon: "thermometer", title: "Radiators", desc: "Bleeding, balancing, thermostatic valve replacement, and full radiator swaps.", slug: "radiators" },
  { icon: "droplets", title: "Outdoor Taps", desc: "New outdoor tap installation with double-check valve — perfect for gardens and car washing.", slug: "outdoor-taps" },
  { icon: "shield", title: "Plumbing Maintenance", desc: "Annual plumbing checks, water pressure testing, and proactive maintenance to avoid breakdowns.", slug: "maintenance" },
  { icon: "alert-triangle", title: "Emergency Plumbing", desc: "24/7 rapid response to burst pipes, flooding, and major leaks. We aim to be with you within 2 hours.", slug: "emergency" },
  { icon: "wrench", title: "Small Plumbing Jobs", desc: "No job too small — washer replacements, isolation valves, flexi hoses, and minor repairs.", slug: "small-jobs" },
];

const TESTIMONIALS = [
  { name: "Sarah T.", location: "Reading", stars: 5, text: "Brilliant service — came out within an hour to fix a burst pipe under our kitchen sink. Professional, tidy and very reasonable price. Will definitely use again.", date: "March 2025" },
  { name: "James M.", location: "Caversham", stars: 5, text: "Had a dripping tap driving me mad for weeks. Called Local Plumbing Pro and they were here same afternoon. Fixed in 20 minutes. Couldn't be happier.", date: "February 2025" },
  { name: "Linda P.", location: "Woodley", stars: 5, text: "Replaced our old shower with a new thermostatic one. Spotless job, no mess left behind and they even tidied up the pipework. Highly recommend!", date: "January 2025" },
  { name: "Raj S.", location: "Earley", stars: 5, text: "Emergency call at 11pm for a leaking toilet. They answered straight away and arrived within 90 minutes. Genuinely impressive response time.", date: "December 2024" },
  { name: "Carol W.", location: "Tilehurst", stars: 5, text: "Used them for a full bathroom plumbing rough-in. Quality workmanship, kept us updated throughout and finished on schedule. Very professional team.", date: "November 2024" },
  { name: "Dave H.", location: "Pangbourne", stars: 4, text: "Great job fitting outdoor tap and new kitchen mixer. Honest with the quote — no hidden extras. Would definitely book again.", date: "October 2024" },
];

const AREAS = [
  "Reading", "Caversham", "Woodley", "Earley", "Tilehurst", "Pangbourne",
  "Henley-on-Thames", "Twyford", "Wokingham", "Bracknell", "Maidenhead", "Newbury",
  "Thatcham", "Tadley", "Basingstoke", "Hook", "Fleet", "Farnham",
];

const FAQ = [
  { q: "Do you charge a call-out fee?", a: "We offer free no-obligation quotes for all non-emergency work. For emergency call-outs outside of standard hours, a call-out fee applies — we'll always confirm this before arriving." },
  { q: "Are you insured and registered?", a: "Yes, we hold full public liability insurance (£5 million cover) and are registered with the relevant trade bodies. All our work is guaranteed for 12 months." },
  { q: "How quickly can you respond to an emergency?", a: "We aim to reach emergency call-outs within 2 hours, 24 hours a day, 7 days a week. Our local base means we're rarely far away." },
  { q: "Do you provide a written quote?", a: "Absolutely. For all planned work we provide a clear written quote before starting. No hidden costs or surprise extras." },
  { q: "Can you source parts and materials?", a: "Yes — we carry a wide range of commonly needed parts in our van. For specialist fittings we'll source them quickly from trusted local suppliers." },
  { q: "What areas do you cover?", a: "We cover Reading and the surrounding towns within approximately 20 miles, including Woodley, Earley, Caversham, Wokingham, Bracknell, Maidenhead, and more." },
];

const PROCESS_STEPS = [
  { step: "1", title: "Call or Book Online", desc: "Ring us for a free quote or use our online booking form — we'll confirm availability within the hour." },
  { step: "2", title: "We Diagnose the Problem", desc: "Our engineer arrives on time, assesses the issue and explains the fix in plain English before touching anything." },
  { step: "3", title: "Work Completed Neatly", desc: "We carry out the work to a high standard, protecting your home and clearing up completely when finished." },
  { step: "4", title: "Your 12-Month Guarantee", desc: "All workmanship is backed by our 12-month guarantee. If anything isn't right, we'll fix it free of charge." },
];

const BLOG_POSTS = [
  { slug: "stop-dripping-tap", title: "How to Stop a Dripping Tap (And When to Call a Plumber)", excerpt: "A dripping tap can waste over 5,000 litres of water a year. Here's what causes it and what you can do.", date: "15 June 2025", readTime: "4 min read", category: "Tips & Advice" },
  { slug: "frozen-pipes-prevention", title: "Preventing Frozen Pipes This Winter: A UK Homeowner's Guide", excerpt: "Cold snaps can wreak havoc on your plumbing. Our guide covers insulation, stopcocks and what to do if the worst happens.", date: "3 November 2024", readTime: "6 min read", category: "Winter Advice" },
  { slug: "water-pressure-low", title: "Low Water Pressure? Here's Why and How to Fix It", excerpt: "Poor pressure makes showers miserable. We walk through the most common causes and the solutions available to UK homeowners.", date: "18 August 2024", readTime: "5 min read", category: "Troubleshooting" },
  { slug: "outdoor-tap-benefits", title: "5 Reasons to Install an Outdoor Tap Before Summer", excerpt: "Garden watering, car washing, filling paddling pools — a properly fitted outdoor tap makes life much easier.", date: "12 April 2024", readTime: "3 min read", category: "Home Improvement" },
];

const GALLERY_IMAGES = [
  { url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&h=450&fit=crop&auto=format", alt: "New bathroom mixer tap installation" },
  { url: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&h=450&fit=crop&auto=format", alt: "Modern shower enclosure fitting" },
  { url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&h=450&fit=crop&auto=format", alt: "Copper pipework installation" },
  { url: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=600&h=450&fit=crop&auto=format", alt: "Bathroom radiator replacement" },
  { url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=450&fit=crop&auto=format", alt: "Outdoor tap installation in garden" },
  { url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=450&fit=crop&auto=format", alt: "Kitchen under-sink plumbing repair" },
];

// ============================================================================
// TEMPLATE STRUCTURE
// ============================================================================

const TEMPLATE_MANIFEST = {
  id: "local-plumbing-pro",
  slug: "local-plumbing-pro",
  name: "Local Plumbing Pro",
  version: "1.0.0",
  status: "draft",
  category: "trade",
  style: "professional",
  description: "Professional plumbing and heating services template for UK trade businesses. Features emergency booking, service grid, testimonials, and local area coverage.",
  industries: ["Plumbing", "Heating", "Emergency Services", "Local Services", "Trade Businesses"],
  defaultPage: "home",
  pages: [
    "home",
    "services",
    "service-detail",
    "emergency",
    "areas",
    "reviews",
    "gallery",
    "blog-index",
    "blog-post",
    "booking",
    "contact",
    "legal",
    "404"
  ],
  requiredBlocks: [
    "site.header",
    "hero.standard",
    "trust.badges",
    "services.grid",
    "features.list",
    "process.steps",
    "reviews.grid",
    "areas.grid",
    "gallery.grid",
    "blog.index",
    "legal.content",
    "contact.split",
    "cta.banner",
    "faq.accordion",
    "site.footer",
    "system.notFound"
  ],
  source: {
    type: "figma-exported-react",
    figmaUrl: "https://snore-veto-98315844.figma.site",
    appTsxPath: "src/app/App.tsx",
    registryFile: "src/twd/registry/blockRegistry.ts"
  }
};

const PAGES_MANIFEST = {
  template: "local-plumbing-pro",
  defaultPage: "home",
  pages: [
    { slug: "home", title: "Home", path: "/", file: "home.json", blockCount: 8 },
    { slug: "services", title: "Services", path: "/services", file: "services.json", blockCount: 6 },
    { slug: "service-detail", title: "Service Detail", path: "/services/leak-repair", file: "service-detail.json", blockCount: 7 },
    { slug: "emergency", title: "Emergency", path: "/emergency", file: "emergency.json", blockCount: 7 },
    { slug: "areas", title: "Areas", path: "/areas", file: "areas.json", blockCount: 5 },
    { slug: "reviews", title: "Reviews", path: "/reviews", file: "reviews.json", blockCount: 5 },
    { slug: "gallery", title: "Gallery", path: "/gallery", file: "gallery.json", blockCount: 4 },
    { slug: "blog-index", title: "Blog", path: "/blog", file: "blog-index.json", blockCount: 5 },
    { slug: "blog-post", title: "Blog Post", path: "/blog/stop-dripping-tap", file: "blog-post.json", blockCount: 6 },
    { slug: "booking", title: "Book Online", path: "/booking", file: "booking.json", blockCount: 5 },
    { slug: "contact", title: "Contact", path: "/contact", file: "contact.json", blockCount: 4 },
    { slug: "legal", title: "Legal", path: "/legal/privacy-policy", file: "legal.json", blockCount: 3 },
    { slug: "404", title: "404", path: "/404", file: "404.json", blockCount: 3 },
  ]
};

const THEME_TOKENS = {
  slug: "local-plumbing-pro",
  name: "Local Plumbing Pro",
  tokens: {
    colors: {
      primary: "#1e3a8a",
      primaryText: "#ffffff",
      accent: "#f97316",
      accentText: "#ffffff",
      background: "#ffffff",
      mutedBackground: "#f3f4f6",
      border: "#e5e7eb",
      text: "#111827",
      mutedText: "#6b7280"
    },
    typography: {
      headingFamily: "system-ui, -apple-system, sans-serif",
      bodyFamily: "system-ui, -apple-system, sans-serif",
      baseFontSize: "16px"
    },
    radius: {
      small: "0.375rem",
      medium: "0.75rem",
      large: "1rem"
    },
    spacing: {
      sectionY: "5rem",
      containerX: "1.5rem",
      maxWidth: "80rem"
    }
  }
};

// ============================================================================
// HOME PAGE BLOCK DEFINITIONS
// ============================================================================

const HOME_PAGE_BLOCKS = [
  // Block 1: Header
  {
    id: "home-01-header",
    type: "site.header",
    props: {
      logoText: COMPANY,
      navItems: [
        { label: "Home", href: "/" },
        { label: "Services", href: "/services" },
        { label: "Emergency", href: "/emergency" },
        { label: "Areas", href: "/areas" },
        { label: "Reviews", href: "/reviews" },
        { label: "Gallery", href: "/gallery" },
        { label: "Blog", href: "/blog" },
        { label: "Book Online", href: "/booking" },
        { label: "Contact", href: "/contact" }
      ],
      phone: PHONE,
      ctaLabel: "Call Now",
      ctaHref: `tel:${PHONE.replace(/\s/g, '')}`,
      layout: "horizontal",
      headerStyle: "sticky-dark"
    }
  },

  // Block 2: Hero
  {
    id: "home-02-hero",
    type: "hero.standard",
    props: {
      eyebrow: "Professional Plumbing Services",
      title: "Reliable Local Plumbing Services",
      subtitle: "Honest, fast and fully insured plumbers serving Reading and the surrounding area. Free quotes, 12-month guarantee.",
      primaryCtaLabel: "Call Now: 01234 567 890",
      primaryCtaHref: `tel:${PHONE.replace(/\s/g, '')}`,
      secondaryCtaLabel: "Request a Quote",
      secondaryCtaHref: "/booking",
      phone: PHONE,
      imageAlt: "Professional plumber at work"
    }
  },

  // Block 3: Trust Badges
  {
    id: "home-03-badges",
    type: "trust.badges",
    props: {
      badges: [
        { label: "Fully Insured", description: "£5 million public liability cover" },
        { label: "Local Engineers", description: "Based in Reading, covering the surrounding area" },
        { label: "Fast Response", description: "2-hour emergency response target" },
        { label: "Free Quotes", description: "No obligation, transparent pricing" }
      ]
    }
  },

  // Block 4: Features/Benefits List
  {
    id: "home-04-features",
    type: "features.list",
    props: {
      eyebrow: "Why Choose Us",
      title: "Why Local Plumbing Pro",
      subtitle: "Six key reasons local homeowners trust us with their plumbing",
      features: [
        { title: "12-Month Guarantee", description: "All workmanship backed by our guarantee" },
        { title: "Emergency 24/7", description: "Round-the-clock availability for urgent issues" },
        { title: "Honest Advice", description: "We explain the problem in plain English" },
        { title: "Transparent Pricing", description: "Clear quotes, no hidden costs or surprises" },
        { title: "Professional Team", description: "Fully trained and vetted engineers" },
        { title: "Tidy Workmanship", description: "Complete cleanup after every job" }
      ]
    }
  },

  // Block 5: Services Grid
  {
    id: "home-05-services",
    type: "services.grid",
    props: {
      eyebrow: "What We Do",
      title: "Plumbing Services We Cover",
      subtitle: "From emergency call-outs to planned upgrades — expert plumbing for homes and businesses across the area.",
      services: SERVICES.map(s => ({
        title: s.title,
        description: s.desc,
        icon: s.icon,
        ctaLabel: "Learn More",
        ctaHref: `/services/${s.slug}`
      }))
    }
  },

  // Block 6: Process Steps
  {
    id: "home-06-process",
    type: "process.steps",
    props: {
      eyebrow: "How It Works",
      title: "Our 4-Step Process",
      steps: PROCESS_STEPS.map(s => ({
        number: s.step,
        title: s.title,
        description: s.desc
      }))
    }
  },

  // Block 7: CTA Banner
  {
    id: "home-07-cta",
    type: "cta.banner",
    props: {
      title: "Ready to Get Started?",
      subtitle: "Book online or call us for a free, no-obligation quote",
      primaryCtaLabel: "Book Online",
      primaryCtaHref: "/booking",
      secondaryCtaLabel: `Call: ${PHONE}`,
      secondaryCtaHref: `tel:${PHONE.replace(/\s/g, '')}`,
      tone: "urgent"
    }
  },

  // Block 8: Footer
  {
    id: "home-08-footer",
    type: "site.footer",
    props: {
      logoText: COMPANY,
      description: "Honest, reliable local plumbers serving Reading and surrounding areas. Fully insured. 12-month workmanship guarantee.",
      phone: PHONE,
      email: "info@localplumbingpro.co.uk",
      navItems: [
        { label: "Services", href: "/services" },
        { label: "Emergency", href: "/emergency" },
        { label: "Areas", href: "/areas" },
        { label: "Reviews", href: "/reviews" }
      ],
      legalLinks: [
        { label: "Privacy Policy", href: "/legal/privacy-policy" },
        { label: "Terms & Conditions", href: "/legal/terms" }
      ]
    }
  }
];

// ============================================================================
// EXPORT FOR USAGE
// ============================================================================

module.exports = {
  COMPANY, PHONE, TAGLINE, LOCATION, HOURS,
  SERVICES, TESTIMONIALS, AREAS, FAQ, PROCESS_STEPS, BLOG_POSTS, GALLERY_IMAGES,
  TEMPLATE_MANIFEST, PAGES_MANIFEST, THEME_TOKENS, HOME_PAGE_BLOCKS
};

console.log("✓ Local Plumbing Pro template data loaded");
console.log(`  - ${SERVICES.length} services`);
console.log(`  - ${TESTIMONIALS.length} testimonials`);
console.log(`  - ${AREAS.length} areas`);
console.log(`  - ${HOME_PAGE_BLOCKS.length} home page blocks`);
