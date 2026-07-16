/**
 * Website Page Editor — block-based editor for a single CMS page.
 *
 * Layout:
 *   Left panel: Block palette (add new blocks)
 *   Centre:     Block list with inline editing
 *   Right panel: Page metadata (title, slug, SEO, status)
 *
 * Saving: all blocks are sent atomically via
 *   PUT /api/website/pages/:id/blocks
 * Page meta is saved via
 *   PATCH /api/website/pages/:id
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ImagePickerField } from "@/components/image-picker-field";
import { modernTradePages } from "@/twd/templates/modernTrade.pages";
import { HeroBlock as HeroPreviewBlock, SiteHeaderBlock as SiteHeaderPreviewBlock } from "@/twd/blocks";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Eye, EyeOff, Globe, Save, Loader2, ChevronRight,
  ChevronLeft, Type, Image, Layout, MessageSquare, Star, Grid3X3,
  Phone, Award, Minus, Undo2, CalendarCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BlockType =
  | "site.header"
  | "hero"
  | "text"
  | "image"
  | "cta"
  | "services"
  | "service_rates"
  | "contact"
  | "contact_form"
  | "testimonials"
  | "gallery"
  | "blog_index"
  | "blog_post"
  | "brands"
  | "accreditations"
  | "why_choose_us"
  | "feature_cards"
  | "features_bar"
  | "faq"
  | "process"
  | "areas"
  | "project_showcase"
  | "amazon_affiliates"
  | "legal_content"
  | "spacer"
  | "online_booking"
  | "sticky_mobile_cta"
  | "site.footer";

interface Block {
  id: string;
  block_type: string;
  content: Record<string, unknown>;
  sort_order: number;
  is_visible: boolean;
}

interface Page {
  title: string;
  slug: string;
  page_type: string;
  status: "draft" | "published" | "archived";
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  blocks?: Block[];
  no_index?: boolean;
  show_in_nav?: boolean;
  nav_label?: string | null;
}

type BlockPaletteItem = {
  type: BlockType;
  label: string;
  icon: any;
  description: string;
  defaultContent: Record<string, unknown>;
  singleton?: boolean;
};

const BLOCK_PALETTE: BlockPaletteItem[] = [
  {
    type: "site.header",
    label: "Site Header",
    icon: Globe,
    description: "Logo, navigation, call-to-action and top info bar",
    singleton: true,
    defaultContent: {
      logoText: "Your Business",
      navItems: [
        { label: "Home", href: "/" },
        { label: "Services", href: "/services" },
        { label: "Contact", href: "/contact" },
      ],
      phone: "01224 000000",
      ctaLabel: "Book a visit",
      ctaHref: "#contact",
      scheduleText: "Mon-Sat 7am-8pm | Emergency 24/7",
      locationText: "Reading & Surrounding Areas",
      layout: "default",
      headerStyle: "light",
      tone: "default",
      ctaStyle: "default",
      variant: "figma",
    },
  },
  {
    type: "hero",
    label: "Hero",
    icon: Star,
    description: "Primary banner with headline, CTA and image",
    defaultContent: {
      eyebrow: "Trusted local experts",
      heading: "Your Hero Heading",
      subheading: "Describe your business, service area and value proposition.",
      cta_text: "Get a Free Quote",
      cta_url: "/contact",
      trustBadges: ["Fully Insured", "Local Engineers", "Fast Response", "Free Quotes"],
      hero_style: "default",
      variant: "default",
      layout: "full",
      tone: "default",
      density: "normal",
    },
  },
  {
    type: "text",
    label: "Text Section",
    icon: Type,
    description: "Rich text section with optional heading and intro",
    defaultContent: {
      heading: "About Our Team",
      subheading: "Experienced engineers, quality workmanship, transparent pricing.",
      html: "<p>Add your text content here.</p>",
      align: "left",
    },
  },
  {
    type: "cta",
    label: "CTA Band",
    icon: MessageSquare,
    description: "Prominent call-to-action with primary and secondary actions",
    defaultContent: {
      heading: "Need help with your heating?",
      subheading: "Speak to our team and get a free, no-obligation quote.",
      cta_text: "Get a Free Quote",
      cta_url: "/contact",
      secondary_cta_text: "Call Us",
      secondary_cta_url: "tel:+441224000000",
      layout_variant: "center-banner",
    },
  },
  {
    type: "services",
    label: "Services Grid",
    icon: Grid3X3,
    description: "Cards or list of core services",
    defaultContent: {
      heading: "How We Can Help",
      subheading: "Our most popular services for homes and businesses.",
      services: [
        { title: "Boiler Installation", description: "Energy-efficient installations with clear pricing.", icon: "🔥" },
        { title: "Boiler Servicing", description: "Annual servicing to keep systems safe and efficient.", icon: "🛠️" },
        { title: "Emergency Repairs", description: "Fast response when your heating fails.", icon: "🚨" },
      ],
      layout_variant: "card-grid",
    },
  },
  {
    type: "service_rates",
    label: "Service Rates",
    icon: Grid3X3,
    description: "Pricing cards/table for core services",
    defaultContent: {
      heading: "Typical Service Rates",
      subheading: "Clear starting prices for common jobs.",
      variation: "cards",
      note: "Final quote depends on scope and parts.",
      rates: [],
    },
  },
  {
    type: "testimonials",
    label: "Reviews",
    icon: MessageSquare,
    description: "Customer testimonials and social proof",
    defaultContent: {
      heading: "What Customers Say",
      subheading: "Trusted by homeowners across the North East.",
      items: [
        { quote: "Great service from start to finish.", author: "J. Smith", location: "Aberdeen" },
        { quote: "Arrived on time and solved the issue quickly.", author: "L. Brown", location: "Inverurie" },
      ],
      layout_variant: "card-grid",
    },
  },
  {
    type: "contact",
    label: "Contact Details",
    icon: Phone,
    description: "Business contact details shown beside the enquiry form",
    defaultContent: {
      eyebrow: "Contact",
      title: "Request a quote or ask a question",
      subtitle: "Tell us what you need help with and we will get back to you.",
      phone: "",
      email: "",
      address: "",
      openingHours: "",
    },
  },
  {
    type: "contact_form",
    label: "Contact Form",
    icon: MessageSquare,
    description: "Enquiry or quote request form",
    defaultContent: {
      heading: "Get in Touch",
      subheading: "Fill in the form below and we'll get back to you shortly.",
      form_type: "contact",
      form_kind: "contact",
      allow_photos: true,
    },
  },
  {
    type: "gallery",
    label: "Photo Gallery",
    icon: Image,
    description: "Before/after photos and case studies",
    defaultContent: {
      heading: "Our Recent Work",
      columns: 3,
    },
  },
  {
    type: "blog_index",
    label: "Blog Index",
    icon: Layout,
    description: "List of published blog posts",
    defaultContent: {
      heading: "Latest Articles",
      subheading: "Guides, tips and updates from our team.",
      layout_variant: "editorial-list",
    },
  },
  {
    type: "blog_post",
    label: "Blog Post",
    icon: Layout,
    description: "Single blog article template block",
    singleton: true,
    defaultContent: {
      heading: "Blog Post",
      subheading: "",
      html: "<p>Write your article content here.</p>",
      layout_variant: "classic-article",
    },
  },
  {
    type: "brands",
    label: "Brands / Partners",
    icon: Award,
    description: "Logo strip for partner and manufacturer brands",
    defaultContent: {
      heading: "Trusted By",
      brands: [
        { name: "Vaillant", logo_url: "" },
        { name: "Worcester Bosch", logo_url: "" },
      ],
      layout_variant: "logo-cloud",
    },
  },
  {
    type: "why_choose_us",
    label: "Why Choose Us",
    icon: Star,
    description: "Trust-focused section with key differentiators",
    defaultContent: {
      heading: "Why Choose Us",
      subheading: "Reliable local specialists with a proven track record.",
      items: [
        { title: "Fully Qualified", description: "Certified engineers and insured workmanship.", icon: "✅" },
        { title: "Fast Response", description: "Rapid callouts across our service area.", icon: "⚡" },
        { title: "Transparent Pricing", description: "Clear quotes with no hidden extras.", icon: "💷" },
      ],
      layout_variant: "card-grid",
    },
  },
  {
    type: "feature_cards",
    label: "Feature Cards",
    icon: Grid3X3,
    description: "Flexible cards for benefits, services or highlights",
    defaultContent: {
      heading: "Our Key Benefits",
      subheading: "What sets our service apart.",
      items: [
        { title: "Local Team", description: "Serving local homes and businesses.", icon: "📍" },
        { title: "Trusted Advice", description: "Straightforward recommendations.", icon: "🧭" },
        { title: "Aftercare", description: "Ongoing support after every job.", icon: "🤝" },
      ],
      layout_variant: "card-grid",
    },
  },
  {
    type: "accreditations",
    label: "Trust Badges",
    icon: Award,
    description: "Gas Safe, OFTEC and other accreditation logos",
    defaultContent: {
      heading: "Certified & Accredited",
      items: [
        { name: "Gas Safe Registered", logo_url: "" },
        { name: "OFTEC Registered", logo_url: "" },
      ],
    },
  },
  {
    type: "image",
    label: "Image",
    icon: Image,
    description: "Single image with optional caption",
    defaultContent: {
      image_url: "",
      alt_text: "",
      caption: "",
      width: "full",
    },
  },
  {
    type: "features_bar",
    label: "Features Bar",
    icon: Grid3X3,
    description: "Horizontal strip of icon + title + description feature items",
    defaultContent: {
      background_color: "#0d9488",
      text_color: "#ffffff",
      items: [
        { icon: "⚡", title: "Fast Response", description: "We aim to respond to all enquiries within one working day." },
        { icon: "✅", title: "Fully Qualified", description: "All engineers are Gas Safe registered and fully insured." },
        { icon: "🏆", title: "5-Star Rated", description: "Consistently rated 5 stars by our customers." },
      ],
    },
  },
  {
    type: "faq",
    label: "FAQ",
    icon: MessageSquare,
    description: "Accordion of frequently asked questions",
    defaultContent: {
      heading: "Frequently Asked Questions",
      items: [
        { question: "What areas do you cover?", answer: "We serve customers across the local area. Please get in touch to confirm availability at your address." },
        { question: "How do I get a quote?", answer: "Simply fill in our contact form or call us and we'll arrange a free, no-obligation visit." },
      ],
    },
  },
  {
    type: "process",
    label: "How It Works",
    icon: Layout,
    description: "Numbered steps showing your process",
    defaultContent: {
      heading: "How It Works",
      subheading: "Getting started is easy.",
      cta_text: "Get a Free Quote",
      cta_url: "/contact",
      steps: [
        { icon: "📞", title: "Get in Touch", description: "Call us or fill in the form. We'll discuss your needs and arrange a visit." },
        { icon: "🔍", title: "Free Survey", description: "We assess your property and provide a detailed, transparent quote." },
        { icon: "🔧", title: "Installation", description: "Our engineers carry out the work with minimal disruption." },
        { icon: "✅", title: "Aftercare", description: "We commission the system and provide ongoing support." },
      ],
    },
  },
  {
    type: "areas",
    label: "Areas Covered",
    icon: Globe,
    description: "List of towns and areas you serve",
    defaultContent: {
      heading: "Areas We Cover",
      subheading: "We serve customers across the local area. Contact us to check availability in your postcode.",
      cta_text: "Check Availability",
      cta_url: "/contact",
      areas: [],
    },
  },
  {
    type: "project_showcase",
    label: "Case Study",
    icon: Image,
    description: "Featured project or case study with image, stats and CTA",
    defaultContent: {
      heading: "Real Homes, Real Results",
      projects: [
        {
          title: "Recent Project",
          location: "",
          image_url: "",
          description: "Describe the project, the challenge, and the outcome.",
          cta_text: "Start Your Project",
          cta_url: "/contact",
        },
      ],
    },
  },
  {
    type: "amazon_affiliates",
    label: "Amazon Affiliates",
    icon: Award,
    description: "Amazon Associates product showcase with disclosure and flexible layouts",
    defaultContent: {
      heading: "Recommended Products",
      subheading: "Curated picks we trust and install regularly.",
      disclosure_text: "As an Amazon Associate, we earn from qualifying purchases.",
      layout_variant: "product-grid",
      products: [
        {
          title: "Smart Thermostat",
          image_url: "",
          affiliate_url: "",
          price_text: "",
          rating_text: "",
          reviews_text: "",
          badge_text: "Editor's Pick",
        },
      ],
      button_text: "View on Amazon",
      open_in_new_tab: true,
    },
  },
  {
    type: "online_booking",
    label: "Online Booking",
    icon: CalendarCheck,
    description: "Multi-step booking widget — customers pick service, date & time",
    defaultContent: {
      heading: "Book an Appointment",
      subheading: "Choose a service and pick a time that suits you.",
      require_postcode: true,
      require_description: true,
      show_price: true,
      complex_keywords: "repair,breakdown,fault,emergency,not working,no hot water,leak",
    },
  },
  {
    type: "sticky_mobile_cta",
    label: "Sticky Mobile CTA",
    icon: Phone,
    description: "Persistent bottom CTA bar on mobile devices",
    defaultContent: {
      primary_label: "Call Now",
      primary_href: "tel:+441224000000",
      secondary_label: "Book Online",
      secondary_href: "/book",
      background_color: "#0f172a",
      text_color: "#ffffff",
      enabled: true,
    },
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: Minus,
    description: "Vertical spacing between sections",
    defaultContent: { height: "md" },
  },
  {
    type: "legal_content",
    label: "Legal Content",
    icon: Layout,
    description: "Privacy, terms, and policy content section",
    singleton: true,
    defaultContent: {
      heading: "Privacy Policy",
      html: "<p>Replace this with your policy content.</p>",
      layout_variant: "classic-doc",
    },
  },
  {
    type: "site.footer",
    label: "Footer",
    icon: Layout,
    description: "Global-style footer links and contact details",
    singleton: true,
    defaultContent: {
      logoText: "Your Business",
      description: "Trusted local experts for heating, plumbing and renewables.",
      phone: "",
      email: "",
      navItems: [
        { label: "Home", href: "/" },
        { label: "Services", href: "/services" },
        { label: "Contact", href: "/contact" },
      ],
      legalLinks: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
      variant: "default",
      layout: "default",
      background: "default",
      tone: "default",
    },
  },
];

const TEMPLATE_BLOCK_TYPE_ALIASES: Record<string, string> = {
  "hero.standard": "hero",
  "about.intro": "text",
  "trust.badges": "trust_badges",
  "services.grid": "services_grid",
  "services.rates": "service_rates",
  "reviews.grid": "reviews",
  "areas.grid": "areas_grid",
  "gallery.grid": "gallery",
  "cta.banner": "cta_band",
  "contact.split": "contact",
  "faq.accordion": "faq",
  "process.steps": "process",
  "features.list": "feature_cards",
  "amazon.affiliates": "amazon_affiliates",
  "blog.index": "blog_index",
  "blog.post": "blog_post",
  "legal.content": "legal_content",
};

const TEMPLATE_SKIPPED_BLOCK_TYPES = new Set<string>([]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function generateId() {
  return `local_${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Block field editors
// ---------------------------------------------------------------------------

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function readString(content: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = content[key];
    if (typeof value === "string") return value;
  }
  return fallback;
}

function readArray<T>(content: Record<string, unknown>, keys: string[], fallback: T[] = []): T[] {
  for (const key of keys) {
    const value = content[key];
    if (Array.isArray(value)) return value as T[];
  }
  return fallback;
}

function syncBlockContent(
  content: Record<string, unknown>,
  updates: Record<string, unknown>,
  aliases: Record<string, string[]>
): Record<string, unknown> {
  const next = { ...content, ...updates };

  for (const [key, value] of Object.entries(updates)) {
    for (const alias of aliases[key] || []) {
      next[alias] = value;
    }
  }

  return next;
}

function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

function mergeTemplateSeed(content: unknown, templateSeed: unknown): unknown {
  if (isBlankValue(content)) {
    return templateSeed;
  }

  if (Array.isArray(content) && Array.isArray(templateSeed)) {
    const merged = content.map((item, index) => mergeTemplateSeed(item, templateSeed[index]));
    if (templateSeed.length > merged.length) {
      merged.push(...templateSeed.slice(merged.length));
    }
    return merged;
  }

  if (
    typeof content === "object" && content !== null &&
    typeof templateSeed === "object" && templateSeed !== null &&
    !Array.isArray(templateSeed)
  ) {
    const contentObj = content as Record<string, unknown>;
    const templateObj = templateSeed as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...contentObj };

    for (const [key, templateValue] of Object.entries(templateObj)) {
      merged[key] = mergeTemplateSeed(contentObj[key], templateValue);
    }

    return merged;
  }

  return content;
}

function normalizeTemplateBlockType(blockType: unknown): string {
  const normalized = String(blockType || "").trim().toLowerCase();
  if (!normalized) return "text";
  return TEMPLATE_BLOCK_TYPE_ALIASES[normalized] || normalized;
}

function shouldSkipTemplateBlock(blockType: unknown): boolean {
  const normalized = String(blockType || "").trim().toLowerCase();
  return TEMPLATE_SKIPPED_BLOCK_TYPES.has(normalized);
}

function hydrateEditorBlocks(page: Page): Block[] {
  const pageKey = page.slug.replace(/^\/+/, "");
  const templatePage = modernTradePages[pageKey as keyof typeof modernTradePages];
  const templateBlocks = (templatePage?.blocks ?? [])
    .filter((templateBlock) => !shouldSkipTemplateBlock(templateBlock.type))
    .map((templateBlock) => ({
      type: normalizeTemplateBlockType(templateBlock.type),
      props: (templateBlock.props && typeof templateBlock.props === "object")
        ? templateBlock.props as Record<string, unknown>
        : {},
    }));

  return [...(page.blocks ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((block, index) => {
      const templateBlock = templateBlocks[index];
      const templateProps = templateBlock?.props ?? {};
      const normalizedBlockType = normalizeTemplateBlockType(block.block_type);
      return {
        ...block,
        content: templateBlock?.type === normalizedBlockType
          ? (mergeTemplateSeed(block.content, templateProps) as Record<string, unknown>)
          : block.content,
      };
    });
}

function GenericBlockEditor({
  blockType,
  content,
  onChange,
}: {
  blockType: string;
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(content || {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJson(JSON.stringify(content || {}, null, 2));
    setError(null);
  }, [content]);

  const applyJson = () => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("Block content must be a JSON object.");
        return;
      }
      setError(null);
      onChange(parsed as Record<string, unknown>);
    } catch {
      setError("Invalid JSON. Check commas, quotes, and brackets.");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Advanced mode for custom block type <strong>{blockType}</strong>. Most block types now have simple form fields above; use this only for uncommon settings.
      </p>
      <FieldRow label="Block Content (JSON)">
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
      </FieldRow>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" size="sm" variant="outline" onClick={applyJson}>
        Apply JSON
      </Button>
    </div>
  );
}

function resolveEditorType(blockType: string): BlockType | "generic" {
  const t = String(blockType || "").toLowerCase();

  const known: BlockType[] = [
    "site.header",
    "hero",
    "text",
    "image",
    "cta",
    "services",
    "service_rates",
    "contact",
    "contact_form",
    "testimonials",
    "gallery",
    "blog_index",
    "blog_post",
    "brands",
    "accreditations",
    "why_choose_us",
    "feature_cards",
    "features_bar",
    "faq",
    "process",
    "areas",
    "project_showcase",
    "amazon_affiliates",
    "legal_content",
    "spacer",
    "online_booking",
    "sticky_mobile_cta",
    "site.footer",
  ];

  if (known.includes(t as BlockType)) return t as BlockType;

  if (t === "service_rates" || t === "services.rates" || t.includes("service_rate")) return "service_rates";
  if (t.includes("sticky_mobile_cta")) return "sticky_mobile_cta";
  if (t === "site.header" || t.includes("site.header")) return "site.header";
  if (t.includes("hero")) return "hero";
  if (t.includes("text") || t.includes("intro")) return "text";
  if (t.includes("image")) return "image";
  if (t.includes("cta") || t.includes("call_to_action")) return "cta";
  if (t.includes("service")) return "services";
  if (t === "contact" || t.includes("contact.split") || t.includes("map_opening_hours")) return "contact";
  if (t.includes("contact") && t.includes("form")) return "contact_form";
  if (t.includes("review") || t.includes("testimonial")) return "testimonials";
  if (t.includes("gallery")) return "gallery";
  if (t.includes("blog_post") || t.includes("article")) return "blog_post";
  if (t.includes("blog")) return "blog_index";
  if (t.includes("why_choose_us") || (t.includes("why") && t.includes("choose"))) return "why_choose_us";
  if (t.includes("feature_cards")) return "feature_cards";
  if (t.includes("brand") || t.includes("partner")) return "brands";
  if (t.includes("accredit") || t.includes("trust_badge") || t.includes("badge")) return "accreditations";
  if (t.includes("feature") || t.includes("benefit") || t.includes("team")) return "features_bar";
  if (t.includes("faq")) return "faq";
  if (t.includes("process") || t.includes("how_it_works")) return "process";
  if (t.includes("area")) return "areas";
  if (t.includes("project") || t.includes("case_study")) return "project_showcase";
  if (t.includes("amazon") || t.includes("affiliate") || t.includes("associates")) return "amazon_affiliates";
  if (t.includes("legal") || t.includes("privacy") || t.includes("terms")) return "legal_content";
  if (t.includes("booking")) return "online_booking";
  if (t.includes("spacer")) return "spacer";
  if (t.includes("footer")) return "site.footer";

  return "generic";
}

function BlockEditor({
  block,
  onChange,
  previewEnabled,
  onTogglePreview,
}: {
  block: Block;
  onChange: (content: Record<string, unknown>) => void;
  previewEnabled?: boolean;
  onTogglePreview?: (enabled: boolean) => void;
}) {
  const c = block.content;
  const editorType = resolveEditorType(block.block_type);

  const set = (key: string, value: unknown) => onChange({ ...c, [key]: value });

  switch (editorType) {
    case "site.header": {
      const logoText = readString(c, ["logoText", "logo_text"], "Your Business");
      const phone = readString(c, ["phone"]);
      const ctaLabel = readString(c, ["ctaLabel", "cta_label"]);
      const ctaHref = readString(c, ["ctaHref", "cta_href"], "#contact");
      const layout = readString(c, ["layout"], "default");
      const headerStyle = readString(c, ["headerStyle", "header_style"], "light");
      const tone = readString(c, ["tone"], "default");
      const ctaStyle = readString(c, ["ctaStyle", "cta_style"], "default");
      const variant = readString(c, ["variant"], "default");
      const scheduleText = readString(c, ["scheduleText", "schedule_text"]);
      const locationText = readString(c, ["locationText", "location_text"]);
      const navItems = readArray<{ label: string; href: string }>(c, ["navItems", "nav_items"]).map((item) => ({
        label: String(item.label ?? ""),
        href: String(item.href ?? ""),
      }));
      const updateNavItems = (next: Array<{ label: string; href: string }>) => {
        onChange(syncBlockContent(c, { navItems: next, nav_items: next }, { navItems: ["nav_items"], nav_items: ["navItems"] }));
      };
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <SiteHeaderPreviewBlock
                      logoText={logoText}
                      navItems={navItems}
                      phone={phone || undefined}
                      ctaLabel={ctaLabel || undefined}
                      ctaHref={ctaHref || undefined}
                      layout={layout as "default" | "traditional"}
                      headerStyle={headerStyle as "light" | "classic-dark"}
                      tone={tone as "default" | "navy"}
                      ctaStyle={ctaStyle as "default" | "amber-solid" | "outline-light"}
                      variant={variant as "default" | "figma"}
                      scheduleText={scheduleText || undefined}
                      locationText={locationText || undefined}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">Preview hidden. Use the toggle below to bring it back.</div>
              )}
            </div>

            <div className="xl:min-h-0">
              <Card className="h-full border-border/70 shadow-sm xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
                <CardHeader className="border-b bg-muted/20 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Site Header Settings</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>
                      {isPreviewVisible ? "Hide preview" : "Show preview"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <FieldRow label="Logo Text"><Input value={logoText} onChange={(e) => set("logoText", e.target.value)} /></FieldRow>
                  <FieldRow label="Schedule Text"><Input value={scheduleText} onChange={(e) => set("scheduleText", e.target.value)} placeholder="Mon-Sat 7am-8pm | Emergency 24/7" /></FieldRow>
                  <FieldRow label="Location Text"><Input value={locationText} onChange={(e) => set("locationText", e.target.value)} placeholder="Reading & Surrounding Areas" /></FieldRow>
                  <FieldRow label="Phone"><Input value={phone} onChange={(e) => set("phone", e.target.value)} placeholder="01234 567890" /></FieldRow>
                  <FieldRow label="CTA Label"><Input value={ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Call Now" /></FieldRow>
                  <FieldRow label="CTA URL"><Input value={ctaHref} onChange={(e) => set("ctaHref", e.target.value)} placeholder="#contact" /></FieldRow>
                  <FieldRow label="Layout">
                    <Select value={layout} onValueChange={(v) => set("layout", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="traditional">Traditional</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Header Style">
                    <Select value={headerStyle} onValueChange={(v) => set("headerStyle", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="classic-dark">Classic Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Tone">
                    <Select value={tone} onValueChange={(v) => set("tone", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="navy">Navy</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="CTA Style">
                    <Select value={ctaStyle} onValueChange={(v) => set("ctaStyle", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="amber-solid">Amber Solid</SelectItem>
                        <SelectItem value="outline-light">Outline Light</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Variant">
                    <Select value={variant} onValueChange={(v) => set("variant", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="figma">Figma</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Navigation Items</Label>
                    {navItems.map((item, i) => (
                      <div key={i} className="rounded border p-3 space-y-2">
                        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                          <Input value={item.label} onChange={(e) => { const next = [...navItems]; next[i] = { ...next[i], label: e.target.value }; updateNavItems(next); }} placeholder="Home" />
                          <Input value={item.href} onChange={(e) => { const next = [...navItems]; next[i] = { ...next[i], href: e.target.value }; updateNavItems(next); }} placeholder="/" />
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => updateNavItems(navItems.filter((_, j) => j !== i))}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateNavItems([...navItems, { label: "", href: "" }])}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Nav Item
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );
    }

    case "hero": {
      const eyebrow = readString(c, ["eyebrow"]);
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const primaryText = readString(c, ["cta_text", "primaryCtaLabel", "primaryButtonText"]);
      const primaryUrl = readString(c, ["cta_url", "primaryCtaHref", "primaryButtonUrl"]);
      const secondaryText = readString(c, ["secondary_cta_text", "secondaryCtaLabel", "secondaryButtonText"]);
      const secondaryUrl = readString(c, ["secondary_cta_url", "secondaryCtaHref", "secondaryButtonUrl"]);
      const backgroundImage = readString(c, ["background_image_url", "backgroundImageUrl"]);
      const heroImage = readString(c, ["hero_image_url", "heroImageUrl"]);
      const backgroundColor = readString(c, ["background_color", "backgroundColor"]);
      const textColor = readString(c, ["text_color", "textColor"]);
      const heroPreviewTitle = heading || "Your Heading Here";
      const heroPreviewSubtitle = subheading || "A short description of your services or offer.";
      const heroPreviewPrimary = primaryText || "Get a Free Quote";
      const heroPreviewSecondary = secondaryText || undefined;
      const trustBadges = readArray<string>(c, ["trustBadges", "trust_badges"]);
      const trustItems = readArray<{ text?: string; icon?: string }>(c, ["trust_items"])
        .map((item) => ({ text: String(item.text || ""), icon: String(item.icon || "✓") }))
        .filter((item) => item.text.trim().length > 0);
      const previewTrustBadges = trustItems.length > 0
        ? trustItems.map((item) => `${item.icon || "✓"} ${item.text}`.trim())
        : trustBadges;
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>
                        Hide preview
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <HeroPreviewBlock
                      eyebrow={eyebrow || undefined}
                      layout={(c.layout as "full" | "centered" | "split") ?? "full"}
                      variant={(c.variant as "default" | "classic" | "modern") ?? "default"}
                      heroStyle={(c.heroStyle as "default" | "classic" | "modern") ?? "default"}
                      tone={(c.tone as "default" | "navy" | "light") ?? "default"}
                      ctaStyle={(c.ctaStyle as "default" | "rounded" | "soft" | "outline") ?? "default"}
                      density={(c.density as "normal" | "comfortable" | "compact") ?? "normal"}
                      title={heroPreviewTitle}
                      headingAccent={readString(c, ["heading_accent"]) || undefined}
                      subtitle={heroPreviewSubtitle}
                      primaryCtaLabel={heroPreviewPrimary}
                      primaryCtaHref={primaryUrl || undefined}
                      secondaryCtaLabel={heroPreviewSecondary}
                      secondaryCtaHref={secondaryUrl || undefined}
                      phone={String(c.cta_phone ?? "") || undefined}
                      trustBadges={previewTrustBadges.length ? previewTrustBadges : undefined}
                      backgroundImageUrl={backgroundImage || undefined}
                      heroImageUrl={heroImage || undefined}
                      backgroundColor={backgroundColor || undefined}
                      textColor={textColor || undefined}
                      primaryColor={readString(c, ["primary_color"]) || undefined}
                      primaryTextColor={readString(c, ["primary_text_color"]) || undefined}
                      mutedBackgroundColor={readString(c, ["muted_background_color"]) || undefined}
                      mutedTextColor={readString(c, ["muted_text_color"]) || undefined}
                      imageAlt={String(c.imageAlt ?? "Hero image preview")}
                      fontFamily={readString(c, ["font_family"]) || undefined}
                      headingFontFamily={readString(c, ["heading_font_family"]) || undefined}
                      bodyFontFamily={readString(c, ["body_font_family"]) || undefined}
                      ctaFontFamily={readString(c, ["cta_font_family"]) || undefined}
                      headingFontSize={readString(c, ["heading_font_size"]) || undefined}
                      subheadingFontSize={readString(c, ["subheading_font_size"]) || undefined}
                      eyebrowFontSize={readString(c, ["eyebrow_font_size"]) || undefined}
                      ctaFontSize={readString(c, ["cta_font_size"]) || undefined}
                      headingFontWeight={c.heading_font_weight as string | number | undefined}
                      subheadingFontWeight={c.subheading_font_weight as string | number | undefined}
                      ctaFontWeight={c.cta_font_weight as string | number | undefined}
                      sectionPaddingTop={readString(c, ["section_padding_top"]) || undefined}
                      sectionPaddingBottom={readString(c, ["section_padding_bottom"]) || undefined}
                      contentMaxWidth={readString(c, ["content_max_width"]) || undefined}
                      contentGap={readString(c, ["content_gap"]) || undefined}
                      sectionBorderRadius={readString(c, ["border_radius"]) || undefined}
                      sectionBorderWidth={readString(c, ["section_border_width"]) || undefined}
                      sectionBorderColor={readString(c, ["section_border_color"]) || undefined}
                      sectionShadow={readString(c, ["section_shadow"]) || undefined}
                      overlayColor={readString(c, ["overlay_color"]) || undefined}
                      overlayOpacity={typeof c.overlay_opacity === "number" ? c.overlay_opacity : Number(c.overlay_opacity) || undefined}
                      accentColor={readString(c, ["accent_color"]) || undefined}
                      headingColor={readString(c, ["heading_color"]) || undefined}
                      subheadingColor={readString(c, ["subheading_color"]) || undefined}
                      eyebrowColor={readString(c, ["eyebrow_color"]) || undefined}
                      primaryButtonBgColor={readString(c, ["primary_button_bg_color"]) || undefined}
                      primaryButtonTextColor={readString(c, ["primary_button_text_color"]) || undefined}
                      primaryButtonBorderColor={readString(c, ["primary_button_border_color"]) || undefined}
                      secondaryButtonBgColor={readString(c, ["secondary_button_bg_color"]) || undefined}
                      secondaryButtonTextColor={readString(c, ["secondary_button_text_color"]) || undefined}
                      secondaryButtonBorderColor={readString(c, ["secondary_button_border_color"]) || undefined}
                      cardBackgroundColor={readString(c, ["card_background_color"]) || undefined}
                      cardBorderColor={readString(c, ["card_border_color"]) || undefined}
                      cardShadow={readString(c, ["card_shadow"]) || undefined}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Preview hidden. Use the toggle below to bring it back.
                </div>
              )}
            </div>

            <div className="xl:min-h-0">
              <Card className="h-full border-border/70 shadow-sm xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
                <CardHeader className="border-b bg-muted/20 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Hero Settings</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>
                      {isPreviewVisible ? "Hide preview" : "Show preview"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
            <FieldRow label="Eyebrow / Preheading">
              <Input value={eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Plumbing & heating specialists" />
            </FieldRow>
            <FieldRow label="Layout">
              <Select value={String(c.layout ?? "full")} onValueChange={(v) => set("layout", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full-width (dark background)</SelectItem>
                  <SelectItem value="centered">Centered (dark background)</SelectItem>
                  <SelectItem value="split">Split (image + content, light)</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Variant">
              <Select value={String(c.variant ?? "default")} onValueChange={(v) => set("variant", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Hero Style">
              <Select value={String(c.heroStyle ?? "default")} onValueChange={(v) => set("heroStyle", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Tone">
              <Select value={String(c.tone ?? "default")} onValueChange={(v) => set("tone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="navy">Navy</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Density">
              <Select value={String(c.density ?? "normal")} onValueChange={(v) => set("density", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="CTA Style">
              <Select value={String(c.ctaStyle ?? "default")} onValueChange={(v) => set("ctaStyle", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="soft">Soft</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Heading Accent Word">
              <Input value={String(c.heading_accent ?? "")} onChange={(e) => set("heading_accent", e.target.value)} placeholder="One word from the heading to highlight in colour" />
            </FieldRow>
            <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
            <FieldRow label="Primary Button Text"><Input value={primaryText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
            <FieldRow label="Primary Button URL"><Input value={primaryUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
            <FieldRow label="Secondary Button Text (optional)"><Input value={secondaryText} onChange={(e) => onChange(syncBlockContent(c, { secondary_cta_text: e.target.value, secondaryCtaLabel: e.target.value, secondaryButtonText: e.target.value }, { secondary_cta_text: ["secondaryCtaLabel", "secondaryButtonText"], secondaryCtaLabel: ["secondary_cta_text", "secondaryButtonText"], secondaryButtonText: ["secondary_cta_text", "secondaryCtaLabel"] }))} /></FieldRow>
            <FieldRow label="Secondary Button URL"><Input value={secondaryUrl} onChange={(e) => onChange(syncBlockContent(c, { secondary_cta_url: e.target.value, secondaryCtaHref: e.target.value, secondaryButtonUrl: e.target.value }, { secondary_cta_url: ["secondaryCtaHref", "secondaryButtonUrl"], secondaryCtaHref: ["secondary_cta_url", "secondaryButtonUrl"], secondaryButtonUrl: ["secondary_cta_url", "secondaryCtaHref"] }))} placeholder="/services" /></FieldRow>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Trust Items (icon + text)</Label>
              {trustItems.map((item, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[90px_1fr_auto]">
                  <Input
                    value={item.icon || ""}
                    onChange={(e) => {
                      const next = [...trustItems];
                      next[i] = { ...next[i], icon: e.target.value || "✓" };
                      onChange({ ...c, trust_items: next });
                    }}
                    placeholder="✓"
                  />
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const next = [...trustItems];
                      next[i] = { ...next[i], text: e.target.value };
                      onChange({ ...c, trust_items: next });
                    }}
                    placeholder="Fully Insured"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => onChange({ ...c, trust_items: trustItems.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...c, trust_items: [...trustItems, { icon: "✓", text: "" }] })}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Trust Item
              </Button>
            </div>

            <FieldRow label="Trust Badges (legacy, one per line)">
              <Textarea
                value={trustBadges.join("\n")}
                onChange={(e) => {
                  const next = e.target.value.split("\n").map((item) => item.trim()).filter(Boolean);
                  onChange(syncBlockContent(c, { trustBadges: next, trust_badges: next }, { trustBadges: ["trust_badges"], trust_badges: ["trustBadges"] }));
                }}
                rows={3}
                placeholder={"Fully Insured\nLocal Engineers\nFast Response\nFree Quotes"}
              />
            </FieldRow>
            <ImagePickerField
              label="Background Image URL (full/centered layouts)"
              value={backgroundImage}
              onChange={(url) => onChange(syncBlockContent(c, { background_image_url: url, backgroundImageUrl: url }, { background_image_url: ["backgroundImageUrl"], backgroundImageUrl: ["background_image_url"] }))}
              hint="Recommended: 1920 × 1080 px (landscape). Used as the hero background."
              fieldName="hero_background"
            />
            <ImagePickerField
              label="Hero Image URL (split layout only)"
              value={heroImage}
              onChange={(url) => onChange(syncBlockContent(c, { hero_image_url: url, heroImageUrl: url }, { hero_image_url: ["heroImageUrl"], heroImageUrl: ["hero_image_url"] }))}
              hint="Recommended: 900 × 700 px (portrait or square works best)."
              fieldName="hero_image"
            />
            <div className="flex gap-3">
              <FieldRow label="Background Colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={backgroundColor} onChange={(e) => onChange(syncBlockContent(c, { background_color: e.target.value, backgroundColor: e.target.value }, { background_color: ["backgroundColor"], backgroundColor: ["background_color"] }))} className="h-8 w-12 cursor-pointer rounded border" />
                  <Input value={backgroundColor} onChange={(e) => onChange(syncBlockContent(c, { background_color: e.target.value, backgroundColor: e.target.value }, { background_color: ["backgroundColor"], backgroundColor: ["background_color"] }))} className="flex-1" />
                </div>
              </FieldRow>
              <FieldRow label="Text Colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={textColor} onChange={(e) => onChange(syncBlockContent(c, { text_color: e.target.value, textColor: e.target.value }, { text_color: ["textColor"], textColor: ["text_color"] }))} className="h-8 w-12 cursor-pointer rounded border" />
                  <Input value={textColor} onChange={(e) => onChange(syncBlockContent(c, { text_color: e.target.value, textColor: e.target.value }, { text_color: ["textColor"], textColor: ["text_color"] }))} className="flex-1" />
                </div>
              </FieldRow>
            </div>
            <Separator />
            <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-0 text-sm">
                Hero Colours
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label="Accent Colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["accent_color"], "#f97316")} onChange={(e) => set("accent_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["accent_color"], "")} onChange={(e) => set("accent_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Eyebrow Colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["eyebrow_color"], "#f97316")} onChange={(e) => set("eyebrow_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["eyebrow_color"], "")} onChange={(e) => set("eyebrow_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Heading Colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["heading_color"], "#ffffff")} onChange={(e) => set("heading_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["heading_color"], "")} onChange={(e) => set("heading_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Subheading Colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["subheading_color"], "#cbd5e1")} onChange={(e) => set("subheading_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["subheading_color"], "")} onChange={(e) => set("subheading_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Primary Button Background">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["primary_button_bg_color"], "#f97316")} onChange={(e) => set("primary_button_bg_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["primary_button_bg_color"], "")} onChange={(e) => set("primary_button_bg_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Primary Button Text">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["primary_button_text_color"], "#ffffff")} onChange={(e) => set("primary_button_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["primary_button_text_color"], "")} onChange={(e) => set("primary_button_text_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Primary Button Border">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["primary_button_border_color"], "#f97316")} onChange={(e) => set("primary_button_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["primary_button_border_color"], "")} onChange={(e) => set("primary_button_border_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Secondary Button Background">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["secondary_button_bg_color"], "#ffffff")} onChange={(e) => set("secondary_button_bg_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["secondary_button_bg_color"], "")} onChange={(e) => set("secondary_button_bg_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Secondary Button Text">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["secondary_button_text_color"], "#ffffff")} onChange={(e) => set("secondary_button_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["secondary_button_text_color"], "")} onChange={(e) => set("secondary_button_text_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Secondary Button Border">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["secondary_button_border_color"], "#d1d5db")} onChange={(e) => set("secondary_button_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["secondary_button_border_color"], "")} onChange={(e) => set("secondary_button_border_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Badge Background">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["badge_bg_color"], "#ffffff")} onChange={(e) => set("badge_bg_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["badge_bg_color"], "")} onChange={(e) => set("badge_bg_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Badge Text">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["badge_text_color"], "#111827")} onChange={(e) => set("badge_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["badge_text_color"], "")} onChange={(e) => set("badge_text_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Badge Border">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["badge_border_color"], "#d1d5db")} onChange={(e) => set("badge_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["badge_border_color"], "")} onChange={(e) => set("badge_border_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Trust Icon Colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["trust_icon_color"], "#f97316")} onChange={(e) => set("trust_icon_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["trust_icon_color"], "")} onChange={(e) => set("trust_icon_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Trust Text Colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["trust_text_color"], "#ffffff")} onChange={(e) => set("trust_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["trust_text_color"], "")} onChange={(e) => set("trust_text_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Card Background">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["card_background_color"], "#ffffff")} onChange={(e) => set("card_background_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["card_background_color"], "")} onChange={(e) => set("card_background_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Card Border">
                  <div className="flex items-center gap-2">
                    <input type="color" value={readString(c, ["card_border_color"], "#d1d5db")} onChange={(e) => set("card_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={readString(c, ["card_border_color"], "")} onChange={(e) => set("card_border_color", e.target.value)} className="flex-1" />
                  </div>
                </FieldRow>
              </div>
            </CollapsibleContent>
            </Collapsible>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="hidden space-y-3">
            {isPreviewVisible ? (
              <Card className="overflow-hidden border-border/70 shadow-xl">
                <CardHeader className="border-b bg-muted/40 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Live Preview</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>
                      Hide preview
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <HeroPreviewBlock
                    eyebrow={eyebrow || undefined}
                    layout={(c.layout as "full" | "centered" | "split") ?? "full"}
                    variant={(c.variant as "default" | "classic" | "modern") ?? "default"}
                    heroStyle={(c.heroStyle as "default" | "classic" | "modern") ?? "default"}
                    tone={(c.tone as "default" | "navy" | "light") ?? "default"}
                    ctaStyle={(c.ctaStyle as "default" | "rounded" | "soft" | "outline") ?? "default"}
                    density={(c.density as "normal" | "comfortable" | "compact") ?? "normal"}
                    title={heroPreviewTitle}
                    headingAccent={readString(c, ["heading_accent"]) || undefined}
                    subtitle={heroPreviewSubtitle}
                    primaryCtaLabel={heroPreviewPrimary}
                    primaryCtaHref={primaryUrl || undefined}
                    secondaryCtaLabel={heroPreviewSecondary}
                    secondaryCtaHref={secondaryUrl || undefined}
                    phone={String(c.cta_phone ?? "") || undefined}
                    trustBadges={previewTrustBadges.length ? previewTrustBadges : undefined}
                    backgroundImageUrl={backgroundImage || undefined}
                    heroImageUrl={heroImage || undefined}
                    backgroundColor={backgroundColor || undefined}
                    textColor={textColor || undefined}
                    primaryColor={readString(c, ["primary_color"]) || undefined}
                    primaryTextColor={readString(c, ["primary_text_color"]) || undefined}
                    mutedBackgroundColor={readString(c, ["muted_background_color"]) || undefined}
                    mutedTextColor={readString(c, ["muted_text_color"]) || undefined}
                    imageAlt={String(c.imageAlt ?? "Hero image preview")}
                    fontFamily={readString(c, ["font_family"]) || undefined}
                    headingFontFamily={readString(c, ["heading_font_family"]) || undefined}
                    bodyFontFamily={readString(c, ["body_font_family"]) || undefined}
                    ctaFontFamily={readString(c, ["cta_font_family"]) || undefined}
                    headingFontSize={readString(c, ["heading_font_size"]) || undefined}
                    subheadingFontSize={readString(c, ["subheading_font_size"]) || undefined}
                    eyebrowFontSize={readString(c, ["eyebrow_font_size"]) || undefined}
                    ctaFontSize={readString(c, ["cta_font_size"]) || undefined}
                    headingFontWeight={c.heading_font_weight as string | number | undefined}
                    subheadingFontWeight={c.subheading_font_weight as string | number | undefined}
                    ctaFontWeight={c.cta_font_weight as string | number | undefined}
                    sectionPaddingTop={readString(c, ["section_padding_top"]) || undefined}
                    sectionPaddingBottom={readString(c, ["section_padding_bottom"]) || undefined}
                    contentMaxWidth={readString(c, ["content_max_width"]) || undefined}
                    contentGap={readString(c, ["content_gap"]) || undefined}
                    sectionBorderRadius={readString(c, ["border_radius"]) || undefined}
                    sectionBorderWidth={readString(c, ["section_border_width"]) || undefined}
                    sectionBorderColor={readString(c, ["section_border_color"]) || undefined}
                    sectionShadow={readString(c, ["section_shadow"]) || undefined}
                    overlayColor={readString(c, ["overlay_color"]) || undefined}
                    overlayOpacity={typeof c.overlay_opacity === "number" ? c.overlay_opacity : Number(c.overlay_opacity) || undefined}
                    accentColor={readString(c, ["accent_color"]) || undefined}
                    headingColor={readString(c, ["heading_color"]) || undefined}
                    subheadingColor={readString(c, ["subheading_color"]) || undefined}
                    eyebrowColor={readString(c, ["eyebrow_color"]) || undefined}
                    primaryButtonBgColor={readString(c, ["primary_button_bg_color"]) || undefined}
                    primaryButtonTextColor={readString(c, ["primary_button_text_color"]) || undefined}
                    primaryButtonBorderColor={readString(c, ["primary_button_border_color"]) || undefined}
                    secondaryButtonBgColor={readString(c, ["secondary_button_bg_color"]) || undefined}
                    secondaryButtonTextColor={readString(c, ["secondary_button_text_color"]) || undefined}
                    secondaryButtonBorderColor={readString(c, ["secondary_button_border_color"]) || undefined}
                    cardBackgroundColor={readString(c, ["card_background_color"]) || undefined}
                    cardBorderColor={readString(c, ["card_border_color"]) || undefined}
                    cardShadow={readString(c, ["card_shadow"]) || undefined}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="border-b bg-muted/20 py-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">Hero Settings</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>
                    {isPreviewVisible ? "Hide preview" : "Show preview"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <FieldRow label="Eyebrow / Preheading">
                  <Input value={eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Plumbing & heating specialists" />
                </FieldRow>
                <FieldRow label="Layout">
                  <Select value={String(c.layout ?? "full")} onValueChange={(v) => set("layout", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full-width (dark background)</SelectItem>
                      <SelectItem value="centered">Centered (dark background)</SelectItem>
                      <SelectItem value="split">Split (image + content, light)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Variant">
                  <Select value={String(c.variant ?? "default")} onValueChange={(v) => set("variant", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Hero Style">
                  <Select value={String(c.heroStyle ?? "default")} onValueChange={(v) => set("heroStyle", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Tone">
                  <Select value={String(c.tone ?? "default")} onValueChange={(v) => set("tone", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="navy">Navy</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Density">
                  <Select value={String(c.density ?? "normal")} onValueChange={(v) => set("density", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="CTA Style">
                  <Select value={String(c.ctaStyle ?? "default")} onValueChange={(v) => set("ctaStyle", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="rounded">Rounded</SelectItem>
                      <SelectItem value="soft">Soft</SelectItem>
                      <SelectItem value="outline">Outline</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
                <FieldRow label="Heading Accent Word">
                  <Input value={String(c.heading_accent ?? "")} onChange={(e) => set("heading_accent", e.target.value)} placeholder="One word from the heading to highlight in colour" />
                </FieldRow>
                <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
                <FieldRow label="Primary Button Text"><Input value={primaryText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
                <FieldRow label="Primary Button URL"><Input value={primaryUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
                <FieldRow label="Secondary Button Text (optional)"><Input value={secondaryText} onChange={(e) => onChange(syncBlockContent(c, { secondary_cta_text: e.target.value, secondaryCtaLabel: e.target.value, secondaryButtonText: e.target.value }, { secondary_cta_text: ["secondaryCtaLabel", "secondaryButtonText"], secondaryCtaLabel: ["secondary_cta_text", "secondaryButtonText"], secondaryButtonText: ["secondary_cta_text", "secondaryCtaLabel"] }))} /></FieldRow>
                <FieldRow label="Secondary Button URL"><Input value={secondaryUrl} onChange={(e) => onChange(syncBlockContent(c, { secondary_cta_url: e.target.value, secondaryCtaHref: e.target.value, secondaryButtonUrl: e.target.value }, { secondary_cta_url: ["secondaryCtaHref", "secondaryButtonUrl"], secondaryCtaHref: ["secondary_cta_url", "secondaryButtonUrl"], secondaryButtonUrl: ["secondary_cta_url", "secondaryCtaHref"] }))} placeholder="/services" /></FieldRow>
                <ImagePickerField
                  label="Background Image URL (full/centered layouts)"
                  value={backgroundImage}
                  onChange={(url) => onChange(syncBlockContent(c, { background_image_url: url, backgroundImageUrl: url }, { background_image_url: ["backgroundImageUrl"], backgroundImageUrl: ["background_image_url"] }))}
                  hint="Recommended: 1920 × 1080 px (landscape). Used as the hero background."
                  fieldName="hero_background"
                />
                <ImagePickerField
                  label="Hero Image URL (split layout only)"
                  value={heroImage}
                  onChange={(url) => onChange(syncBlockContent(c, { hero_image_url: url, heroImageUrl: url }, { hero_image_url: ["heroImageUrl"], heroImageUrl: ["hero_image_url"] }))}
                  hint="Recommended: 900 × 700 px (portrait or square works best)."
                  fieldName="hero_image"
                />
                <div className="flex gap-3">
                  <FieldRow label="Background Colour">
                    <div className="flex items-center gap-2">
                      <input type="color" value={backgroundColor} onChange={(e) => onChange(syncBlockContent(c, { background_color: e.target.value, backgroundColor: e.target.value }, { background_color: ["backgroundColor"], backgroundColor: ["background_color"] }))} className="h-8 w-12 cursor-pointer rounded border" />
                      <Input value={backgroundColor} onChange={(e) => onChange(syncBlockContent(c, { background_color: e.target.value, backgroundColor: e.target.value }, { background_color: ["backgroundColor"], backgroundColor: ["background_color"] }))} className="flex-1" />
                    </div>
                  </FieldRow>
                  <FieldRow label="Text Colour">
                    <div className="flex items-center gap-2">
                      <input type="color" value={textColor} onChange={(e) => onChange(syncBlockContent(c, { text_color: e.target.value, textColor: e.target.value }, { text_color: ["textColor"], textColor: ["text_color"] }))} className="h-8 w-12 cursor-pointer rounded border" />
                      <Input value={textColor} onChange={(e) => onChange(syncBlockContent(c, { text_color: e.target.value, textColor: e.target.value }, { text_color: ["textColor"], textColor: ["text_color"] }))} className="flex-1" />
                    </div>
                  </FieldRow>
                </div>
                <Separator />
                <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-0 text-sm">
                    Hero Colours
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldRow label="Accent Colour">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["accent_color"], "#f97316")} onChange={(e) => set("accent_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["accent_color"], "")} onChange={(e) => set("accent_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Eyebrow Colour">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["eyebrow_color"], "#f97316")} onChange={(e) => set("eyebrow_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["eyebrow_color"], "")} onChange={(e) => set("eyebrow_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Heading Colour">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["heading_color"], "#ffffff")} onChange={(e) => set("heading_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["heading_color"], "")} onChange={(e) => set("heading_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Subheading Colour">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["subheading_color"], "#cbd5e1")} onChange={(e) => set("subheading_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["subheading_color"], "")} onChange={(e) => set("subheading_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Primary Button Background">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["primary_button_bg_color"], "#f97316")} onChange={(e) => set("primary_button_bg_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["primary_button_bg_color"], "")} onChange={(e) => set("primary_button_bg_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Primary Button Text">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["primary_button_text_color"], "#ffffff")} onChange={(e) => set("primary_button_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["primary_button_text_color"], "")} onChange={(e) => set("primary_button_text_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Primary Button Border">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["primary_button_border_color"], "#f97316")} onChange={(e) => set("primary_button_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["primary_button_border_color"], "")} onChange={(e) => set("primary_button_border_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Secondary Button Background">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["secondary_button_bg_color"], "#ffffff")} onChange={(e) => set("secondary_button_bg_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["secondary_button_bg_color"], "")} onChange={(e) => set("secondary_button_bg_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Secondary Button Text">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["secondary_button_text_color"], "#ffffff")} onChange={(e) => set("secondary_button_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["secondary_button_text_color"], "")} onChange={(e) => set("secondary_button_text_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Secondary Button Border">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["secondary_button_border_color"], "#d1d5db")} onChange={(e) => set("secondary_button_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["secondary_button_border_color"], "")} onChange={(e) => set("secondary_button_border_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Badge Background">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["badge_bg_color"], "#ffffff")} onChange={(e) => set("badge_bg_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["badge_bg_color"], "")} onChange={(e) => set("badge_bg_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Badge Text">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["badge_text_color"], "#111827")} onChange={(e) => set("badge_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["badge_text_color"], "")} onChange={(e) => set("badge_text_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Badge Border">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["badge_border_color"], "#d1d5db")} onChange={(e) => set("badge_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["badge_border_color"], "")} onChange={(e) => set("badge_border_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Trust Icon Colour">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["trust_icon_color"], "#f97316")} onChange={(e) => set("trust_icon_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["trust_icon_color"], "")} onChange={(e) => set("trust_icon_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Trust Text Colour">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["trust_text_color"], "#ffffff")} onChange={(e) => set("trust_text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["trust_text_color"], "")} onChange={(e) => set("trust_text_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Card Background">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["card_background_color"], "#ffffff")} onChange={(e) => set("card_background_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["card_background_color"], "")} onChange={(e) => set("card_background_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Card Border">
                      <div className="flex items-center gap-2">
                        <input type="color" value={readString(c, ["card_border_color"], "#d1d5db")} onChange={(e) => set("card_border_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                        <Input value={readString(c, ["card_border_color"], "")} onChange={(e) => set("card_border_color", e.target.value)} className="flex-1" />
                      </div>
                    </FieldRow>
                  </div>
                </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    case "text":
      {
      const heading = readString(c, ["heading", "title"]);
      const eyebrow = readString(c, ["eyebrow", "label"]);
      const subtitle = readString(c, ["subtitle", "subheading"]);
      const body = readString(c, ["html", "body", "text"]);
      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)">
            <Input
              value={eyebrow}
              onChange={(e) => onChange(syncBlockContent(c, { eyebrow: e.target.value, label: e.target.value }, { eyebrow: ["label"], label: ["eyebrow"] }))}
              placeholder="Why Choose Us"
            />
          </FieldRow>
          <FieldRow label="Heading (optional)"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} placeholder="Section heading..." /></FieldRow>
          <FieldRow label="Subtitle (optional)">
            <Input
              value={subtitle}
              onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))}
              placeholder="A short supporting line"
            />
          </FieldRow>
          <FieldRow label="Content">
            <Textarea value={body} onChange={(e) => onChange(syncBlockContent(c, { html: e.target.value, body: e.target.value, text: e.target.value }, { html: ["body", "text"], body: ["html", "text"], text: ["html", "body"] }))} rows={6} placeholder="Enter your content here..." />
          </FieldRow>
          <FieldRow label="Alignment">
            <Select value={String(c.align ?? "left")} onValueChange={(v) => set("align", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      );
      }

    case "cta": {
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const buttonText = readString(c, ["cta_text", "primaryCtaLabel", "primaryButtonText"]);
      const buttonUrl = readString(c, ["cta_url", "primaryCtaHref", "primaryButtonUrl"]);
      const secondaryText = readString(c, ["secondary_cta_text", "secondaryCtaLabel"], "Call us");
      const secondaryUrl = readString(c, ["secondary_cta_url", "secondaryCtaHref"], "tel:+441224000000");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "center-banner");
      const backgroundColor = readString(c, ["background_color", "backgroundColor"], "#f97316");
      const textColor = readString(c, ["text_color", "textColor"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#ffffff4d");
      const primaryButtonBg = readString(c, ["primary_button_bg"], "#0f172a");
      const primaryButtonText = readString(c, ["primary_button_text"], "#ffffff");
      const secondaryButtonBg = readString(c, ["secondary_button_bg"], "transparent");
      const secondaryButtonText = readString(c, ["secondary_button_text"], textColor);
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const buttonFont = readString(c, ["button_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const subheadingSize = readString(c, ["subheading_size"], "1.0625rem");
      const maxWidth = readString(c, ["max_width"], "1200px");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>
                        Hide preview
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "28px 20px", backgroundColor, color: textColor }}>
                      <div style={{ maxWidth, margin: "0 auto" }}>
                        {layoutVariant === "split-inline" ? (
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                            <div style={{ maxWidth: "70%" }}>
                              <h3 style={{ margin: "0 0 8px", fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Need help with your project?"}</h3>
                              <p style={{ margin: 0, fontSize: subheadingSize, fontFamily: bodyFont }}>{subheading || "Get practical advice and a clear next step from a local expert."}</p>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <a href={buttonUrl || "#"} style={{ padding: "10px 14px", borderRadius: 10, background: primaryButtonBg, color: primaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{buttonText || "Request a quote"}</a>
                              <a href={secondaryUrl || "#"} style={{ padding: "10px 14px", borderRadius: 10, background: secondaryButtonBg, color: secondaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{secondaryText || "Call us"}</a>
                            </div>
                          </div>
                        ) : layoutVariant === "stacked-card" ? (
                          <div style={{ textAlign: "center", border: `1px solid ${borderColor}`, borderRadius: 14, padding: "20px 16px", background: "rgba(255,255,255,0.06)" }}>
                            <h3 style={{ margin: "0 0 8px", fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Need help with your project?"}</h3>
                            <p style={{ margin: "0 0 14px", fontSize: subheadingSize, fontFamily: bodyFont }}>{subheading || "Get practical advice and a clear next step from a local expert."}</p>
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                              <a href={buttonUrl || "#"} style={{ padding: "10px 14px", borderRadius: 10, background: primaryButtonBg, color: primaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{buttonText || "Request a quote"}</a>
                              <a href={secondaryUrl || "#"} style={{ padding: "10px 14px", borderRadius: 10, background: secondaryButtonBg, color: secondaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{secondaryText || "Call us"}</a>
                            </div>
                          </div>
                        ) : layoutVariant === "minimal-strip" ? (
                          <div style={{ borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, padding: "12px 0" }}>
                            <h3 style={{ margin: "0 0 6px", fontSize: "1.35rem", fontWeight: 700, fontFamily: headingFont }}>{heading || "Need help with your project?"}</h3>
                            <p style={{ margin: "0 0 10px", fontSize: "0.95rem", fontFamily: bodyFont }}>{subheading || "Get practical advice and a clear next step from a local expert."}</p>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <a href={buttonUrl || "#"} style={{ padding: "9px 12px", borderRadius: 10, background: primaryButtonBg, color: primaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{buttonText || "Request a quote"}</a>
                              <a href={secondaryUrl || "#"} style={{ padding: "9px 12px", borderRadius: 10, background: secondaryButtonBg, color: secondaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{secondaryText || "Call us"}</a>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", margin: "0 auto", maxWidth: 740 }}>
                            <h3 style={{ margin: "0 0 8px", fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Need help with your project?"}</h3>
                            <p style={{ margin: "0 0 14px", fontSize: subheadingSize, fontFamily: bodyFont }}>{subheading || "Get practical advice and a clear next step from a local expert."}</p>
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                              <a href={buttonUrl || "#"} style={{ padding: "10px 14px", borderRadius: 10, background: primaryButtonBg, color: primaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{buttonText || "Request a quote"}</a>
                              <a href={secondaryUrl || "#"} style={{ padding: "10px 14px", borderRadius: 10, background: secondaryButtonBg, color: secondaryButtonText, textDecoration: "none", border: `1px solid ${borderColor}`, fontWeight: 700, fontFamily: buttonFont }}>{secondaryText || "Call us"}</a>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                  Preview hidden for this block.
                </div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>
                  {isPreviewVisible ? "Hide preview" : "Show preview"}
                </Button>
              </div>

              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center-banner">Center Banner</SelectItem>
                    <SelectItem value="split-inline">Split Inline</SelectItem>
                    <SelectItem value="stacked-card">Stacked Card</SelectItem>
                    <SelectItem value="minimal-strip">Minimal Strip</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading"><Textarea rows={2} value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
              <FieldRow label="Primary Button Text"><Input value={buttonText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
              <FieldRow label="Primary Button URL"><Input value={buttonUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
              <FieldRow label="Secondary Button Text"><Input value={secondaryText} onChange={(e) => onChange(syncBlockContent(c, { secondary_cta_text: e.target.value, secondaryCtaLabel: e.target.value }, { secondary_cta_text: ["secondaryCtaLabel"], secondaryCtaLabel: ["secondary_cta_text"] }))} /></FieldRow>
              <FieldRow label="Secondary Button URL"><Input value={secondaryUrl} onChange={(e) => onChange(syncBlockContent(c, { secondary_cta_url: e.target.value, secondaryCtaHref: e.target.value }, { secondary_cta_url: ["secondaryCtaHref"], secondaryCtaHref: ["secondary_cta_url"] }))} placeholder="tel:+441224000000" /></FieldRow>

              <FieldRow label="Max Width"><Input value={maxWidth} onChange={(e) => set("max_width", e.target.value)} placeholder="1200px" /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} placeholder="inherit" /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} placeholder="inherit" /></FieldRow>
              <FieldRow label="Button Font"><Input value={buttonFont} onChange={(e) => set("button_font_family", e.target.value)} placeholder="inherit" /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} placeholder="2rem" /></FieldRow>
              <FieldRow label="Subheading Size"><Input value={subheadingSize} onChange={(e) => set("subheading_size", e.target.value)} placeholder="1.0625rem" /></FieldRow>

              <div className="flex gap-3">
                <FieldRow label="Background">
                  <div className="flex items-center gap-2">
                    <input type="color" value={backgroundColor} onChange={(e) => onChange(syncBlockContent(c, { background_color: e.target.value, backgroundColor: e.target.value }, { background_color: ["backgroundColor"], backgroundColor: ["background_color"] }))} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={backgroundColor} onChange={(e) => onChange(syncBlockContent(c, { background_color: e.target.value, backgroundColor: e.target.value }, { background_color: ["backgroundColor"], backgroundColor: ["background_color"] }))} className="flex-1" />
                  </div>
                </FieldRow>
                <FieldRow label="Text">
                  <div className="flex items-center gap-2">
                    <input type="color" value={textColor} onChange={(e) => onChange(syncBlockContent(c, { text_color: e.target.value, textColor: e.target.value }, { text_color: ["textColor"], textColor: ["text_color"] }))} className="h-8 w-12 cursor-pointer rounded border" />
                    <Input value={textColor} onChange={(e) => onChange(syncBlockContent(c, { text_color: e.target.value, textColor: e.target.value }, { text_color: ["textColor"], textColor: ["text_color"] }))} className="flex-1" />
                  </div>
                </FieldRow>
              </div>

              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Primary Button BG"><Input value={primaryButtonBg} onChange={(e) => set("primary_button_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Primary Button Text"><Input value={primaryButtonText} onChange={(e) => set("primary_button_text", e.target.value)} /></FieldRow>
              <FieldRow label="Secondary Button BG"><Input value={secondaryButtonBg} onChange={(e) => set("secondary_button_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Secondary Button Text"><Input value={secondaryButtonText} onChange={(e) => set("secondary_button_text", e.target.value)} /></FieldRow>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center-banner">Center Banner</SelectItem>
                  <SelectItem value="split-inline">Split Inline</SelectItem>
                  <SelectItem value="stacked-card">Stacked Card</SelectItem>
                  <SelectItem value="minimal-strip">Minimal Strip</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading"><Textarea rows={2} value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
            <FieldRow label="Primary Button Text"><Input value={buttonText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
            <FieldRow label="Primary Button URL"><Input value={buttonUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
          </div>
        </div>
      );
    }

    case "services": {
      const serviceFieldKey = Array.isArray(c.items) ? "items" : "services";
      const items = readArray<{ title: string; description: string; icon: string; cta_text?: string; cta_url?: string; badge?: string }>(c, ["services", "items"]);
      const updateItems = (next: Array<{ title: string; description: string; icon: string; cta_text?: string; cta_url?: string; badge?: string }>) => {
        if (serviceFieldKey === "items") {
          onChange({ ...c, items: next, services: next });
          return;
        }
        onChange({ ...c, services: next, items: next });
      };
      const heading = readString(c, ["heading", "title"]);
      const subtitle = readString(c, ["subtitle", "subheading"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "card-grid");
      const columns = String(c.columns ?? "3");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg", "card_background_color"], "#ffffff");
      const cardBorder = readString(c, ["card_border", "card_border_color", "border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#f97316");
      const headingColor = readString(c, ["heading_color", "text_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#6b7280");
      const linkColor = readString(c, ["link_color"], accentColor);
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const buttonFont = readString(c, ["button_font_family"], "inherit");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "24px 18px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 6px", color: headingColor, fontSize: "1.35rem", fontWeight: 800, fontFamily: headingFont }}>{heading || "How we can help"}</h3>
                      <p style={{ margin: "0 0 14px", color: bodyColor, fontFamily: bodyFont }}>{subtitle || "Core services for homeowners and businesses."}</p>
                      <div style={{ display: "grid", gridTemplateColumns: layoutVariant === "split-list" ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                        {items.slice(0, 4).map((item, i) => (
                          <article key={i} style={{ border: `1px solid ${cardBorder}`, borderRadius: 10, background: cardBg, padding: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span>{item.icon || "⚙️"}</span>
                              <strong style={{ color: headingColor, fontFamily: headingFont }}>{item.title || "Service"}</strong>
                            </div>
                            <p style={{ margin: "6px 0 8px", color: bodyColor, fontSize: "0.85rem", fontFamily: bodyFont }}>{item.description || "Service description"}</p>
                            <span style={{ color: linkColor, fontWeight: 700, fontSize: "0.82rem", fontFamily: buttonFont }}>{item.cta_text || "Learn more"} →</span>
                          </article>
                        ))}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card-grid">Card Grid</SelectItem>
                    <SelectItem value="split-list">Split List</SelectItem>
                    <SelectItem value="icon-panels">Icon Panels</SelectItem>
                    <SelectItem value="compact-rows">Compact Rows</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Columns">
                <Select value={columns} onValueChange={(v) => set("columns", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading"><Textarea value={subtitle} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} rows={2} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Button Font"><Input value={buttonFont} onChange={(e) => set("button_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Border"><Input value={cardBorder} onChange={(e) => set("card_border", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Colour"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Colour"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Colour"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Link Colour"><Input value={linkColor} onChange={(e) => set("link_color", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Service Items</Label>
                {items.map((item, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.icon} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], icon: e.target.value }; updateItems(n); }} placeholder="🔥" className="w-16 text-center" />
                      <Input value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; updateItems(n); }} placeholder="Service name" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateItems(items.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                    <Textarea value={item.description} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; updateItems(n); }} placeholder="Short description..." rows={2} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={String(item.cta_text ?? "")} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], cta_text: e.target.value }; updateItems(n); }} placeholder="CTA text" />
                      <Input value={String(item.cta_url ?? "")} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], cta_url: e.target.value }; updateItems(n); }} placeholder="/services" />
                    </div>
                    <Input value={String(item.badge ?? "")} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], badge: e.target.value }; updateItems(n); }} placeholder="Badge (optional)" />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateItems([...items, { title: "", description: "", icon: "⚙️", cta_text: "Learn more", cta_url: "/services", badge: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Service
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card-grid">Card Grid</SelectItem>
                  <SelectItem value="split-list">Split List</SelectItem>
                  <SelectItem value="icon-panels">Icon Panels</SelectItem>
                  <SelectItem value="compact-rows">Compact Rows</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading"><Textarea value={subtitle} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "service_rates": {
      const heading = readString(c, ["heading", "title"], "Typical Service Rates");
      const subheading = readString(c, ["subheading", "subtitle"], "Clear starting prices for common jobs.");
      const label = readString(c, ["label", "eyebrow"], "Rates");
      const note = readString(c, ["note"], "Final quote depends on scope and parts.");
      const variation = readString(c, ["variation", "layout_variant", "layout"], "cards");
      const rates = readArray<{
        service: string;
        price: string;
        description?: string;
        duration?: string;
        badge?: string;
        ctaLabel?: string;
        ctaHref?: string;
      }>(c, ["rates", "items"]);
      const effectiveRates = rates;
      const updateRates = (next: typeof effectiveRates) => {
        onChange({ ...c, rates: next, items: next });
      };

      return (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How this block works</p>
            <p>
              If one or more services are enabled in Company Settings -&gt; Catalogue with <strong>Show in website service rates</strong>,
              the live website will use those catalogue services automatically.
            </p>
            <p>
              If no services are enabled there, this block uses the manual rate items below.
            </p>
          </div>
          <FieldRow label="Eyebrow / Label (optional)">
            <Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} />
          </FieldRow>
          <FieldRow label="Section Heading">
            <Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} />
          </FieldRow>
          <FieldRow label="Subheading">
            <Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} />
          </FieldRow>
          <FieldRow label="Variation">
            <Select value={variation} onValueChange={(v) => onChange(syncBlockContent(c, { variation: v, layout_variant: v, layout: v }, { variation: ["layout_variant", "layout"], layout_variant: ["variation", "layout"], layout: ["variation", "layout_variant"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cards">Cards</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="split">Split</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Footer Note (optional)">
            <Input value={note} onChange={(e) => set("note", e.target.value)} placeholder="Final quote depends on scope and parts." />
          </FieldRow>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Rate Items</Label>
            </div>
            {effectiveRates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No manual rates added yet. Add rates here only if you do not want to source them from Service Catalogue.</p>
            ) : null}
            {effectiveRates.map((rate, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
                  <Input value={rate.service} onChange={(e) => { const n = [...effectiveRates]; n[i] = { ...n[i], service: e.target.value }; updateRates(n); }} placeholder="Service name" />
                  <Input value={rate.price} onChange={(e) => { const n = [...effectiveRates]; n[i] = { ...n[i], price: e.target.value }; updateRates(n); }} placeholder="From £95" />
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => updateRates(effectiveRates.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Textarea value={String(rate.description ?? "")} onChange={(e) => { const n = [...effectiveRates]; n[i] = { ...n[i], description: e.target.value }; updateRates(n); }} placeholder="Short description" rows={2} />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={String(rate.duration ?? "")} onChange={(e) => { const n = [...effectiveRates]; n[i] = { ...n[i], duration: e.target.value }; updateRates(n); }} placeholder="45-90 min" />
                  <Input value={String(rate.badge ?? "")} onChange={(e) => { const n = [...effectiveRates]; n[i] = { ...n[i], badge: e.target.value }; updateRates(n); }} placeholder="Popular (optional)" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={String(rate.ctaLabel ?? "")} onChange={(e) => { const n = [...effectiveRates]; n[i] = { ...n[i], ctaLabel: e.target.value }; updateRates(n); }} placeholder="Get quote" />
                  <Input value={String(rate.ctaHref ?? "")} onChange={(e) => { const n = [...effectiveRates]; n[i] = { ...n[i], ctaHref: e.target.value }; updateRates(n); }} placeholder="/contact" />
                </div>
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => updateRates([...effectiveRates, { service: "", price: "", description: "", duration: "", badge: "", ctaLabel: "Get quote", ctaHref: "/contact" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Rate
            </Button>
          </div>
        </div>
      );
    }

    case "contact": {
      const eyebrow = readString(c, ["eyebrow", "label"]);
      const title = readString(c, ["title", "heading"]);
      const intro = readString(c, ["subtitle", "subheading"]);
      const phone = readString(c, ["phone"]);
      const email = readString(c, ["email"]);
      const address = readString(c, ["address"]);
      const openingHours = readString(c, ["openingHours", "hours"]);
      const serviceArea = readString(c, ["service_area"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "split-form");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#f9fafb");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color", "text_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#6b7280");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const buttonFont = readString(c, ["button_font_family"], "inherit");
      const isPreviewVisible = previewEnabled !== false;

      const previewRows = [
        phone ? `Phone: ${phone}` : null,
        email ? `Email: ${email}` : null,
        address ? `Address: ${address}` : null,
        serviceArea ? `Area: ${serviceArea}` : null,
        openingHours ? `Hours: ${openingHours}` : null,
      ].filter(Boolean) as string[];

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "22px 18px", background: sectionBg }}>
                      <div style={{ border: `1px solid ${borderColor}`, borderRadius: 12, background: cardBg, padding: 16 }}>
                        {eyebrow ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{eyebrow}</p> : null}
                        <h3 style={{ margin: "0 0 6px", color: headingColor, fontSize: "1.3rem", fontWeight: 800, fontFamily: headingFont }}>{title || "Request a quote or ask a question"}</h3>
                        <p style={{ margin: "0 0 12px", color: bodyColor, fontFamily: bodyFont }}>{intro || "Tell customers what happens after they contact you."}</p>
                        {layoutVariant === "minimal-list" ? (
                          <div style={{ borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}>
                            {previewRows.map((row, i) => <div key={i} style={{ padding: "8px 0", color: bodyColor, borderBottom: i < previewRows.length - 1 ? `1px solid ${borderColor}` : "none", fontFamily: bodyFont }}>{row}</div>)}
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {previewRows.map((row, i) => <div key={i} style={{ color: bodyColor, fontFamily: bodyFont }}>{row}</div>)}
                          </div>
                        )}
                        <div style={{ marginTop: 12 }}>
                          <button style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: accentColor, color: "#fff", fontWeight: 700, fontFamily: buttonFont }}>Send Message</button>
                        </div>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>

              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="split-form">Split Form</SelectItem>
                    <SelectItem value="card-overlay">Card Overlay</SelectItem>
                    <SelectItem value="centered-stack">Centered Stack</SelectItem>
                    <SelectItem value="minimal-list">Minimal List</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Small heading (optional)"><Input value={eyebrow} onChange={(e) => onChange(syncBlockContent(c, { eyebrow: e.target.value, label: e.target.value }, { eyebrow: ["label"], label: ["eyebrow"] }))} placeholder="Contact" /></FieldRow>
              <FieldRow label="Main title"><Input value={title} onChange={(e) => onChange(syncBlockContent(c, { title: e.target.value, heading: e.target.value }, { title: ["heading"], heading: ["title"] }))} placeholder="Request a quote or ask a question" /></FieldRow>
              <FieldRow label="Intro text"><Textarea value={intro} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} rows={2} placeholder="Tell customers what happens after they contact you." /></FieldRow>
              <FieldRow label="Phone number"><Input value={phone} onChange={(e) => set("phone", e.target.value)} placeholder="01224 000000" /></FieldRow>
              <FieldRow label="Email address"><Input value={email} onChange={(e) => set("email", e.target.value)} placeholder="hello@yourbusiness.co.uk" /></FieldRow>
              <FieldRow label="Address"><Input value={address} onChange={(e) => set("address", e.target.value)} placeholder="Aberdeenshire, Scotland" /></FieldRow>
              <FieldRow label="Service Area"><Input value={serviceArea} onChange={(e) => set("service_area", e.target.value)} placeholder="Aberdeenshire and nearby areas" /></FieldRow>
              <FieldRow label="Opening hours"><Input value={openingHours} onChange={(e) => onChange({ ...c, openingHours: e.target.value, hours: e.target.value })} placeholder="Monday to Friday, 8am to 5pm" /></FieldRow>

              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Colour"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Colour"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Colour"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Colour"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Button Font"><Input value={buttonFont} onChange={(e) => set("button_font_family", e.target.value)} /></FieldRow>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="split-form">Split Form</SelectItem>
                  <SelectItem value="card-overlay">Card Overlay</SelectItem>
                  <SelectItem value="centered-stack">Centered Stack</SelectItem>
                  <SelectItem value="minimal-list">Minimal List</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Main title"><Input value={title} onChange={(e) => onChange(syncBlockContent(c, { title: e.target.value, heading: e.target.value }, { title: ["heading"], heading: ["title"] }))} /></FieldRow>
            <FieldRow label="Intro text"><Textarea value={intro} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "testimonials": {
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "card-grid");
      const columns = String(c.columns ?? "3");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#f9fafb");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const cardBorder = readString(c, ["card_border", "border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color", "text_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#6b7280");
      const metaColor = readString(c, ["meta_color"], "#9ca3af");
      const starColor = readString(c, ["star_color"], "#f59e0b");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "0.9375rem");
      const isPreviewVisible = previewEnabled !== false;

      const sampleItems = [
        { author: "Customer", location: "Ellon", quote: "Great service and clear communication from start to finish." },
        { author: "Homeowner", location: "Inverurie", quote: "Turned up on time and solved the issue quickly." },
        { author: "Landlord", location: "Aberdeen", quote: "Professional work, fair pricing and helpful advice." },
      ];

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "24px 18px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "What customers say"}</h3>
                      {subheading ? <p style={{ margin: "0 0 12px", color: bodyColor, fontFamily: bodyFont }}>{subheading}</p> : null}

                      {layoutVariant === "compact-rows" ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {sampleItems.map((item, i) => (
                            <div key={i} style={{ border: `1px solid ${cardBorder}`, borderRadius: 10, background: cardBg, padding: "10px 12px" }}>
                              <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.author}</div>
                              <div style={{ color: bodyColor, fontSize: "0.85rem", fontFamily: bodyFont }}>{item.quote}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: layoutVariant === "card-grid" ? `repeat(${Math.min(Number(columns), 2)}, minmax(0, 1fr))` : "1fr", gap: 10 }}>
                          {sampleItems.map((item, i) => (
                            <article key={i} style={{ border: `1px solid ${cardBorder}`, borderRadius: 10, background: layoutVariant === "spotlight" && i === 0 ? `${accentColor}20` : cardBg, padding: "12px" }}>
                              <div style={{ color: starColor, marginBottom: 6 }}>{"★★★★★"}</div>
                              <p style={{ margin: "0 0 8px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>&ldquo;{item.quote}&rdquo;</p>
                              <p style={{ margin: 0, color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.author} <span style={{ color: metaColor, fontWeight: 400 }}>— {item.location}</span></p>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>

              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card-grid">Card Grid</SelectItem>
                    <SelectItem value="editorial-list">Editorial List</SelectItem>
                    <SelectItem value="spotlight">Spotlight</SelectItem>
                    <SelectItem value="compact-rows">Compact Rows</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Columns">
                <Select value={columns} onValueChange={(v) => set("columns", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>

              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Border"><Input value={cardBorder} onChange={(e) => set("card_border", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Meta Color"><Input value={metaColor} onChange={(e) => set("meta_color", e.target.value)} /></FieldRow>
              <FieldRow label="Star Color"><Input value={starColor} onChange={(e) => set("star_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <p className="text-xs text-muted-foreground">Testimonials content is pulled from your Testimonials data. This panel controls visual layout and styling.</p>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card-grid">Card Grid</SelectItem>
                  <SelectItem value="editorial-list">Editorial List</SelectItem>
                  <SelectItem value="spotlight">Spotlight</SelectItem>
                  <SelectItem value="compact-rows">Compact Rows</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "contact_form": {
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);

      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading"><Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
          <FieldRow label="Form Type">
            <Select value={String(c.form_type ?? "contact")} onValueChange={(v) => set("form_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contact">Contact / General Enquiry</SelectItem>
                <SelectItem value="quote">Quote Request</SelectItem>
                <SelectItem value="callback">Request a Callback</SelectItem>
                <SelectItem value="emergency">Emergency Callout</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
            <FieldRow label="Form Purpose">
              <Select value={String(c.form_kind ?? "contact")} onValueChange={(v) => set("form_kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact Form</SelectItem>
                  <SelectItem value="free_survey">Free Survey</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          <FieldRow label="Allow customer photo uploads">
            <Switch checked={Boolean(c.allow_photos ?? true)} onCheckedChange={(v) => set("allow_photos", v)} />
          </FieldRow>
        </div>
      );
    }

    case "gallery": {
      const heading = readString(c, ["heading", "title"]);
      const subtitle = readString(c, ["subtitle", "subheading"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "grid");
      const columns = String(c.columns ?? "3");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e2e8f0");
      const accentColor = readString(c, ["accent_color"], "#f97316");
      const headingColor = readString(c, ["heading_color", "text_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#6b7280");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const imageHeight = readString(c, ["image_height"], "220px");
      const imageRadius = readString(c, ["image_radius"], "12px");
      const isPreviewVisible = previewEnabled !== false;

      const previewImages = [
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
        "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
        "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&q=80",
      ];

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "22px 18px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 6px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Our Recent Work"}</h3>
                      {subtitle ? <p style={{ margin: "0 0 12px", color: bodyColor, fontFamily: bodyFont }}>{subtitle}</p> : null}

                      <div style={{ display: "grid", gridTemplateColumns: layoutVariant === "strip" ? "1fr" : `repeat(${Math.min(Number(columns), 2)}, minmax(0, 1fr))`, gap: 8 }}>
                        {previewImages.map((src, i) => (
                          <div key={i} style={{ overflow: "hidden", borderRadius: imageRadius, border: `1px solid ${borderColor}`, background: cardBg }}>
                            <img src={src} alt="Gallery preview" style={{ width: "100%", height: i % 3 === 0 && layoutVariant === "masonry" ? "280px" : imageHeight, objectFit: "cover", display: "block" }} />
                          </div>
                        ))}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="masonry">Masonry</SelectItem>
                    <SelectItem value="collage">Collage</SelectItem>
                    <SelectItem value="strip">Strip</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Columns">
                <Select value={columns} onValueChange={(v) => set("columns", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 columns</SelectItem>
                    <SelectItem value="3">3 columns</SelectItem>
                    <SelectItem value="4">4 columns</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subtitle} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} rows={2} /></FieldRow>

              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Image Height"><Input value={imageHeight} onChange={(e) => set("image_height", e.target.value)} placeholder="220px" /></FieldRow>
              <FieldRow label="Image Radius"><Input value={imageRadius} onChange={(e) => set("image_radius", e.target.value)} placeholder="12px" /></FieldRow>

              <p className="text-xs text-muted-foreground">Gallery images are pulled from your Gallery data. This panel controls visual layout and styling.</p>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="masonry">Masonry</SelectItem>
                  <SelectItem value="collage">Collage</SelectItem>
                  <SelectItem value="strip">Strip</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subtitle} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "blog_index": {
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const emptyMessage = readString(c, ["empty_message"], "No posts published yet.");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "editorial-list");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#f97316");
      const headingColor = readString(c, ["heading_color", "text_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#6b7280");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const cardRadius = readString(c, ["card_radius"], "12px");
      const isPreviewVisible = previewEnabled !== false;

      const previewPosts = [
        { title: "How to cut heating bills before winter", excerpt: "Seven practical upgrades and maintenance checks.", category: "Efficiency", date: "12 June 2026" },
        { title: "Boiler pressure dropping? Here's what to do", excerpt: "A homeowner checklist before calling an engineer.", category: "Troubleshooting", date: "3 May 2026" },
        { title: "Air source heat pump grants explained", excerpt: "Eligibility, timelines, and common application mistakes.", category: "Heat Pumps", date: "20 April 2026" },
      ];

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "20px 16px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 8px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 6px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Latest Articles"}</h3>
                      {subheading ? <p style={{ margin: "0 0 12px", color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{subheading}</p> : null}

                      {layoutVariant === "minimal-list" ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {previewPosts.map((post, i) => (
                            <article key={i} style={{ borderBottom: `1px solid ${borderColor}`, paddingBottom: 8 }}>
                              <p style={{ margin: "0 0 4px", color: accentColor, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{post.category}</p>
                              <p style={{ margin: "0 0 2px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{post.title}</p>
                              <p style={{ margin: 0, color: bodyColor, fontFamily: bodyFont, fontSize: "0.8rem" }}>{post.date}</p>
                            </article>
                          ))}
                        </div>
                      ) : layoutVariant === "magazine" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
                          <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 10 }}>
                            <div style={{ borderRadius: 8, background: "#e5e7eb", height: 92, marginBottom: 8 }} />
                            <p style={{ margin: "0 0 4px", color: accentColor, fontSize: "0.72rem", fontWeight: 700 }}>{previewPosts[0]?.category}</p>
                            <p style={{ margin: 0, color: headingColor, fontFamily: headingFont, fontWeight: 700 }}>{previewPosts[0]?.title}</p>
                          </article>
                          <div style={{ display: "grid", gap: 8 }}>
                            {previewPosts.slice(1).map((post, i) => (
                              <article key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 8 }}>
                                <p style={{ margin: "0 0 4px", color: accentColor, fontSize: "0.72rem", fontWeight: 700 }}>{post.category}</p>
                                <p style={{ margin: 0, color: headingColor, fontFamily: headingFont, fontWeight: 700, fontSize: "0.9rem" }}>{post.title}</p>
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : layoutVariant === "card-grid" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          {previewPosts.map((post, i) => (
                            <article key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 8 }}>
                              <div style={{ borderRadius: 8, background: "#e5e7eb", height: 72, marginBottom: 8 }} />
                              <p style={{ margin: "0 0 4px", color: accentColor, fontSize: "0.72rem", fontWeight: 700 }}>{post.category}</p>
                              <p style={{ margin: "0 0 4px", color: headingColor, fontFamily: headingFont, fontWeight: 700 }}>{post.title}</p>
                              <p style={{ margin: 0, color: bodyColor, fontSize: "0.78rem", fontFamily: bodyFont }}>{post.excerpt}</p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {previewPosts.map((post, i) => (
                            <article key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 8, display: "grid", gridTemplateColumns: "88px 1fr", gap: 8 }}>
                              <div style={{ borderRadius: 8, background: "#e5e7eb", height: 66 }} />
                              <div>
                                <p style={{ margin: "0 0 4px", color: accentColor, fontSize: "0.72rem", fontWeight: 700 }}>{post.category}</p>
                                <p style={{ margin: "0 0 3px", color: headingColor, fontFamily: headingFont, fontWeight: 700, fontSize: "0.9rem" }}>{post.title}</p>
                                <p style={{ margin: 0, color: bodyColor, fontFamily: bodyFont, fontSize: "0.78rem" }}>{post.excerpt}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editorial-list">Editorial List</SelectItem>
                    <SelectItem value="card-grid">Card Grid</SelectItem>
                    <SelectItem value="magazine">Magazine</SelectItem>
                    <SelectItem value="minimal-list">Minimal List</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="Empty Message"><Input value={emptyMessage} onChange={(e) => set("empty_message", e.target.value)} /></FieldRow>

              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>
              <FieldRow label="Card Radius"><Input value={cardRadius} onChange={(e) => set("card_radius", e.target.value)} /></FieldRow>

              <p className="text-xs text-muted-foreground">Posts come from your blog data. This block controls layout and presentation.</p>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="editorial-list">Editorial List</SelectItem>
                  <SelectItem value="card-grid">Card Grid</SelectItem>
                  <SelectItem value="magazine">Magazine</SelectItem>
                  <SelectItem value="minimal-list">Minimal List</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "blog_post": {
      const heading = readString(c, ["heading", "title"], "Blog Post");
      const subheading = readString(c, ["subheading", "subtitle"]);
      const body = readString(c, ["html", "body", "text"]);
      const ctaText = readString(c, ["cta_text", "ctaText"]);
      const ctaUrl = readString(c, ["cta_url", "ctaUrl"]);
      const slug = readString(c, ["slug"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "classic-article");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#f97316");
      const headingColor = readString(c, ["heading_color", "text_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#374151");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const buttonFont = readString(c, ["button_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const cardRadius = readString(c, ["card_radius"], "12px");
      const isPreviewVisible = previewEnabled !== false;
      const previewBody = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "This is where your article content appears. Use this block to format your long-form guidance, updates, and how-to posts.";

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "20px 16px", background: sectionBg }}>
                      {layoutVariant === "split-aside" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: 10 }}>
                          <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 12 }}>
                            <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h3>
                            {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{subheading}</p> : null}
                            <p style={{ margin: 0, color: bodyColor, lineHeight: 1.8, fontFamily: bodyFont, fontSize: bodySize }}>{previewBody.slice(0, 250)}...</p>
                          </article>
                          <aside style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 10, alignSelf: "start" }}>
                            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>On this article</p>
                            <p style={{ margin: "6px 0 0", color: bodyColor, fontFamily: bodyFont, fontSize: "0.82rem" }}>Summary</p>
                            <p style={{ margin: "4px 0 0", color: bodyColor, fontFamily: bodyFont, fontSize: "0.82rem" }}>Details</p>
                          </aside>
                        </div>
                      ) : layoutVariant === "hero-lead" ? (
                        <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, overflow: "hidden" }}>
                          <div style={{ height: 130, background: `linear-gradient(135deg, ${accentColor}, #111827)` }} />
                          <div style={{ padding: 12 }}>
                            <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h3>
                            {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{subheading}</p> : null}
                            <p style={{ margin: 0, color: bodyColor, lineHeight: 1.8, fontFamily: bodyFont, fontSize: bodySize }}>{previewBody.slice(0, 220)}...</p>
                          </div>
                        </article>
                      ) : layoutVariant === "minimal-prose" ? (
                        <article>
                          <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h3>
                          {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{subheading}</p> : null}
                          <p style={{ margin: 0, color: bodyColor, lineHeight: 1.85, fontFamily: bodyFont, fontSize: bodySize }}>{previewBody.slice(0, 300)}...</p>
                        </article>
                      ) : (
                        <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 12 }}>
                          <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h3>
                          {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{subheading}</p> : null}
                          <p style={{ margin: 0, color: bodyColor, lineHeight: 1.85, fontFamily: bodyFont, fontSize: bodySize }}>{previewBody.slice(0, 280)}...</p>
                        </article>
                      )}

                      {ctaText && ctaUrl ? (
                        <div style={{ marginTop: 12 }}>
                          <a href={ctaUrl} style={{ display: "inline-block", borderRadius: 8, padding: "9px 14px", background: accentColor, color: "#fff", textDecoration: "none", fontWeight: 700, fontFamily: buttonFont }}>{ctaText}</a>
                        </div>
                      ) : null}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic-article">Classic Article</SelectItem>
                    <SelectItem value="hero-lead">Hero Lead</SelectItem>
                    <SelectItem value="split-aside">Split Aside</SelectItem>
                    <SelectItem value="minimal-prose">Minimal Prose</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Post Slug (optional override)"><Input value={slug} onChange={(e) => set("slug", e.target.value)} placeholder="leave blank to use current page slug" /></FieldRow>
              <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
              <FieldRow label="Body (HTML or plain text)">
                <Textarea value={body} onChange={(e) => onChange(syncBlockContent(c, { html: e.target.value, body: e.target.value, text: e.target.value }, { html: ["body", "text"], body: ["html", "text"], text: ["html", "body"] }))} rows={10} />
              </FieldRow>
              <FieldRow label="CTA Text (optional)"><Input value={ctaText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, ctaText: e.target.value }, { cta_text: ["ctaText"], ctaText: ["cta_text"] }))} /></FieldRow>
              <FieldRow label="CTA URL (optional)"><Input value={ctaUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, ctaUrl: e.target.value }, { cta_url: ["ctaUrl"], ctaUrl: ["cta_url"] }))} /></FieldRow>

              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Button Font"><Input value={buttonFont} onChange={(e) => set("button_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>
              <FieldRow label="Card Radius"><Input value={cardRadius} onChange={(e) => set("card_radius", e.target.value)} /></FieldRow>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
            <FieldRow label="Body (HTML or plain text)">
              <Textarea value={body} onChange={(e) => onChange(syncBlockContent(c, { html: e.target.value, body: e.target.value, text: e.target.value }, { html: ["body", "text"], body: ["html", "text"], text: ["html", "body"] }))} rows={8} />
            </FieldRow>
          </div>
        </div>
      );
    }

    case "accreditations": {
      type BadgeItem = { name: string; logo_url: string; description?: string; number?: string };
      const isTrustBadges = String(block.block_type || "").toLowerCase().includes("trust_badge")
        || String(block.block_type || "").toLowerCase().includes("trust.badge")
        || String(block.block_type || "").toLowerCase().includes("trust_bar");
      const sourceBadges = readArray<Record<string, unknown>>(c, ["badges", "items"]);
      const accs: BadgeItem[] = sourceBadges.map((item) => ({
        name: String(item.name ?? item.label ?? ""),
        logo_url: String(item.logo_url ?? ""),
        description: String(item.description ?? ""),
        number: String(item.number ?? ""),
      }));
      const updateBadges = (next: BadgeItem[]) => {
        onChange({ ...c, badges: next, items: next });
      };
      const heading = readString(c, ["heading", "title"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "logo-row");
      const sectionBg = readString(c, ["section_bg"], "transparent");
      const cardBg = readString(c, ["card_bg", "background_color"], "#f9fafb");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "text_color"], "#374151");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "1rem");
      const bodySize = readString(c, ["body_size"], "0.9rem");
      const isPreviewVisible = previewEnabled !== false;
      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "18px 16px", background: sectionBg }}>
                      <div style={{ borderRadius: 12, border: `1px solid ${borderColor}`, background: cardBg, padding: 12 }}>
                        <h4 style={{ margin: "0 0 10px", color: headingColor, fontFamily: headingFont, fontSize: headingSize }}>{heading || (isTrustBadges ? "Trust Badges" : "Accreditations")}</h4>
                        {layoutVariant === "minimal-list" ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            {accs.slice(0, 4).map((item, i) => (
                              <div key={i} style={{ borderBottom: `1px solid ${borderColor}`, paddingBottom: 6, color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{item.name || "Badge"}</div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                            {accs.slice(0, 4).map((item, i) => (
                              <div key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, padding: 8 }}>
                                <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.name || "Badge"}</div>
                                <div style={{ color: bodyColor, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.number || "Number optional"}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logo-row">Logo Row</SelectItem>
                    <SelectItem value="card-grid">Card Grid</SelectItem>
                    <SelectItem value="minimal-list">Minimal List</SelectItem>
                    <SelectItem value="numbered-cards">Numbered Cards</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{isTrustBadges ? "Trust Badges" : "Accreditations"}</Label>
                {accs.map((item, i) => (
                  <div key={i} className="rounded border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.name} onChange={(e) => { const n = [...accs]; n[i] = { ...n[i], name: e.target.value }; updateBadges(n); }} placeholder="Gas Safe Registered" className="flex-1" />
                      <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0" onClick={() => updateBadges(accs.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <ImagePickerField
                      label="Logo"
                      value={item.logo_url}
                      onChange={(url) => { const n = [...accs]; n[i] = { ...n[i], logo_url: url }; updateBadges(n); }}
                      hint="Recommended logo size: 240 x 120 px (or 2:1 ratio), PNG with transparent background."
                      fieldName={`${isTrustBadges ? "trust_badge" : "accreditation"}_${i}_logo`}
                    />
                    <Input value={item.logo_url} onChange={(e) => { const n = [...accs]; n[i] = { ...n[i], logo_url: e.target.value }; updateBadges(n); }} placeholder="Logo URL (optional)" />
                    <Input value={item.description ?? ""} onChange={(e) => { const n = [...accs]; n[i] = { ...n[i], description: e.target.value }; updateBadges(n); }} placeholder="Description (optional)" />
                    <Input value={item.number ?? ""} onChange={(e) => { const n = [...accs]; n[i] = { ...n[i], number: e.target.value }; updateBadges(n); }} placeholder="Registration number (optional)" />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateBadges([...accs, { name: "", logo_url: "", description: "", number: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add {isTrustBadges ? "Badge" : "Accreditation"}
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="logo-row">Logo Row</SelectItem>
                  <SelectItem value="card-grid">Card Grid</SelectItem>
                  <SelectItem value="minimal-list">Minimal List</SelectItem>
                  <SelectItem value="numbered-cards">Numbered Cards</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </div>
      );
    }

    case "brands": {
      type BrandItem = { name: string; logo_url?: string };
      const itemFieldKey = Array.isArray(c.items) ? "items" : "brands";
      const brands = readArray<BrandItem>(c, ["brands", "items"]).map((item) => ({ name: item.name || "", logo_url: item.logo_url || "" }));
      const updateBrands = (next: BrandItem[]) => {
        if (itemFieldKey === "items") {
          onChange({ ...c, items: next, brands: next });
          return;
        }
        onChange({ ...c, brands: next, items: next });
      };

      const heading = readString(c, ["heading", "title"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "logo-cloud");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg"], "transparent");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color"], "#6b7280");
      const textColor = readString(c, ["text_color", "body_color"], "#9ca3af");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "0.8125rem");
      const bodySize = readString(c, ["body_size"], "0.9375rem");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "16px", background: sectionBg }}>
                      <div style={{ border: `1px solid ${borderColor}`, borderRadius: 10, padding: 10, background: cardBg }}>
                        {(label || heading) ? <p style={{ margin: "0 0 8px", color: headingColor, fontWeight: 700, fontFamily: headingFont, fontSize: headingSize }}>{label || heading || "Trusted By"}</p> : null}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          {brands.slice(0, 6).map((brand, i) => (
                            <div key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, padding: 8, color: textColor, fontFamily: bodyFont, fontSize: bodySize, textAlign: "center" }}>
                              {brand.name || "Brand"}
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logo-cloud">Logo Cloud</SelectItem>
                    <SelectItem value="split-grid">Split Grid</SelectItem>
                    <SelectItem value="minimal-list">Minimal List</SelectItem>
                    <SelectItem value="numbered-tiles">Numbered Tiles</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Text Color"><Input value={textColor} onChange={(e) => set("text_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Brands / Partners</Label>
                {brands.map((brand, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={brand.name} onChange={(e) => { const n = [...brands]; n[i] = { ...n[i], name: e.target.value }; updateBrands(n); }} placeholder="Brand name" className="flex-1" />
                      <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0" onClick={() => updateBrands(brands.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <ImagePickerField
                      label="Logo"
                      value={brand.logo_url || ""}
                      onChange={(url) => { const n = [...brands]; n[i] = { ...n[i], logo_url: url }; updateBrands(n); }}
                      hint="Recommended logo size: 220 × 80 px."
                      fieldName={`brand_${i}_logo`}
                    />
                    <Input value={brand.logo_url || ""} onChange={(e) => { const n = [...brands]; n[i] = { ...n[i], logo_url: e.target.value }; updateBrands(n); }} placeholder="Logo URL (optional)" />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateBrands([...brands, { name: "", logo_url: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Brand
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          </div>
        </div>
      );
    }

    case "why_choose_us": {
      type FeatureItem = { title: string; description?: string; icon?: string };
      const itemFieldKey = Array.isArray(c.items) ? "items" : "features";
      const items = readArray<FeatureItem>(c, ["features", "items"]).map((item) => ({ title: item.title || "", description: item.description || "", icon: item.icon || "" }));
      const updateItems = (next: FeatureItem[]) => {
        if (itemFieldKey === "items") {
          onChange({ ...c, items: next, features: next });
          return;
        }
        onChange({ ...c, features: next, items: next });
      };

      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const ctaText = readString(c, ["cta_text", "primaryCtaLabel", "primaryButtonText"]);
      const ctaUrl = readString(c, ["cta_url", "primaryCtaHref", "primaryButtonUrl"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "icon-circle");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#1c2942");
      const cardBg = readString(c, ["card_bg"], "transparent");
      const borderColor = readString(c, ["border_color"], "rgba(249,115,22,0.3)");
      const accentColor = readString(c, ["accent_color"], "#f97316");
      const headingColor = readString(c, ["heading_color"], "#ffffff");
      const bodyColor = readString(c, ["body_color", "text_color"], "#ffffff");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "18px 16px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Why Choose Us"}</h3>
                      {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}
                      <div style={{ display: "grid", gap: 8 }}>
                        {items.slice(0, 4).map((item, i) => (
                          <div key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, background: cardBg, padding: 8 }}>
                            <strong style={{ color: headingColor, fontFamily: headingFont }}>{item.icon || "✓"} {item.title || "Feature"}</strong>
                            <div style={{ color: bodyColor, fontSize: "0.82rem", fontFamily: bodyFont }}>{item.description || "Description"}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="icon-circle">Icon Circle</SelectItem>
                    <SelectItem value="split-list">Split List</SelectItem>
                    <SelectItem value="minimal-cards">Minimal Cards</SelectItem>
                    <SelectItem value="numbered-steps">Numbered Steps</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="CTA Button Text"><Input value={ctaText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
              <FieldRow label="CTA Button URL"><Input value={ctaUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Features</Label>
                {items.map((item, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.icon || ""} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], icon: e.target.value }; updateItems(n); }} placeholder="⚡" className="w-16 text-center" />
                      <Input value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; updateItems(n); }} placeholder="Feature title" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateItems(items.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Textarea value={item.description || ""} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; updateItems(n); }} placeholder="Short description..." rows={2} />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateItems([...items, { icon: "✅", title: "", description: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Feature
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "feature_cards": {
      type FeatureItem = { title: string; description?: string; icon?: string; cta_text?: string; cta_url?: string };
      const cardFieldKey = Array.isArray(c.cards) ? "cards" : Array.isArray(c.features) ? "features" : "items";
      const cards = readArray<FeatureItem>(c, ["cards", "features", "items"])
        .map((item) => ({ title: item.title || "", description: item.description || "", icon: item.icon || "", cta_text: item.cta_text || "", cta_url: item.cta_url || "" }));
      const updateCards = (next: FeatureItem[]) => {
        if (cardFieldKey === "cards") {
          onChange({ ...c, cards: next, features: next, items: next });
          return;
        }
        if (cardFieldKey === "features") {
          onChange({ ...c, features: next, cards: next, items: next });
          return;
        }
        onChange({ ...c, items: next, cards: next, features: next });
      };

      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "card-grid");
      const normalizedLayoutVariant = String(layoutVariant || "card-grid").toLowerCase();
      const sectionBg = readString(c, ["section_bg"], "transparent");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color"], "#111827");
      const bodyColor = readString(c, ["body_color"], "#6b7280");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "18px 16px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Features"}</h3>
                      {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}
                      {(normalizedLayoutVariant === "card-grid" || !["split-list", "icon-panels", "minimal-tiles"].includes(normalizedLayoutVariant)) && (
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          {cards.slice(0, 4).map((item, i) => (
                            <article key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, background: cardBg, padding: 10 }}>
                              <div style={{ color: accentColor }}>{item.icon || "✓"}</div>
                              <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.title || "Feature"}</div>
                              <div style={{ color: bodyColor, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.description || "Description"}</div>
                              {item.cta_text && item.cta_url ? <div style={{ marginTop: 6, color: accentColor, fontWeight: 700, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.cta_text}</div> : null}
                            </article>
                          ))}
                        </div>
                      )}

                      {normalizedLayoutVariant === "split-list" && (
                        <div style={{ display: "grid", gap: 8 }}>
                          {cards.slice(0, 4).map((item, i) => (
                            <article key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, background: cardBg, padding: "10px 12px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", gap: 8, alignItems: "start" }}>
                                <div style={{ color: accentColor, fontWeight: 700, fontFamily: headingFont }}>{item.icon || String(i + 1)}</div>
                                <div>
                                  <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.title || "Feature"}</div>
                                  <div style={{ color: bodyColor, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.description || "Description"}</div>
                                  {item.cta_text && item.cta_url ? <div style={{ marginTop: 6, color: accentColor, fontWeight: 700, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.cta_text}</div> : null}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}

                      {normalizedLayoutVariant === "icon-panels" && (
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          {cards.slice(0, 4).map((item, i) => (
                            <article key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, background: cardBg, padding: 10 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accentColor}22`, color: accentColor, display: "grid", placeItems: "center", marginBottom: 6 }}>
                                {item.icon || "✓"}
                              </div>
                              <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.title || "Feature"}</div>
                              <div style={{ color: bodyColor, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.description || "Description"}</div>
                              {item.cta_text && item.cta_url ? <div style={{ marginTop: 6, color: accentColor, fontWeight: 700, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.cta_text}</div> : null}
                            </article>
                          ))}
                        </div>
                      )}

                      {normalizedLayoutVariant === "minimal-tiles" && (
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          {cards.slice(0, 4).map((item, i) => (
                            <article key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, borderBottom: `2px solid ${accentColor}`, background: cardBg, padding: 10 }}>
                              <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.title || "Feature"}</div>
                              <div style={{ color: bodyColor, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.description || "Description"}</div>
                              {item.cta_text && item.cta_url ? <div style={{ marginTop: 6, color: accentColor, fontWeight: 700, fontSize: "0.8rem", fontFamily: bodyFont }}>{item.cta_text}</div> : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card-grid">Card Grid</SelectItem>
                    <SelectItem value="split-list">Split List</SelectItem>
                    <SelectItem value="icon-panels">Icon Panels</SelectItem>
                    <SelectItem value="minimal-tiles">Minimal Tiles</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Feature Cards</Label>
                {cards.map((item, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.icon || ""} onChange={(e) => { const n = [...cards]; n[i] = { ...n[i], icon: e.target.value }; updateCards(n); }} placeholder="⚡" className="w-16 text-center" />
                      <Input value={item.title} onChange={(e) => { const n = [...cards]; n[i] = { ...n[i], title: e.target.value }; updateCards(n); }} placeholder="Feature title" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateCards(cards.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Textarea value={item.description || ""} onChange={(e) => { const n = [...cards]; n[i] = { ...n[i], description: e.target.value }; updateCards(n); }} placeholder="Short description..." rows={2} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={item.cta_text || ""} onChange={(e) => { const n = [...cards]; n[i] = { ...n[i], cta_text: e.target.value }; updateCards(n); }} placeholder="CTA text (optional)" />
                      <Input value={item.cta_url || ""} onChange={(e) => { const n = [...cards]; n[i] = { ...n[i], cta_url: e.target.value }; updateCards(n); }} placeholder="CTA URL (optional)" />
                    </div>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateCards([...cards, { icon: "✅", title: "", description: "", cta_text: "", cta_url: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Feature Card
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "image": {
      const imageUrl = readString(c, ["image_url", "url"]);
      const altText = readString(c, ["alt_text", "alt"]);
      const caption = readString(c, ["caption"]);
      const width = readString(c, ["width"], "full");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "single-frame");
      const sectionBg = readString(c, ["section_bg"], "transparent");
      const frameBg = readString(c, ["frame_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const captionColor = readString(c, ["caption_color"], "#666666");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const captionSize = readString(c, ["caption_size"], "0.875rem");
      const imageRadius = readString(c, ["image_radius"], "10px");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "16px", background: sectionBg }}>
                      {imageUrl ? (
                        <div style={{ border: `1px solid ${borderColor}`, borderRadius: imageRadius, background: frameBg, padding: 8 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageUrl} alt={altText || "Preview image"} style={{ width: "100%", borderRadius: imageRadius, display: "block" }} />
                        </div>
                      ) : (
                        <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">Select an image to preview.</div>
                      )}
                      {caption ? <p style={{ margin: "8px 0 0", color: captionColor, fontSize: captionSize, fontFamily: bodyFont }}>{caption}</p> : null}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <ImagePickerField
                label="Image"
                value={imageUrl}
                onChange={(url) => onChange(syncBlockContent(c, { image_url: url, url }, { image_url: ["url"], url: ["image_url"] }))}
                hint="Recommended: 1200 × 800 px or wider."
                fieldName="image"
              />
              <FieldRow label="Alt Text"><Input value={altText} onChange={(e) => onChange(syncBlockContent(c, { alt_text: e.target.value, alt: e.target.value }, { alt_text: ["alt"], alt: ["alt_text"] }))} placeholder="Describe the image for accessibility" /></FieldRow>
              <FieldRow label="Caption (optional)"><Input value={caption} onChange={(e) => set("caption", e.target.value)} /></FieldRow>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-frame">Single Frame</SelectItem>
                    <SelectItem value="polaroid">Polaroid</SelectItem>
                    <SelectItem value="split-caption">Split Caption</SelectItem>
                    <SelectItem value="minimal-edge">Minimal Edge</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Width">
                <Select value={width} onValueChange={(v) => set("width", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full width</SelectItem>
                    <SelectItem value="wide">Wide</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="contained">Contained</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Frame Background"><Input value={frameBg} onChange={(e) => set("frame_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Caption Color"><Input value={captionColor} onChange={(e) => set("caption_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Caption Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Caption Size"><Input value={captionSize} onChange={(e) => set("caption_size", e.target.value)} /></FieldRow>
              <FieldRow label="Image Radius"><Input value={imageRadius} onChange={(e) => set("image_radius", e.target.value)} /></FieldRow>
            </div>
          </div>

          <div className="hidden space-y-3">
            <ImagePickerField
              label="Image"
              value={imageUrl}
              onChange={(url) => onChange(syncBlockContent(c, { image_url: url, url }, { image_url: ["url"], url: ["image_url"] }))}
              hint="Recommended: 1200 × 800 px or wider."
              fieldName="image"
            />
            <FieldRow label="Alt Text"><Input value={altText} onChange={(e) => onChange(syncBlockContent(c, { alt_text: e.target.value, alt: e.target.value }, { alt_text: ["alt"], alt: ["alt_text"] }))} placeholder="Describe the image for accessibility" /></FieldRow>
            <FieldRow label="Caption (optional)"><Input value={caption} onChange={(e) => set("caption", e.target.value)} /></FieldRow>
          </div>
        </div>
      );
    }

    case "spacer": {
      const height = readString(c, ["height"], "md");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "blank-gap");
      const sectionBg = readString(c, ["section_bg"], "transparent");
      const ruleColor = readString(c, ["rule_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "16px", background: "#f8fafc" }}>
                      <div style={{ background: sectionBg, borderRadius: 8, border: "1px dashed #cbd5e1", padding: "8px" }}>
                        <div style={{ height: height === "sm" ? 16 : height === "md" ? 32 : height === "lg" ? 64 : height === "xl" ? 96 : Number.isFinite(Number(height)) ? Number(height) : 32, display: "grid", alignItems: "center" }}>
                          {layoutVariant === "divider-line" ? <div style={{ borderTop: `1px solid ${ruleColor}` }} /> : null}
                          {layoutVariant === "accent-rule" ? <div style={{ height: 2, background: `linear-gradient(90deg, transparent 0%, ${accentColor} 20%, ${accentColor} 80%, transparent 100%)` }} /> : null}
                          {layoutVariant === "dotted-rule" ? <div style={{ borderTop: `2px dotted ${ruleColor}` }} /> : null}
                        </div>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank-gap">Blank Gap</SelectItem>
                    <SelectItem value="divider-line">Divider Line</SelectItem>
                    <SelectItem value="accent-rule">Accent Rule</SelectItem>
                    <SelectItem value="dotted-rule">Dotted Rule</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Height">
                <Select value={height} onValueChange={(v) => set("height", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small (1rem)</SelectItem>
                    <SelectItem value="md">Medium (2rem)</SelectItem>
                    <SelectItem value="lg">Large (4rem)</SelectItem>
                    <SelectItem value="xl">Extra Large (6rem)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Rule Color"><Input value={ruleColor} onChange={(e) => set("rule_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Height">
              <Select value={height} onValueChange={(v) => set("height", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small (1rem)</SelectItem>
                  <SelectItem value="md">Medium (2rem)</SelectItem>
                  <SelectItem value="lg">Large (4rem)</SelectItem>
                  <SelectItem value="xl">Extra Large (6rem)</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </div>
      );
    }

    case "features_bar": {
      const itemFieldKey = Array.isArray(c.items) ? "items" : "features";
      const items = readArray<{ icon?: string; title: string; description: string }>(c, ["items", "features"])
        .map((item) => ({ icon: item.icon ?? "✅", title: item.title, description: item.description }));
      const updateItems = (next: Array<{ icon: string; title: string; description: string }>) => {
        if (itemFieldKey === "items") {
          onChange({ ...c, items: next, features: next });
          return;
        }
        onChange({ ...c, features: next, items: next });
      };
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "icon-grid");
      const sectionBg = readString(c, ["section_bg"], "transparent");
      const cardBg = readString(c, ["card_bg", "background_color"], "#0d9488");
      const borderColor = readString(c, ["border_color"], "rgba(255,255,255,0.2)");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color"], "#ffffff");
      const bodyColor = readString(c, ["body_color", "text_color"], "#ffffff");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;
      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "18px 16px", background: sectionBg }}>
                      <div style={{ borderRadius: 12, background: cardBg, border: `1px solid ${borderColor}`, padding: 12 }}>
                        {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                        <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Why Choose Us"}</h3>
                        {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}
                        <div style={{ display: "grid", gap: 8 }}>
                          {items.slice(0, 4).map((item, i) => (
                            <div key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, padding: 8, color: bodyColor, fontFamily: bodyFont }}>
                              <strong style={{ color: headingColor, fontFamily: headingFont }}>{item.icon || "✓"} {item.title || "Feature"}</strong>
                              <div style={{ fontSize: "0.82rem", marginTop: 4 }}>{item.description || "Description"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="icon-grid">Icon Grid</SelectItem>
                    <SelectItem value="split-list">Split List</SelectItem>
                    <SelectItem value="minimal-strip">Minimal Strip</SelectItem>
                    <SelectItem value="numbered-cards">Numbered Cards</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Feature Items</Label>
                {items.map((item, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.icon} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], icon: e.target.value }; updateItems(n); }} placeholder="⚡" className="w-16 text-center" />
                      <Input value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; updateItems(n); }} placeholder="Feature title" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateItems(items.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Textarea value={item.description} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; updateItems(n); }} placeholder="Short description..." rows={2} />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateItems([...items, { icon: "✅", title: "", description: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Feature
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="icon-grid">Icon Grid</SelectItem>
                  <SelectItem value="split-list">Split List</SelectItem>
                  <SelectItem value="minimal-strip">Minimal Strip</SelectItem>
                  <SelectItem value="numbered-cards">Numbered Cards</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </div>
      );
    }

    case "faq": {
      const faqFieldKey = Array.isArray(c.items) ? "items" : "faqs";
      const faqs = readArray<{ question: string; answer: string }>(c, ["items", "faqs"]);
      const updateFaqs = (next: Array<{ question: string; answer: string }>) => {
        if (faqFieldKey === "items") {
          onChange({ ...c, items: next, faqs: next });
          return;
        }
        onChange({ ...c, faqs: next, items: next });
      };
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "accordion-card");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#f9fafb");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#f97316");
      const headingColor = readString(c, ["heading_color", "text_color"], "#111827");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#6b7280");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;
      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "22px 18px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Frequently Asked Questions"}</h3>
                      {subheading ? <p style={{ margin: "0 0 12px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}

                      {layoutVariant === "split-panels" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          {faqs.slice(0, 4).map((item, i) => (
                            <article key={i} style={{ borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, padding: 10 }}>
                              <strong style={{ color: headingColor, fontFamily: headingFont }}>{item.question || "Question"}</strong>
                              <p style={{ margin: "6px 0 0", color: bodyColor, fontSize: "0.9rem", fontFamily: bodyFont }}>{item.answer || "Answer"}</p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div style={{ borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, padding: "0 14px" }}>
                          {faqs.slice(0, 4).map((item, i) => (
                            <div key={i} style={{ borderBottom: i < Math.min(faqs.length, 4) - 1 ? `1px solid ${borderColor}` : "none", padding: "10px 0" }}>
                              <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{item.question || "Question"}</div>
                              {layoutVariant !== "minimal-list" && <div style={{ marginTop: 5, color: bodyColor, fontSize: "0.9rem", fontFamily: bodyFont }}>{item.answer || "Answer"}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accordion-card">Accordion Card</SelectItem>
                    <SelectItem value="minimal-list">Minimal List</SelectItem>
                    <SelectItem value="stacked-cards">Stacked Cards</SelectItem>
                    <SelectItem value="split-panels">Split Panels</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">FAQ Items</Label>
                {faqs.map((item, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Input value={item.question} onChange={(e) => { const n = [...faqs]; n[i] = { ...n[i], question: e.target.value }; updateFaqs(n); }} placeholder="Question..." className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive mt-0.5" onClick={() => updateFaqs(faqs.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Textarea value={item.answer} onChange={(e) => { const n = [...faqs]; n[i] = { ...n[i], answer: e.target.value }; updateFaqs(n); }} placeholder="Answer..." rows={3} />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateFaqs([...faqs, { question: "", answer: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add FAQ
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accordion-card">Accordion Card</SelectItem>
                  <SelectItem value="minimal-list">Minimal List</SelectItem>
                  <SelectItem value="stacked-cards">Stacked Cards</SelectItem>
                  <SelectItem value="split-panels">Split Panels</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "process": {
      const stepFieldKey = Array.isArray(c.steps) ? "steps" : "items";
      const steps = readArray<{ icon?: string; title: string; description: string; step_number?: number }>(c, ["steps", "items"]);
      const updateSteps = (next: Array<{ icon?: string; title: string; description: string; step_number?: number }>) => {
        if (stepFieldKey === "steps") {
          onChange({ ...c, steps: next, items: next });
          return;
        }
        onChange({ ...c, items: next, steps: next });
      };
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const ctaText = readString(c, ["cta_text", "primaryCtaLabel", "primaryButtonText"]);
      const ctaUrl = readString(c, ["cta_url", "primaryCtaHref", "primaryButtonUrl"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "numbered-cards");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg"], "#f9fafb");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color"], "#111827");
      const bodyColor = readString(c, ["body_color"], "#6b7280");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "22px 18px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "How It Works"}</h3>
                      {subheading ? <p style={{ margin: "0 0 12px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}

                      {layoutVariant === "split-list" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          {steps.slice(0, 4).map((step, i) => (
                            <article key={i} style={{ borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, padding: 10 }}>
                              <p style={{ margin: "0 0 4px", color: accentColor, fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", fontFamily: bodyFont }}>Step {i + 1}</p>
                              <strong style={{ color: headingColor, fontFamily: headingFont }}>{step.title || "Step title"}</strong>
                              <p style={{ margin: "6px 0 0", color: bodyColor, fontSize: "0.88rem", fontFamily: bodyFont }}>{step.description || "Description"}</p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div style={{ borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, padding: "0 12px" }}>
                          {steps.slice(0, 4).map((step, i) => (
                            <div key={i} style={{ borderBottom: i < Math.min(steps.length, 4) - 1 ? `1px solid ${borderColor}` : "none", padding: "10px 0", display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gap: 8 }}>
                              <div style={{ width: 24, height: 24, borderRadius: "50%", background: accentColor, color: "#fff", fontWeight: 700, display: "grid", placeItems: "center", fontSize: "0.75rem", fontFamily: headingFont }}>{step.step_number || i + 1}</div>
                              <div>
                                <div style={{ color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{step.title || "Step title"}</div>
                                <div style={{ marginTop: 4, color: bodyColor, fontSize: "0.88rem", fontFamily: bodyFont }}>{step.description || "Description"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numbered-cards">Numbered Cards</SelectItem>
                    <SelectItem value="timeline">Timeline</SelectItem>
                    <SelectItem value="split-list">Split List</SelectItem>
                    <SelectItem value="minimal-steps">Minimal Steps</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="CTA Button Text"><Input value={ctaText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
              <FieldRow label="CTA Button URL"><Input value={ctaUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Steps</Label>
                {steps.map((step, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={step.icon || ""} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], icon: e.target.value }; updateSteps(n); }} placeholder="🔍" className="w-16 text-center" />
                      <Input value={step.title} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], title: e.target.value }; updateSteps(n); }} placeholder="Step title" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateSteps(steps.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Textarea value={step.description} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], description: e.target.value }; updateSteps(n); }} placeholder="Description..." rows={2} />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateSteps([...steps, { icon: "✅", title: "", description: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="numbered-cards">Numbered Cards</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                  <SelectItem value="split-list">Split List</SelectItem>
                  <SelectItem value="minimal-steps">Minimal Steps</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "areas": {
      type AreaItem = string | { name?: string; label?: string; href?: string };
      const rawAreas = Array.isArray(c.areas) ? (c.areas as AreaItem[]) : [];
      const areaList = rawAreas.map((area) => {
        if (typeof area === "string") return { name: area, href: "" };
        return { name: String(area.name ?? area.label ?? ""), href: String(area.href ?? "") };
      });
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const ctaText = readString(c, ["cta_text", "primaryCtaLabel", "primaryButtonText"]);
      const ctaUrl = readString(c, ["cta_url", "primaryCtaHref", "primaryButtonUrl"]);
      const label = readString(c, ["label", "eyebrow"]);
      const bodyText = readString(c, ["body_text"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "pill-cloud");
      const sectionBg = readString(c, ["section_bg", "outer_background"], "#f9fafb");
      const cardBg = readString(c, ["card_bg", "background_color"], "#0d9488");
      const borderColor = readString(c, ["border_color"], "rgba(255,255,255,0.2)");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color"], "#ffffff");
      const bodyColor = readString(c, ["body_color"], "rgba(255,255,255,0.82)");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;

      const updateAreas = (next: Array<{ name: string; href: string }>) => {
        onChange({ ...c, areas: next });
      };

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "22px 18px", background: sectionBg }}>
                      <div style={{ borderRadius: 12, border: `1px solid ${borderColor}`, background: cardBg, padding: 14 }}>
                        {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                        <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Areas We Cover"}</h3>
                        {subheading ? <p style={{ margin: "0 0 8px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}
                        {bodyText ? <p style={{ margin: "0 0 10px", color: bodyColor, fontSize: "0.9rem", fontFamily: bodyFont }}>{bodyText}</p> : null}

                        {layoutVariant === "card-grid" ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                            {areaList.slice(0, 4).map((area, i) => (
                              <div key={i} style={{ borderRadius: 8, border: `1px solid ${borderColor}`, padding: "8px 10px", color: headingColor, fontFamily: bodyFont }}>{area.name || "Area"}</div>
                            ))}
                          </div>
                        ) : layoutVariant === "minimal-list" ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            {areaList.slice(0, 4).map((area, i) => (
                              <div key={i} style={{ borderBottom: `1px solid ${borderColor}`, padding: "6px 0", color: bodyColor, fontFamily: bodyFont }}>{area.name || "Area"}</div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {areaList.slice(0, 6).map((area, i) => (
                              <span key={i} style={{ borderRadius: 999, background: "rgba(255,255,255,0.2)", color: bodyColor, padding: "4px 10px", fontSize: "0.8rem", fontFamily: bodyFont }}>{area.name || "Area"}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pill-cloud">Pill Cloud</SelectItem>
                    <SelectItem value="card-grid">Card Grid</SelectItem>
                    <SelectItem value="split-columns">Split Columns</SelectItem>
                    <SelectItem value="minimal-list">Minimal List</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="Body Text"><Textarea value={bodyText} onChange={(e) => set("body_text", e.target.value)} rows={2} /></FieldRow>
              <FieldRow label="CTA Button Text"><Input value={ctaText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
              <FieldRow label="CTA Button URL"><Input value={ctaUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Areas Covered</Label>
                {areaList.map((area, i) => (
                  <div key={i} className="rounded border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={area.name} onChange={(e) => { const n = [...areaList]; n[i] = { ...n[i], name: e.target.value }; updateAreas(n); }} placeholder="Town or county" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateAreas(areaList.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input value={area.href} onChange={(e) => { const n = [...areaList]; n[i] = { ...n[i], href: e.target.value }; updateAreas(n); }} placeholder="Area page URL (optional), e.g. /areas/ellon" />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateAreas([...areaList, { name: "", href: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Area
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pill-cloud">Pill Cloud</SelectItem>
                  <SelectItem value="card-grid">Card Grid</SelectItem>
                  <SelectItem value="split-columns">Split Columns</SelectItem>
                  <SelectItem value="minimal-list">Minimal List</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "project_showcase": {
      type ProjectItem = { title: string; location: string; image_url: string; description: string; cta_text: string; cta_url: string };
      const projects = Array.isArray(c.projects) ? c.projects as ProjectItem[] : [];
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "featured-split");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#f9fafb");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#0d9488");
      const headingColor = readString(c, ["heading_color"], "#111827");
      const bodyColor = readString(c, ["body_color"], "#4b5563");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "22px 18px", background: sectionBg }}>
                      {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                      <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading || "Real Homes, Real Results"}</h3>
                      {subheading ? <p style={{ margin: "0 0 12px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}

                      <div style={{ display: "grid", gap: 10 }}>
                        {projects.slice(0, 3).map((proj, i) => (
                          <article key={i} style={{ borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, padding: 10 }}>
                            <strong style={{ color: headingColor, fontFamily: headingFont }}>{proj.title || "Project title"}</strong>
                            <p style={{ margin: "6px 0 0", color: bodyColor, fontSize: "0.88rem", fontFamily: bodyFont }}>{proj.description || "Project description"}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured-split">Featured Split</SelectItem>
                    <SelectItem value="card-grid">Card Grid</SelectItem>
                    <SelectItem value="masonry-cards">Masonry Cards</SelectItem>
                    <SelectItem value="compact-list">Compact List</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Projects</Label>
                {projects.map((proj, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={proj.title} onChange={(e) => { const n = [...projects]; n[i] = { ...n[i], title: e.target.value }; set("projects", n); }} placeholder="Project title" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => set("projects", projects.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input value={proj.location} onChange={(e) => { const n = [...projects]; n[i] = { ...n[i], location: e.target.value }; set("projects", n); }} placeholder="Location" />
                    <ImagePickerField
                      label="Project Image"
                      value={proj.image_url}
                      onChange={(url) => { const n = [...projects]; n[i] = { ...n[i], image_url: url }; set("projects", n); }}
                      hint="Recommended: 800 × 600 px (landscape)."
                      fieldName={`project_${i}_image`}
                    />
                    <Textarea value={proj.description} onChange={(e) => { const n = [...projects]; n[i] = { ...n[i], description: e.target.value }; set("projects", n); }} placeholder="Project description..." rows={3} />
                    <div className="flex gap-2">
                      <Input value={proj.cta_text} onChange={(e) => { const n = [...projects]; n[i] = { ...n[i], cta_text: e.target.value }; set("projects", n); }} placeholder="Button text" className="flex-1" />
                      <Input value={proj.cta_url} onChange={(e) => { const n = [...projects]; n[i] = { ...n[i], cta_url: e.target.value }; set("projects", n); }} placeholder="/contact" className="flex-1" />
                    </div>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => set("projects", [...projects, { title: "", location: "", image_url: "", description: "", cta_text: "Get a Quote", cta_url: "/contact" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Project
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Layout Variation">
              <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured-split">Featured Split</SelectItem>
                  <SelectItem value="card-grid">Card Grid</SelectItem>
                  <SelectItem value="masonry-cards">Masonry Cards</SelectItem>
                  <SelectItem value="compact-list">Compact List</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          </div>
        </div>
      );
    }

    case "amazon_affiliates": {
      type AmazonProduct = {
        title: string;
        image_url: string;
        affiliate_url: string;
        price_text: string;
        rating_text: string;
        reviews_text: string;
        badge_text: string;
      };
      const heading = readString(c, ["heading", "title"], "Recommended Products");
      const subheading = readString(c, ["subheading", "subtitle"], "Curated picks we trust and install regularly.");
      const disclosureText = readString(c, ["disclosure_text"], "As an Amazon Associate, we earn from qualifying purchases.");
      const buttonText = readString(c, ["button_text"], "View on Amazon");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "product-grid");
      const bulkInput = readString(c, ["bulk_input"]);
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg"], "#f8fafc");
      const borderColor = readString(c, ["border_color"], "#e2e8f0");
      const accentColor = readString(c, ["accent_color"], "#f59e0b");
      const headingColor = readString(c, ["heading_color"], "#0f172a");
      const bodyColor = readString(c, ["body_color"], "#334155");
      const products = readArray<AmazonProduct>(c, ["products", "items"], []).map((product) => ({
        title: String(product.title || ""),
        image_url: String(product.image_url || ""),
        affiliate_url: String(product.affiliate_url || ""),
        price_text: String(product.price_text || ""),
        rating_text: String(product.rating_text || ""),
        reviews_text: String(product.reviews_text || ""),
        badge_text: String(product.badge_text || ""),
      }));
      const isPreviewVisible = previewEnabled !== false;

      const parseBulkProducts = (): AmazonProduct[] => {
        return bulkInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [title, affiliateUrl, imageUrl, priceText, ratingText, reviewsText, badgeText] = line.split("|").map((value) => value.trim());
            return {
              title: title || "",
              affiliate_url: affiliateUrl || "",
              image_url: imageUrl || "",
              price_text: priceText || "",
              rating_text: ratingText || "",
              reviews_text: reviewsText || "",
              badge_text: badgeText || "",
            };
          });
      };

      const previewColumns = layoutVariant === "feature-spotlight"
        ? "1fr"
        : layoutVariant === "compact-list"
          ? "1fr"
          : layoutVariant === "horizontal-scroll"
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(2, minmax(0, 1fr))";

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "18px 16px", background: sectionBg }}>
                      <h3 style={{ margin: "0 0 8px", color: headingColor, fontWeight: 800, fontSize: "1.5rem" }}>{heading}</h3>
                      {subheading ? <p style={{ margin: "0 0 10px", color: bodyColor }}>{subheading}</p> : null}
                      <p style={{ margin: "0 0 12px", color: bodyColor, fontSize: "0.8rem" }}>{disclosureText}</p>

                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: previewColumns }}>
                        {products.slice(0, layoutVariant === "feature-spotlight" ? 2 : 4).map((product, index) => (
                          <article key={index} style={{ border: `1px solid ${borderColor}`, borderRadius: 12, background: cardBg, padding: 10, display: "grid", gap: 8 }}>
                            <div style={{ borderRadius: 10, background: "#e2e8f0", minHeight: 100, display: "grid", placeItems: "center", color: "#64748b", fontSize: "0.75rem" }}>
                              {product.image_url ? "Product Image" : "Image Placeholder"}
                            </div>
                            {product.badge_text ? (
                              <span style={{ display: "inline-flex", width: "fit-content", borderRadius: 9999, padding: "3px 8px", fontSize: "0.7rem", fontWeight: 700, background: accentColor, color: "#111827" }}>
                                {product.badge_text}
                              </span>
                            ) : null}
                            <strong style={{ color: headingColor }}>{product.title || "Product title"}</strong>
                            {product.price_text ? <p style={{ margin: 0, color: bodyColor, fontWeight: 700 }}>{product.price_text}</p> : null}
                            {(product.rating_text || product.reviews_text) ? (
                              <p style={{ margin: 0, color: bodyColor, fontSize: "0.82rem" }}>
                                {[product.rating_text, product.reviews_text].filter(Boolean).join(" • ")}
                              </p>
                            ) : null}
                            <button style={{ border: 0, borderRadius: 8, padding: "8px 10px", background: "#111827", color: "#ffffff", fontWeight: 700, textAlign: "left" }}>
                              {buttonText}
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product-grid">Product Grid</SelectItem>
                    <SelectItem value="feature-spotlight">Feature Spotlight</SelectItem>
                    <SelectItem value="horizontal-scroll">Horizontal Scroll</SelectItem>
                    <SelectItem value="compact-list">Compact List</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Heading">
                <Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} placeholder="Recommended Products" />
              </FieldRow>
              <FieldRow label="Subheading">
                <Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} />
              </FieldRow>
              <FieldRow label="Affiliate Disclosure (required)">
                <Textarea value={disclosureText} onChange={(e) => set("disclosure_text", e.target.value)} rows={2} />
              </FieldRow>
              <FieldRow label="Button Text">
                <Input value={buttonText} onChange={(e) => set("button_text", e.target.value)} placeholder="View on Amazon" />
              </FieldRow>
              <FieldRow label="Open links in new tab">
                <Switch checked={Boolean(c.open_in_new_tab ?? true)} onCheckedChange={(v) => set("open_in_new_tab", v)} />
              </FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Products (individual)</Label>
                {products.map((product, index) => (
                  <Card key={index} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={product.title}
                        onChange={(e) => {
                          const next = [...products];
                          next[index] = { ...next[index], title: e.target.value };
                          set("products", next);
                        }}
                        placeholder="Product title"
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => set("products", products.filter((_, i) => i !== index))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={product.affiliate_url}
                      onChange={(e) => {
                        const next = [...products];
                        next[index] = { ...next[index], affiliate_url: e.target.value };
                        set("products", next);
                      }}
                      placeholder="https://www.amazon.co.uk/dp/.../?tag=yourtag-21"
                    />
                    <ImagePickerField
                      label="Product Image"
                      value={product.image_url}
                      onChange={(url) => {
                        const next = [...products];
                        next[index] = { ...next[index], image_url: url };
                        set("products", next);
                      }}
                      hint="Use product image with permission from Amazon policies."
                      fieldName={`amazon_product_${index}_image`}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={product.price_text}
                        onChange={(e) => {
                          const next = [...products];
                          next[index] = { ...next[index], price_text: e.target.value };
                          set("products", next);
                        }}
                        placeholder="Price text"
                      />
                      <Input
                        value={product.rating_text}
                        onChange={(e) => {
                          const next = [...products];
                          next[index] = { ...next[index], rating_text: e.target.value };
                          set("products", next);
                        }}
                        placeholder="Rating text"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={product.reviews_text}
                        onChange={(e) => {
                          const next = [...products];
                          next[index] = { ...next[index], reviews_text: e.target.value };
                          set("products", next);
                        }}
                        placeholder="Reviews text"
                      />
                      <Input
                        value={product.badge_text}
                        onChange={(e) => {
                          const next = [...products];
                          next[index] = { ...next[index], badge_text: e.target.value };
                          set("products", next);
                        }}
                        placeholder="Badge text"
                      />
                    </div>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => set("products", [...products, { title: "", image_url: "", affiliate_url: "", price_text: "", rating_text: "", reviews_text: "", badge_text: "" }])}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
                </Button>
              </div>

              <FieldRow label="Bulk Import (one product per line)">
                <Textarea
                  value={bulkInput}
                  onChange={(e) => set("bulk_input", e.target.value)}
                  rows={4}
                  placeholder="Title|Affiliate URL|Image URL|Price|Rating|Reviews|Badge"
                />
              </FieldRow>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const parsed = parseBulkProducts();
                  if (!parsed.length) return;
                  set("products", parsed);
                }}
              >
                Import Bulk Products
              </Button>
              <p className="text-xs text-muted-foreground">
                Keep disclosures visible, avoid misleading price claims, and ensure affiliate links include your Associates tag.
              </p>
            </div>
          </div>
        </div>
      );
    }

    case "online_booking": {
      const heading = readString(c, ["heading", "title"], "Book an Appointment");
      const subheading = readString(c, ["subheading", "subtitle"], "Choose a service and pick a time that suits you.");
      const label = readString(c, ["label", "eyebrow"], "");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "centered-card");
      const sectionBg = readString(c, ["section_bg"], "#f8fafc");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#1d4ed8");
      const headingColor = readString(c, ["heading_color"], "#111827");
      const bodyColor = readString(c, ["body_color"], "#6b7280");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const buttonFont = readString(c, ["button_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "20px 16px", background: sectionBg }}>
                      <div style={{ borderRadius: 14, border: `1px solid ${borderColor}`, background: cardBg, padding: 14 }}>
                        {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontWeight: 700, fontFamily: bodyFont }}>{label}</p> : null}
                        <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h3>
                        <p style={{ margin: "0 0 10px", color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, padding: "8px 10px", fontFamily: bodyFont, color: bodyColor }}>Select a service...</div>
                          <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, padding: "8px 10px", fontFamily: bodyFont, color: bodyColor }}>Postcode</div>
                          <button style={{ border: 0, borderRadius: 8, padding: "9px 12px", background: accentColor, color: "#fff", fontWeight: 700, fontFamily: buttonFont, textAlign: "left" }}>Next: Choose a time</button>
                        </div>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centered-card">Centered Card</SelectItem>
                    <SelectItem value="split-shell">Split Shell</SelectItem>
                    <SelectItem value="minimal-panel">Minimal Panel</SelectItem>
                    <SelectItem value="glass-card">Glass Card</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Eyebrow / Label (optional)">
                <Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} />
              </FieldRow>
              <FieldRow label="Section Heading">
                <Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} placeholder="Book an Appointment" />
              </FieldRow>
              <FieldRow label="Subheading">
                <Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} placeholder="Choose a service and pick a time that suits you." />
              </FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Button Font"><Input value={buttonFont} onChange={(e) => set("button_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <strong>Booking settings</strong> — services, working hours and auto-confirm are managed in{" "}
                <a href="/booking/setup" className="underline font-medium">Online Booking → Setup</a>. For a full walkthrough of the block and publishing flow, see the{" "}
                <a href="/help#online-booking" className="underline font-medium">User Guide → Online Booking</a> section.
              </div>
              <FieldRow label="Show prices on services">
                <Switch checked={Boolean(c.show_price ?? true)} onCheckedChange={(v) => set("show_price", v)} />
              </FieldRow>
              <FieldRow label="Require postcode from customer">
                <Switch checked={Boolean(c.require_postcode ?? true)} onCheckedChange={(v) => set("require_postcode", v)} />
              </FieldRow>
              <FieldRow label="Require job description">
                <Switch checked={Boolean(c.require_description ?? true)} onCheckedChange={(v) => set("require_description", v)} />
              </FieldRow>
              <FieldRow label="Complex job keywords">
                <Input
                  value={String(c.complex_keywords ?? "")}
                  onChange={(e) => set("complex_keywords", e.target.value)}
                  placeholder="repair,breakdown,fault,emergency"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated. If a service name/description contains any of these words, the booking is flagged as complex and marked as pending approval.
                </p>
              </FieldRow>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Section Heading">
              <Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} placeholder="Book an Appointment" />
            </FieldRow>
            <FieldRow label="Subheading">
              <Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} placeholder="Choose a service and pick a time that suits you." />
            </FieldRow>
            <FieldRow label="Show prices on services">
              <Switch checked={Boolean(c.show_price ?? true)} onCheckedChange={(v) => set("show_price", v)} />
            </FieldRow>
          </div>
        </div>
      );
    }

    case "legal_content": {
      const heading = readString(c, ["heading", "title"], "Legal");
      const label = readString(c, ["label", "eyebrow"]);
      const body = readString(c, ["html", "body", "text"]);
      const layoutVariant = readString(c, ["layout_variant", "layout"], "classic-doc");
      const sectionBg = readString(c, ["section_bg", "background_color"], "#ffffff");
      const cardBg = readString(c, ["card_bg"], "#ffffff");
      const borderColor = readString(c, ["border_color"], "#e5e7eb");
      const accentColor = readString(c, ["accent_color"], "#d97706");
      const headingColor = readString(c, ["heading_color", "text_color"], "#0f172a");
      const bodyColor = readString(c, ["body_color", "muted_text_color"], "#334155");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "2.1rem");
      const bodySize = readString(c, ["body_size"], "1rem");
      const cardRadius = readString(c, ["card_radius"], "12px");
      const isPreviewVisible = previewEnabled !== false;

      const sampleParagraph = body
        ? body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220)
        : "We process your data to deliver services, communicate updates, and meet legal obligations. You can contact us to request access, correction, or deletion where applicable.";

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "18px 16px", background: sectionBg }}>
                      {layoutVariant === "split-aside" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: 12 }}>
                          <aside style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 10 }}>
                            <p style={{ margin: 0, color: headingColor, fontFamily: headingFont, fontWeight: 700 }}>On this page</p>
                            <p style={{ margin: "6px 0 0", color: bodyColor, fontFamily: bodyFont, fontSize: "0.8rem" }}>Overview</p>
                            <p style={{ margin: "4px 0 0", color: bodyColor, fontFamily: bodyFont, fontSize: "0.8rem" }}>Data Use</p>
                          </aside>
                          <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 12 }}>
                            {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontFamily: bodyFont, fontWeight: 700 }}>{label}</p> : null}
                            <h3 style={{ margin: "0 0 8px", color: headingColor, fontFamily: headingFont, fontWeight: 800, fontSize: headingSize }}>{heading}</h3>
                            <p style={{ margin: 0, color: bodyColor, fontFamily: bodyFont, fontSize: bodySize, lineHeight: 1.8 }}>{sampleParagraph}</p>
                          </article>
                        </div>
                      ) : layoutVariant === "minimal-prose" ? (
                        <article>
                          {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontFamily: bodyFont, fontWeight: 700 }}>{label}</p> : null}
                          <h3 style={{ margin: "0 0 8px", color: headingColor, fontFamily: headingFont, fontWeight: 800, fontSize: headingSize }}>{heading}</h3>
                          <p style={{ margin: 0, color: bodyColor, fontFamily: bodyFont, fontSize: bodySize, lineHeight: 1.85 }}>{sampleParagraph}</p>
                        </article>
                      ) : layoutVariant === "boxed-note" ? (
                        <article style={{ border: `2px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 12, boxShadow: `0 8px 24px -18px ${accentColor}` }}>
                          {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontFamily: bodyFont, fontWeight: 700 }}>{label}</p> : null}
                          <h3 style={{ margin: "0 0 8px", color: headingColor, fontFamily: headingFont, fontWeight: 800, fontSize: headingSize }}>{heading}</h3>
                          <p style={{ margin: 0, color: bodyColor, fontFamily: bodyFont, fontSize: bodySize, lineHeight: 1.85 }}>{sampleParagraph}</p>
                        </article>
                      ) : (
                        <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 12 }}>
                          {label ? <p style={{ margin: "0 0 6px", color: accentColor, fontFamily: bodyFont, fontWeight: 700 }}>{label}</p> : null}
                          <h3 style={{ margin: "0 0 8px", color: headingColor, fontFamily: headingFont, fontWeight: 800, fontSize: headingSize }}>{heading}</h3>
                          <p style={{ margin: 0, color: bodyColor, fontFamily: bodyFont, fontSize: bodySize, lineHeight: 1.85 }}>{sampleParagraph}</p>
                        </article>
                      )}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic-doc">Classic Doc</SelectItem>
                    <SelectItem value="split-aside">Split Aside</SelectItem>
                    <SelectItem value="boxed-note">Boxed Note</SelectItem>
                    <SelectItem value="minimal-prose">Minimal Prose</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
              <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
              <FieldRow label="Legal Body (HTML or plain text)">
                <Textarea
                  value={body}
                  onChange={(e) => onChange(syncBlockContent(c, { html: e.target.value, body: e.target.value, text: e.target.value }, { html: ["body", "text"], body: ["html", "text"], text: ["html", "body"] }))}
                  rows={9}
                />
              </FieldRow>
              <FieldRow label="Section Background"><Input value={sectionBg} onChange={(e) => set("section_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Card Background"><Input value={cardBg} onChange={(e) => set("card_bg", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>
              <FieldRow label="Card Radius"><Input value={cardRadius} onChange={(e) => set("card_radius", e.target.value)} /></FieldRow>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
            <FieldRow label="Legal Body (HTML or plain text)">
              <Textarea
                value={body}
                onChange={(e) => onChange(syncBlockContent(c, { html: e.target.value, body: e.target.value, text: e.target.value }, { html: ["body", "text"], body: ["html", "text"], text: ["html", "body"] }))}
                rows={7}
              />
            </FieldRow>
          </div>
        </div>
      );
    }

    case "sticky_mobile_cta": {
      const primaryLabel = readString(c, ["primary_label", "primaryLabel"], "Call Now");
      const primaryHref = readString(c, ["primary_href", "primaryHref"], "tel:+441224000000");
      const secondaryLabel = readString(c, ["secondary_label", "secondaryLabel"], "Book Online");
      const secondaryHref = readString(c, ["secondary_href", "secondaryHref"], "/book");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "dual-pill");
      const backgroundColor = readString(c, ["background_color", "backgroundColor"], "#0f172a");
      const textColor = readString(c, ["text_color", "textColor"], "#ffffff");
      const primaryColor = readString(c, ["primary_color"], "rgba(255,255,255,0.2)");
      const secondaryColor = readString(c, ["secondary_color"], "rgba(255,255,255,0.08)");
      const borderColor = readString(c, ["border_color", "borderColor"], "rgba(255,255,255,0.2)");
      const headingColor = readString(c, ["heading_color"], "#ffffff");
      const bodyColor = readString(c, ["body_color"], "rgba(255,255,255,0.78)");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const buttonFont = readString(c, ["button_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "0.9rem");
      const bodySize = readString(c, ["body_size"], "0.78rem");
      const buttonSize = readString(c, ["button_size"], "0.92rem");
      const barRadius = readString(c, ["bar_radius"], "12px");
      const buttonRadius = readString(c, ["button_radius"], "10px");
      const heading = readString(c, ["heading", "title"], "Need help today?");
      const subheading = readString(c, ["subheading", "subtitle"], "Call us now or book online.");
      const isPreviewVisible = previewEnabled !== false;

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <section style={{ padding: "16px", background: "#f8fafc", minHeight: 220, display: "grid", alignItems: "end" }}>
                      <div style={{ border: `1px solid ${borderColor}`, borderRadius: barRadius, background: backgroundColor, padding: 10 }}>
                        {(layoutVariant === "stacked-copy" || layoutVariant === "split-label") ? (
                          <div style={{ marginBottom: 8 }}>
                            <p style={{ margin: "0 0 3px", color: headingColor, fontFamily: headingFont, fontSize: headingSize, fontWeight: 700 }}>{heading}</p>
                            <p style={{ margin: 0, color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{subheading}</p>
                          </div>
                        ) : null}
                        <div style={{ display: "grid", gridTemplateColumns: layoutVariant === "single-primary" ? "1fr" : "1fr 1fr", gap: 8 }}>
                          <div style={{ borderRadius: buttonRadius, padding: "10px", textAlign: "center", background: primaryColor, color: textColor, border: `1px solid ${borderColor}`, fontFamily: buttonFont, fontWeight: 700, fontSize: buttonSize }}>{primaryLabel}</div>
                          {layoutVariant === "single-primary" ? null : (
                            <div style={{ borderRadius: buttonRadius, padding: "10px", textAlign: "center", background: secondaryColor, color: textColor, border: `1px solid ${borderColor}`, fontFamily: buttonFont, fontWeight: 700, fontSize: buttonSize }}>{secondaryLabel}</div>
                          )}
                        </div>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Enabled">
                <Switch checked={Boolean(c.enabled ?? true)} onCheckedChange={(v) => set("enabled", v)} />
              </FieldRow>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dual-pill">Dual Pill</SelectItem>
                    <SelectItem value="stacked-copy">Stacked Copy</SelectItem>
                    <SelectItem value="split-label">Split Label</SelectItem>
                    <SelectItem value="single-primary">Single Primary</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Heading (optional)">
                <Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} placeholder="Need help today?" />
              </FieldRow>
              <FieldRow label="Subheading (optional)">
                <Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} placeholder="Call us now or book online." />
              </FieldRow>
              <FieldRow label="Primary Button Label">
                <Input
                  value={primaryLabel}
                  onChange={(e) => onChange(syncBlockContent(c, { primary_label: e.target.value, primaryLabel: e.target.value }, { primary_label: ["primaryLabel"], primaryLabel: ["primary_label"] }))}
                  placeholder="Call Now"
                />
              </FieldRow>
              <FieldRow label="Primary Button URL (tel:, https:, or /path)">
                <Input
                  value={primaryHref}
                  onChange={(e) => onChange(syncBlockContent(c, { primary_href: e.target.value, primaryHref: e.target.value }, { primary_href: ["primaryHref"], primaryHref: ["primary_href"] }))}
                  placeholder="tel:+441224000000"
                />
              </FieldRow>
              <FieldRow label="Secondary Button Label">
                <Input
                  value={secondaryLabel}
                  onChange={(e) => onChange(syncBlockContent(c, { secondary_label: e.target.value, secondaryLabel: e.target.value }, { secondary_label: ["secondaryLabel"], secondaryLabel: ["secondary_label"] }))}
                  placeholder="Book Online"
                />
              </FieldRow>
              <FieldRow label="Secondary Button URL">
                <Input
                  value={secondaryHref}
                  onChange={(e) => onChange(syncBlockContent(c, { secondary_href: e.target.value, secondaryHref: e.target.value }, { secondary_href: ["secondaryHref"], secondaryHref: ["secondary_href"] }))}
                  placeholder="/book"
                />
              </FieldRow>
              <FieldRow label="Bar Background"><Input value={backgroundColor} onChange={(e) => onChange(syncBlockContent(c, { background_color: e.target.value, backgroundColor: e.target.value }, { background_color: ["backgroundColor"], backgroundColor: ["background_color"] }))} /></FieldRow>
              <FieldRow label="Primary Button Background"><Input value={primaryColor} onChange={(e) => set("primary_color", e.target.value)} /></FieldRow>
              <FieldRow label="Secondary Button Background"><Input value={secondaryColor} onChange={(e) => set("secondary_color", e.target.value)} /></FieldRow>
              <FieldRow label="Text Color"><Input value={textColor} onChange={(e) => onChange(syncBlockContent(c, { text_color: e.target.value, textColor: e.target.value }, { text_color: ["textColor"], textColor: ["text_color"] }))} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => onChange(syncBlockContent(c, { border_color: e.target.value, borderColor: e.target.value }, { border_color: ["borderColor"], borderColor: ["border_color"] }))} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Body Color"><Input value={bodyColor} onChange={(e) => set("body_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Button Font"><Input value={buttonFont} onChange={(e) => set("button_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>
              <FieldRow label="Button Size"><Input value={buttonSize} onChange={(e) => set("button_size", e.target.value)} /></FieldRow>
              <FieldRow label="Bar Radius"><Input value={barRadius} onChange={(e) => set("bar_radius", e.target.value)} /></FieldRow>
              <FieldRow label="Button Radius"><Input value={buttonRadius} onChange={(e) => set("button_radius", e.target.value)} /></FieldRow>

              <p className="text-xs text-muted-foreground">Displays on mobile only. Use tel: links for direct-call CTAs.</p>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Primary Button Label">
              <Input
                value={primaryLabel}
                onChange={(e) => onChange(syncBlockContent(c, { primary_label: e.target.value, primaryLabel: e.target.value }, { primary_label: ["primaryLabel"], primaryLabel: ["primary_label"] }))}
                placeholder="Call Now"
              />
            </FieldRow>
            <FieldRow label="Primary Button URL">
              <Input
                value={primaryHref}
                onChange={(e) => onChange(syncBlockContent(c, { primary_href: e.target.value, primaryHref: e.target.value }, { primary_href: ["primaryHref"], primaryHref: ["primary_href"] }))}
                placeholder="tel:+441224000000"
              />
            </FieldRow>
            <FieldRow label="Secondary Button Label">
              <Input
                value={secondaryLabel}
                onChange={(e) => onChange(syncBlockContent(c, { secondary_label: e.target.value, secondaryLabel: e.target.value }, { secondary_label: ["secondaryLabel"], secondaryLabel: ["secondary_label"] }))}
                placeholder="Book Online"
              />
            </FieldRow>
          </div>
        </div>
      );
    }

    case "site.footer": {
      type LinkItem = { label: string; href: string };
      const logoText = readString(c, ["logoText"], "");
      const description = readString(c, ["description"], "");
      const phone = readString(c, ["phone"], "");
      const email = readString(c, ["email"], "");
      const layoutVariant = readString(c, ["layout_variant", "layout"], "four-column");
      const backgroundColor = readString(c, ["background_color", "background"], "#111827");
      const textColor = readString(c, ["text_color"], "#9ca3af");
      const headingColor = readString(c, ["heading_color"], "#ffffff");
      const accentColor = readString(c, ["accent_color"], "#0ea5e9");
      const borderColor = readString(c, ["border_color"], "rgba(255,255,255,0.12)");
      const headingFont = readString(c, ["heading_font_family"], "inherit");
      const bodyFont = readString(c, ["body_font_family"], "inherit");
      const headingSize = readString(c, ["heading_size"], "1rem");
      const bodySize = readString(c, ["body_size"], "0.9rem");
      const isPreviewVisible = previewEnabled !== false;
      const navItems = readArray<Record<string, unknown>>(c, ["navItems"], [])
        .map((item) => ({
          label: String(item.label ?? ""),
          href: String(item.href ?? ""),
        }));
      const legalLinks = readArray<Record<string, unknown>>(c, ["legalLinks"], [])
        .map((item) => ({
          label: String(item.label ?? ""),
          href: String(item.href ?? ""),
        }));

      const updateNavItems = (next: LinkItem[]) => set("navItems", next);
      const updateLegalLinks = (next: LinkItem[]) => set("legalLinks", next);

      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] xl:min-h-0">
            <div className="xl:min-h-0">
              {isPreviewVisible ? (
                <Card className="overflow-hidden border-border/70 shadow-xl xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:min-h-0">
                  <CardHeader className="border-b bg-muted/40 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(false)}>Hide preview</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 xl:h-[calc(100vh-11.5rem)] xl:overflow-y-auto">
                    <footer style={{ background: backgroundColor, color: textColor, padding: "18px 16px" }}>
                      <div style={{ borderBottom: `1px solid ${borderColor}`, paddingBottom: 10, marginBottom: 10 }}>
                        <h4 style={{ margin: 0, color: headingColor, fontFamily: headingFont, fontSize: headingSize }}>{logoText || "Your Business"}</h4>
                        {description ? <p style={{ margin: "6px 0 0", color: textColor, fontFamily: bodyFont, fontSize: bodySize }}>{description}</p> : null}
                      </div>
                      {layoutVariant === "centered-stack" ? (
                        <div style={{ textAlign: "center", display: "grid", gap: 6, fontFamily: bodyFont, fontSize: bodySize }}>
                          <span>{phone || "01224 000000"}</span>
                          <span>{email || "hello@yourbusiness.co.uk"}</span>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, fontFamily: bodyFont, fontSize: bodySize }}>
                          <div>
                            <strong style={{ color: headingColor }}>Links</strong>
                            {navItems.slice(0, 3).map((item, i) => (<div key={i}>{item.label || "Link"}</div>))}
                          </div>
                          <div>
                            <strong style={{ color: headingColor }}>Contact</strong>
                            <div>{phone || "01224 000000"}</div>
                            <div>{email || "hello@yourbusiness.co.uk"}</div>
                          </div>
                        </div>
                      )}
                      <div style={{ borderTop: `1px solid ${borderColor}`, marginTop: 10, paddingTop: 8, fontSize: "0.78rem", fontFamily: bodyFont }}>
                        Legal links: {legalLinks.map((item) => item.label).filter(Boolean).join(" • ") || "Privacy • Terms"}
                      </div>
                    </footer>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">Preview hidden for this block.</div>
              )}
            </div>

            <div className="space-y-3 xl:min-h-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => onTogglePreview?.(!isPreviewVisible)}>{isPreviewVisible ? "Hide preview" : "Show preview"}</Button>
              </div>
              <FieldRow label="Layout Variation">
                <Select value={layoutVariant} onValueChange={(v) => onChange(syncBlockContent(c, { layout_variant: v, layout: v }, { layout_variant: ["layout"], layout: ["layout_variant"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="four-column">Four Column</SelectItem>
                    <SelectItem value="compact-inline">Compact Inline</SelectItem>
                    <SelectItem value="centered-stack">Centered Stack</SelectItem>
                    <SelectItem value="minimal-columns">Minimal Columns</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Logo Text">
                <Input value={logoText} onChange={(e) => set("logoText", e.target.value)} placeholder="Your Business" />
              </FieldRow>
              <FieldRow label="Description">
                <Textarea value={description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Short business description for the footer." />
              </FieldRow>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldRow label="Phone">
                  <Input value={phone} onChange={(e) => set("phone", e.target.value)} placeholder="01224 000000" />
                </FieldRow>
                <FieldRow label="Email">
                  <Input value={email} onChange={(e) => set("email", e.target.value)} placeholder="hello@yourbusiness.co.uk" />
                </FieldRow>
              </div>
              <FieldRow label="Background Color"><Input value={backgroundColor} onChange={(e) => set("background_color", e.target.value)} /></FieldRow>
              <FieldRow label="Text Color"><Input value={textColor} onChange={(e) => set("text_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Color"><Input value={headingColor} onChange={(e) => set("heading_color", e.target.value)} /></FieldRow>
              <FieldRow label="Accent Color"><Input value={accentColor} onChange={(e) => set("accent_color", e.target.value)} /></FieldRow>
              <FieldRow label="Border Color"><Input value={borderColor} onChange={(e) => set("border_color", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Font"><Input value={headingFont} onChange={(e) => set("heading_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Body Font"><Input value={bodyFont} onChange={(e) => set("body_font_family", e.target.value)} /></FieldRow>
              <FieldRow label="Heading Size"><Input value={headingSize} onChange={(e) => set("heading_size", e.target.value)} /></FieldRow>
              <FieldRow label="Body Size"><Input value={bodySize} onChange={(e) => set("body_size", e.target.value)} /></FieldRow>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Footer Navigation Links</Label>
                {navItems.map((item, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.label} onChange={(e) => { const next = [...navItems]; next[i] = { ...next[i], label: e.target.value }; updateNavItems(next); }} placeholder="Label" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateNavItems(navItems.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input value={item.href} onChange={(e) => { const next = [...navItems]; next[i] = { ...next[i], href: e.target.value }; updateNavItems(next); }} placeholder="/services" />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateNavItems([...navItems, { label: "", href: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Nav Link
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Legal Links</Label>
                {legalLinks.map((item, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={item.label} onChange={(e) => { const next = [...legalLinks]; next[i] = { ...next[i], label: e.target.value }; updateLegalLinks(next); }} placeholder="Label" className="flex-1" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateLegalLinks(legalLinks.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input value={item.href} onChange={(e) => { const next = [...legalLinks]; next[i] = { ...next[i], href: e.target.value }; updateLegalLinks(next); }} placeholder="/privacy" />
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateLegalLinks([...legalLinks, { label: "", href: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Legal Link
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden space-y-3">
            <FieldRow label="Logo Text">
              <Input value={logoText} onChange={(e) => set("logoText", e.target.value)} placeholder="Your Business" />
            </FieldRow>
            <FieldRow label="Description">
              <Textarea value={description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Short business description for the footer." />
            </FieldRow>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Phone">
                <Input value={phone} onChange={(e) => set("phone", e.target.value)} placeholder="01224 000000" />
              </FieldRow>
              <FieldRow label="Email">
                <Input value={email} onChange={(e) => set("email", e.target.value)} placeholder="hello@yourbusiness.co.uk" />
              </FieldRow>
            </div>
          </div>
        </div>
      );
    }

    default:
      return <GenericBlockEditor blockType={block.block_type} content={c} onChange={onChange} />;
  }
}

// ---------------------------------------------------------------------------
// Block card
// ---------------------------------------------------------------------------

function BlockCard({
  block,
  index,
  total,
  onMove,
  onToggleVisible,
  onDelete,
  onContentChange,
  previewEnabled,
  onTogglePreview,
}: {
  block: Block;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onContentChange: (id: string, content: Record<string, unknown>) => void;
  previewEnabled?: boolean;
  onTogglePreview?: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalizedType = normalizeTemplateBlockType(block.block_type);
  const palette = BLOCK_PALETTE.find((p) => p.type === normalizedType);
  const displayLabel = palette?.label
    ?? String(block.block_type || "")
      .replace(/[._]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  const Icon = palette?.icon ?? Layout;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={block.is_visible ? "" : "opacity-50"}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none py-3 px-4">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{displayLabel}</span>
                {Boolean(block.content.heading ?? block.content.title) && (
                  <span className="text-muted-foreground text-xs ml-2 truncate">— {String(block.content.heading ?? block.content.title)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={index === 0}
                  onClick={() => onMove(index, index - 1)}
                  title="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={index === total - 1}
                  onClick={() => onMove(index, index + 1)}
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => onToggleVisible(block.id)}
                  title={block.is_visible ? "Hide block" : "Show block"}
                >
                  {block.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete(block.id)}
                  title="Delete block"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 border-t">
            <div className="pt-3">
              <BlockEditor
                block={block}
                onChange={(content) => onContentChange(block.id, content)}
                previewEnabled={previewEnabled}
                onTogglePreview={onTogglePreview}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main page editor component
// ---------------------------------------------------------------------------

export default function WebsitePageEditor() {
  const { pageId } = useParams<{ pageId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const leftPanelStorageKey = "website-page-editor-left-panel-collapsed";
  const rightPanelStorageKey = "website-page-editor-right-panel-collapsed";
  const readPanelCollapsedState = (key: string) => {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  };

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showHeroPreview, setShowHeroPreview] = useState(true);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => readPanelCollapsedState(leftPanelStorageKey));
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => readPanelCollapsedState(rightPanelStorageKey));
  const [metaForm, setMetaForm] = useState({
    title: "",
    slug: "",
    meta_title: "",
    meta_description: "",
    no_index: false,
    show_in_nav: true,
    nav_label: "",
  });

  // ── Fetch page + blocks
  const { data: page, isLoading } = useQuery<Page>({
    queryKey: [`/api/website/pages/${pageId}`],
    queryFn: () => apiFetch(`/api/website/pages/${pageId}`),
    enabled: !!pageId,
  });

  // Populate local state when page loads
  useEffect(() => {
    if (page) {
      setBlocks(hydrateEditorBlocks(page));
      setMetaForm({
        title: page.title,
        slug: page.slug.replace(/^\//, ""),
        meta_title: page.meta_title ?? "",
        meta_description: page.meta_description ?? "",
        no_index: page.no_index ?? false,
        show_in_nav: page.show_in_nav ?? false,
        nav_label: page.nav_label ?? "",
      });
      setIsDirty(false);
    }
  }, [page]);

  useEffect(() => {
    try {
      localStorage.setItem(leftPanelStorageKey, String(leftPanelCollapsed));
    } catch {
      // Ignore storage failures and keep the editor usable.
    }
  }, [leftPanelCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(rightPanelStorageKey, String(rightPanelCollapsed));
    } catch {
      // Ignore storage failures and keep the editor usable.
    }
  }, [rightPanelCollapsed]);

  // ── Save blocks
  const saveBlocksMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/website/pages/${pageId}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: blocks.map((b, i) => ({
            block_type: b.block_type,
            content: b.content,
            sort_order: i,
            is_visible: b.is_visible,
          })),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/website/pages/${pageId}`] });
      setIsDirty(false);
      toast({ title: "Page saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  // ── Save page meta
  const saveMetaMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/website/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: metaForm.title,
          ...(page?.page_type !== "home" ? { slug: metaForm.slug || page?.slug } : {}),
          meta_title: metaForm.meta_title || null,
          meta_description: metaForm.meta_description || null,
          no_index: metaForm.no_index,
          show_in_nav: metaForm.show_in_nav,
          nav_label: metaForm.nav_label || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/website/pages/${pageId}`] });
      toast({ title: "Page settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Publish page
  const publishMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/website/pages/${pageId}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/website/pages/${pageId}`] });
      toast({ title: "Page published" });
    },
    onError: (e: Error) => toast({ title: "Publish failed", description: e.message, variant: "destructive" }),
  });

  // ── Block operations
  const addBlock = useCallback((type: BlockType) => {
    const palette = BLOCK_PALETTE.find((p) => p.type === type)!;
    if (palette.singleton && blocks.some((b) => resolveEditorType(b.block_type) === type)) {
      toast({ title: `${palette.label} already exists on this page`, duration: 1800 });
      return;
    }
    const newBlock: Block = {
      id: generateId(),
      block_type: type,
      content: { ...palette.defaultContent },
      sort_order: blocks.length,
      is_visible: true,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setIsDirty(true);
    toast({ title: `${palette.label} added`, duration: 1500 });
  }, [blocks.length, toast]);

  const moveBlock = useCallback((from: number, to: number) => {
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    setIsDirty(true);
  }, []);

  const toggleVisible = useCallback((id: string) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, is_visible: !b.is_visible } : b));
    setIsDirty(true);
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setDeletingBlockId(null);
    setIsDirty(true);
  }, []);

  const updateBlockContent = useCallback((id: string, content: Record<string, unknown>) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, content } : b));
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    if (isDirty) {
      saveBlocksMutation.mutate();
    }
    if (metaDirty) {
      saveMetaMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Page not found.</p>
        <Link href="/website/pages"><Button variant="link" className="px-0 mt-2">← Back to pages</Button></Link>
      </div>
    );
  }

  const metaDirty =
    page
      ? (
          metaForm.title !== page.title ||
          metaForm.slug !== page.slug.replace(/^\//, "") ||
          metaForm.meta_title !== (page.meta_title ?? "") ||
          metaForm.meta_description !== (page.meta_description ?? "") ||
          metaForm.no_index !== page.no_index ||
          metaForm.show_in_nav !== page.show_in_nav ||
          metaForm.nav_label !== (page.nav_label ?? "")
        )
      : false;

  const hasUnsavedChanges = isDirty || metaDirty;
  const isSaving = saveBlocksMutation.isPending || saveMetaMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/website/pages">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{page.title}</h1>
            <p className="text-xs text-muted-foreground">/{page.slug}</p>
          </div>
          <Badge variant={page.status === "published" ? "default" : "secondary"} className="flex-shrink-0">
            {page.status}
          </Badge>
          {hasUnsavedChanges && <Badge variant="outline" className="flex-shrink-0 text-amber-600 border-amber-300">Unsaved changes</Badge>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasUnsavedChanges && (
            <Button variant="ghost" size="sm" onClick={() => {
              setBlocks(hydrateEditorBlocks(page));
              setMetaForm({
                title: page.title,
                slug: page.slug.replace(/^\//, ""),
                meta_title: page.meta_title ?? "",
                meta_description: page.meta_description ?? "",
                no_index: page.no_index ?? false,
                show_in_nav: page.show_in_nav ?? false,
                nav_label: page.nav_label ?? "",
              });
              setIsDirty(false);
            }}>
              <Undo2 className="w-3.5 h-3.5 mr-1" /> Discard
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges} size="sm">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save
          </Button>
          {page.status === "draft" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || hasUnsavedChanges}
              title={hasUnsavedChanges ? "Save first before publishing" : undefined}
            >
              <Globe className="w-3.5 h-3.5 mr-1.5" /> Publish
            </Button>
          )}
        </div>
      </div>

      {/* ── 3-column layout ────────────────────────────────────────────── */}
      <div
        className={cn(
          "grid flex-1 min-h-0 overflow-hidden",
          leftPanelCollapsed && rightPanelCollapsed
            ? "xl:grid-cols-[3rem_minmax(0,1fr)_3rem]"
            : leftPanelCollapsed
              ? "xl:grid-cols-[3rem_minmax(0,1fr)_15.5rem]"
              : rightPanelCollapsed
                ? "xl:grid-cols-[11.5rem_minmax(0,1fr)_3rem]"
                : "xl:grid-cols-[11.5rem_minmax(0,1fr)_15.5rem]"
        )}
      >

        {/* ── Left: Block palette ──────────────────────────────────────── */}
        <aside className="border-r bg-muted/30 overflow-y-auto">
          <div className="flex items-center justify-between gap-2 border-b px-2.5 py-2">
            <p className={cn("text-xs font-semibold text-muted-foreground", leftPanelCollapsed && "sr-only")}>Add Block</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setLeftPanelCollapsed((v) => !v)}
              title={leftPanelCollapsed ? "Expand block palette" : "Collapse block palette"}
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform", leftPanelCollapsed && "rotate-180")} />
            </Button>
          </div>
          {leftPanelCollapsed ? (
            <div className="p-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setLeftPanelCollapsed(false)} title="Expand block palette">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1 p-2.5">
              {BLOCK_PALETTE.map((item) => {
                const Icon = item.icon;
                const isSingletonBlocked = item.singleton && blocks.some((b) => resolveEditorType(b.block_type) === item.type);
                return (
                  <button
                    key={item.type}
                    onClick={() => addBlock(item.type)}
                    disabled={isSingletonBlocked}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isSingletonBlocked ? `${item.description} (already on page)` : item.description}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                    <Plus className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* ── Centre: Block list ───────────────────────────────────────── */}
        <main className="min-w-0 overflow-y-auto p-3 space-y-2">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
              <Layout className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No blocks yet</p>
              <p className="text-sm mt-1">Choose a block from the left panel to start building this page.</p>
            </div>
          ) : (
            blocks.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                index={index}
                total={blocks.length}
                onMove={moveBlock}
                onToggleVisible={toggleVisible}
                onDelete={(id) => setDeletingBlockId(id)}
                onContentChange={updateBlockContent}
                previewEnabled={showHeroPreview}
                onTogglePreview={setShowHeroPreview}
              />
            ))
          )}
        </main>

        {/* ── Right: Page settings ─────────────────────────────────────── */}
        <aside className="border-l overflow-y-auto">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <h2 className={cn("text-sm font-semibold", rightPanelCollapsed && "sr-only")}>Page Settings</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRightPanelCollapsed((v) => !v)}
              title={rightPanelCollapsed ? "Expand page settings" : "Collapse page settings"}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", rightPanelCollapsed && "rotate-180")} />
            </Button>
          </div>
          {rightPanelCollapsed ? (
            <div className="p-2 flex items-start justify-center">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setRightPanelCollapsed(false)} title="Expand page settings">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="p-3 space-y-4">
              <div>
                <div className="space-y-3">
                  <FieldRow label="Page Title">
                    <Input value={metaForm.title} onChange={(e) => setMetaForm((f) => ({ ...f, title: e.target.value }))} />
                  </FieldRow>
                  <FieldRow label="Page URL">
                    {page.page_type === "home" ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground px-3 py-2 rounded-md border bg-muted/50">
                        <span className="text-muted-foreground/60">/</span>
                        <span>(home page — fixed)</span>
                      </div>
                    ) : (
                      <div className="flex items-center rounded-md border overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                        <span className="px-2 py-2 text-sm text-muted-foreground bg-muted border-r select-none">/</span>
                        <Input
                          value={metaForm.slug}
                          onChange={(e) => {
                            const raw = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-/]/g, "-")
                              .replace(/-+/g, "-")
                              .replace(/^\//, "");
                            setMetaForm((f) => ({ ...f, slug: raw }));
                          }}
                          className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="page-url"
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">Only lowercase letters, numbers and hyphens</p>
                  </FieldRow>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Show in navigation</Label>
                    <Switch checked={metaForm.show_in_nav} onCheckedChange={(v) => setMetaForm((f) => ({ ...f, show_in_nav: v }))} />
                  </div>
                  {metaForm.show_in_nav && (
                    <FieldRow label="Nav Label">
                      <Input value={metaForm.nav_label} onChange={(e) => setMetaForm((f) => ({ ...f, nav_label: e.target.value }))} placeholder={metaForm.title} />
                    </FieldRow>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-sm font-semibold mb-3">SEO</h2>
                <div className="space-y-3">
                  <FieldRow label="Meta Title">
                    <Input
                      value={metaForm.meta_title}
                      onChange={(e) => setMetaForm((f) => ({ ...f, meta_title: e.target.value }))}
                      placeholder={metaForm.title}
                      maxLength={60}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">{metaForm.meta_title.length}/60 chars</p>
                  </FieldRow>
                  <FieldRow label="Meta Description">
                    <Textarea
                      value={metaForm.meta_description}
                      onChange={(e) => setMetaForm((f) => ({ ...f, meta_description: e.target.value }))}
                      placeholder="A short description for search engines..."
                      rows={3}
                      maxLength={160}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">{metaForm.meta_description.length}/160 chars</p>
                  </FieldRow>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs text-muted-foreground">Hide from search engines</Label>
                      <p className="text-xs text-muted-foreground/70">Adds noindex tag</p>
                    </div>
                    <Switch checked={metaForm.no_index} onCheckedChange={(v) => setMetaForm((f) => ({ ...f, no_index: v }))} />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => saveMetaMutation.mutate()}
                  disabled={saveMetaMutation.isPending}
                >
                  {saveMetaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Save Page Settings
                </Button>
              </div>

              <Separator />

              <div>
                <h2 className="text-sm font-semibold mb-2">Version History</h2>
                <Link href={`/website/pages/${pageId}/history`}>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    View History
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Delete block confirmation ────────────────────────────────────── */}
      <AlertDialog open={!!deletingBlockId} onOpenChange={(o) => !o && setDeletingBlockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete block?</AlertDialogTitle>
            <AlertDialogDescription>
              This block and all its content will be removed. You can undo by discarding changes before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingBlockId && deleteBlock(deletingBlockId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
