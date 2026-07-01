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
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Eye, EyeOff, Globe, Save, Loader2, ChevronRight,
  Type, Image, Layout, MessageSquare, Star, Grid3X3,
  Phone, Award, Minus, Undo2, CalendarCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BlockType =
  | "hero"
  | "text"
  | "image"
  | "cta"
  | "services"
  | "contact"
  | "contact_form"
  | "testimonials"
  | "gallery"
  | "accreditations"
  | "features_bar"
  | "faq"
  | "process"
  | "areas"
  | "project_showcase"
  | "spacer"
  | "online_booking";

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
  canonical_url: string | null;
  no_index: boolean;
  show_in_nav: boolean;
  nav_label: string | null;
  nav_order: number;
  blocks: Block[];
}

// ---------------------------------------------------------------------------
// Block palette config
// ---------------------------------------------------------------------------

const BLOCK_PALETTE: { type: BlockType; label: string; icon: React.ComponentType<{ className?: string }>; description: string; defaultContent: Record<string, unknown> }[] = [
  {
    type: "hero",
    label: "Hero Banner",
    icon: Layout,
    description: "Full-width hero section with heading, subheading and CTA button",
    defaultContent: {
      eyebrow: "",
      heading: "Your Heading Here",
      subheading: "A short description of your services or offer.",
      cta_text: "Get a Free Quote",
      cta_url: "/contact",
      background_color: "#1e40af",
      text_color: "#ffffff",
      align: "center",
    },
  },
  {
    type: "text",
    label: "Text Block",
    icon: Type,
    description: "Heading and rich text paragraph",
    defaultContent: {
      heading: "",
      body: "Add your content here.",
      align: "left",
    },
  },
  {
    type: "services",
    label: "Services Grid",
    icon: Grid3X3,
    description: "Grid of service cards with icon, title and description",
    defaultContent: {
      heading: "Our Services",
      items: [
        { title: "Boiler Servicing", description: "Annual service to keep your boiler running safely and efficiently.", icon: "🔥" },
        { title: "Boiler Repair", description: "Fast response to breakdowns — most repairs completed same day.", icon: "🔧" },
        { title: "Installation", description: "New boiler supply and installation with full commissioning.", icon: "⚙️" },
      ],
    },
  },
  {
    type: "cta",
    label: "Call to Action",
    icon: Phone,
    description: "Prominent CTA strip with heading and button",
    defaultContent: {
      heading: "Ready to book?",
      subheading: "Call us today or fill in our online form.",
      button_text: "Get a Free Quote",
      button_url: "/contact",
      background_color: "#f97316",
      text_color: "#ffffff",
    },
  },
  {
    type: "testimonials",
    label: "Testimonials",
    icon: Star,
    description: "Customer reviews and testimonials",
    defaultContent: {
      heading: "What Our Customers Say",
      show_rating: true,
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
    type: "spacer",
    label: "Spacer",
    icon: Minus,
    description: "Vertical spacing between sections",
    defaultContent: { height: "md" },
  },
];

const TEMPLATE_BLOCK_TYPE_ALIASES: Record<string, string> = {
  "hero.standard": "hero",
  "about.intro": "text",
  "trust.badges": "trust_badges",
  "services.grid": "services_grid",
  "reviews.grid": "reviews",
  "areas.grid": "areas_grid",
  "gallery.grid": "gallery",
  "cta.banner": "cta_band",
  "contact.split": "contact",
  "faq.accordion": "faq",
  "process.steps": "process",
  "features.list": "feature_cards",
  "blog.index": "blog_index",
  "legal.content": "legal_content",
};

const TEMPLATE_SKIPPED_BLOCK_TYPES = new Set(["site.header", "site.footer"]);

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
    "hero",
    "text",
    "image",
    "cta",
    "services",
    "contact",
    "contact_form",
    "testimonials",
    "gallery",
    "accreditations",
    "features_bar",
    "faq",
    "process",
    "areas",
    "project_showcase",
    "spacer",
    "online_booking",
  ];

  if (known.includes(t as BlockType)) return t as BlockType;

  if (t.includes("hero")) return "hero";
  if (t.includes("text") || t.includes("intro")) return "text";
  if (t.includes("image")) return "image";
  if (t.includes("cta") || t.includes("call_to_action")) return "cta";
  if (t.includes("service")) return "services";
  if (t === "contact" || t.includes("contact.split") || t.includes("map_opening_hours")) return "contact";
  if (t.includes("contact") && t.includes("form")) return "contact_form";
  if (t.includes("review") || t.includes("testimonial")) return "testimonials";
  if (t.includes("gallery")) return "gallery";
  if (t.includes("accredit") || t.includes("trust_badge") || t.includes("badge")) return "accreditations";
  if (t.includes("feature") || t.includes("benefit") || t.includes("team")) return "features_bar";
  if (t.includes("faq")) return "faq";
  if (t.includes("process") || t.includes("how_it_works")) return "process";
  if (t.includes("area")) return "areas";
  if (t.includes("project") || t.includes("case_study")) return "project_showcase";
  if (t.includes("booking")) return "online_booking";
  if (t.includes("spacer")) return "spacer";

  return "generic";
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (content: Record<string, unknown>) => void }) {
  const c = block.content;
  const editorType = resolveEditorType(block.block_type);

  const set = (key: string, value: unknown) => onChange({ ...c, [key]: value });

  switch (editorType) {
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
      const backgroundColor = readString(c, ["background_color", "backgroundColor"], "#1e40af");
      const textColor = readString(c, ["text_color", "textColor"], "#ffffff");

      return (
        <div className="space-y-3">
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
          <FieldRow label="Alignment">
            <Select value={String(c.align ?? "center")} onValueChange={(v) => set("align", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
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
      const backgroundColor = readString(c, ["background_color", "backgroundColor"], "#f97316");
      const textColor = readString(c, ["text_color", "textColor"], "#ffffff");

      return (
        <div className="space-y-3">
          <FieldRow label="Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading"><Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
          <FieldRow label="Button Text"><Input value={buttonText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
          <FieldRow label="Button URL"><Input value={buttonUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
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
        </div>
      );
    }

    case "services": {
      const serviceFieldKey = Array.isArray(c.items) ? "items" : "services";
      const items = readArray<{ title: string; description: string; icon: string }>(c, ["services", "items"]);
      const updateItems = (next: Array<{ title: string; description: string; icon: string }>) => {
        if (serviceFieldKey === "items") {
          onChange({ ...c, items: next, services: next });
          return;
        }
        onChange({ ...c, services: next, items: next });
      };
      const heading = readString(c, ["heading", "title"]);
      const subtitle = readString(c, ["subtitle", "subheading"]);
      const label = readString(c, ["label", "eyebrow"]);
      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading"><Textarea value={subtitle} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} rows={2} /></FieldRow>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Service Items</Label>
            {items.map((item, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={item.icon} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], icon: e.target.value }; updateItems(n); }} placeholder="🔥" className="w-16 text-center" />
                  <Input value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; updateItems(n); }} placeholder="Service name" className="flex-1" />
                  <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => updateItems(items.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Textarea value={item.description} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; updateItems(n); }} placeholder="Short description..." rows={2} />
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => updateItems([...items, { title: "", description: "", icon: "⚙️" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Service
            </Button>
          </div>
        </div>
      );
    }

    case "contact":
      return (
        <div className="space-y-3">
          <FieldRow label="Small heading (optional)">
            <Input value={String(c.eyebrow ?? "")} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Contact" />
          </FieldRow>
          <FieldRow label="Main title">
            <Input value={String(c.title ?? c.heading ?? "")} onChange={(e) => onChange({ ...c, title: e.target.value, heading: e.target.value })} placeholder="Request a quote or ask a question" />
          </FieldRow>
          <FieldRow label="Intro text">
            <Textarea value={String(c.subtitle ?? c.subheading ?? "")} onChange={(e) => onChange({ ...c, subtitle: e.target.value, subheading: e.target.value })} rows={2} placeholder="Tell customers what happens after they contact you." />
          </FieldRow>
          <FieldRow label="Phone number">
            <Input value={String(c.phone ?? "")} onChange={(e) => set("phone", e.target.value)} placeholder="01224 000000" />
          </FieldRow>
          <FieldRow label="Email address">
            <Input value={String(c.email ?? "")} onChange={(e) => set("email", e.target.value)} placeholder="hello@yourbusiness.co.uk" />
          </FieldRow>
          <FieldRow label="Address">
            <Input value={String(c.address ?? "")} onChange={(e) => set("address", e.target.value)} placeholder="Aberdeenshire, Scotland" />
          </FieldRow>
          <FieldRow label="Opening hours">
            <Input value={String(c.openingHours ?? c.hours ?? "")} onChange={(e) => onChange({ ...c, openingHours: e.target.value, hours: e.target.value })} placeholder="Monday to Friday, 8am to 5pm" />
          </FieldRow>
          <p className="text-xs text-muted-foreground">
            Tip: this block now uses simple fields. You usually do not need to edit JSON.
          </p>
        </div>
      );

    case "testimonials": {
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);

      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading (optional)"><Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
          <p className="text-xs text-muted-foreground">Testimonials are pulled from your website testimonials database. Add them via the Testimonials section.</p>
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

      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading (optional)"><Input value={subtitle} onChange={(e) => onChange(syncBlockContent(c, { subtitle: e.target.value, subheading: e.target.value }, { subtitle: ["subheading"], subheading: ["subtitle"] }))} /></FieldRow>
          <FieldRow label="Columns">
            <Select value={String(c.columns ?? "3")} onValueChange={(v) => set("columns", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 columns</SelectItem>
                <SelectItem value="3">3 columns</SelectItem>
                <SelectItem value="4">4 columns</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <p className="text-xs text-muted-foreground">Gallery images are pulled from your website gallery. Add them via the Gallery section.</p>
        </div>
      );
    }

    case "accreditations": {
      type BadgeItem = { name: string; logo_url: string; description?: string; number?: string };
      const isTrustBadges = String(block.block_type || "").toLowerCase().includes("trust_badge");
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
      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
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
      );
    }

    case "image":
      return (
        <div className="space-y-3">
          <ImagePickerField
            label="Image"
            value={String(c.image_url ?? "")}
            onChange={(url) => set("image_url", url)}
            hint="Recommended: 1200 × 800 px or wider. Will be displayed full-width or normal width."
            fieldName="image"
          />
          <FieldRow label="Alt Text"><Input value={String(c.alt_text ?? "")} onChange={(e) => set("alt_text", e.target.value)} placeholder="Describe the image for accessibility" /></FieldRow>
          <FieldRow label="Caption (optional)"><Input value={String(c.caption ?? "")} onChange={(e) => set("caption", e.target.value)} /></FieldRow>
          <FieldRow label="Width">
            <Select value={String(c.width ?? "full")} onValueChange={(v) => set("width", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full width</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      );

    case "spacer":
      return (
        <FieldRow label="Height">
          <Select value={String(c.height ?? "md")} onValueChange={(v) => set("height", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small (1rem)</SelectItem>
              <SelectItem value="md">Medium (2rem)</SelectItem>
              <SelectItem value="lg">Large (4rem)</SelectItem>
              <SelectItem value="xl">Extra Large (6rem)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      );

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
      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          <div className="flex gap-3">
            <FieldRow label="Background Colour">
              <div className="flex items-center gap-2">
                <input type="color" value={String(c.background_color ?? "#0d9488")} onChange={(e) => set("background_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                <Input value={String(c.background_color ?? "")} onChange={(e) => set("background_color", e.target.value)} className="flex-1" />
              </div>
            </FieldRow>
            <FieldRow label="Text Colour">
              <div className="flex items-center gap-2">
                <input type="color" value={String(c.text_color ?? "#ffffff")} onChange={(e) => set("text_color", e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
                <Input value={String(c.text_color ?? "")} onChange={(e) => set("text_color", e.target.value)} className="flex-1" />
              </div>
            </FieldRow>
          </div>
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
      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading (optional)"><Input value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} /></FieldRow>
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
      );
    }

    case "process": {
      const steps = Array.isArray(c.steps) ? c.steps as Array<{ icon: string; title: string; description: string }> : [];
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);
      const ctaText = readString(c, ["cta_text", "primaryCtaLabel", "primaryButtonText"]);
      const ctaUrl = readString(c, ["cta_url", "primaryCtaHref", "primaryButtonUrl"]);

      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          <FieldRow label="CTA Button Text"><Input value={ctaText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
          <FieldRow label="CTA Button URL"><Input value={ctaUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Steps</Label>
            {steps.map((step, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={step.icon} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], icon: e.target.value }; set("steps", n); }} placeholder="🔍" className="w-16 text-center" />
                  <Input value={step.title} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], title: e.target.value }; set("steps", n); }} placeholder="Step title" className="flex-1" />
                  <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive" onClick={() => set("steps", steps.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Textarea value={step.description} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], description: e.target.value }; set("steps", n); }} placeholder="Description..." rows={2} />
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => set("steps", [...steps, { icon: "✅", title: "", description: "" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
            </Button>
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

      const updateAreas = (next: Array<{ name: string; href: string }>) => {
        onChange({ ...c, areas: next });
      };

      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
          <FieldRow label="CTA Button Text"><Input value={ctaText} onChange={(e) => onChange(syncBlockContent(c, { cta_text: e.target.value, primaryCtaLabel: e.target.value, primaryButtonText: e.target.value }, { cta_text: ["primaryCtaLabel", "primaryButtonText"], primaryCtaLabel: ["cta_text", "primaryButtonText"], primaryButtonText: ["cta_text", "primaryCtaLabel"] }))} /></FieldRow>
          <FieldRow label="CTA Button URL"><Input value={ctaUrl} onChange={(e) => onChange(syncBlockContent(c, { cta_url: e.target.value, primaryCtaHref: e.target.value, primaryButtonUrl: e.target.value }, { cta_url: ["primaryCtaHref", "primaryButtonUrl"], primaryCtaHref: ["cta_url", "primaryButtonUrl"], primaryButtonUrl: ["cta_url", "primaryCtaHref"] }))} placeholder="/contact" /></FieldRow>
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
      );
    }

    case "project_showcase": {
      type ProjectItem = { title: string; location: string; image_url: string; description: string; cta_text: string; cta_url: string };
      const projects = Array.isArray(c.projects) ? c.projects as ProjectItem[] : [];
      const heading = readString(c, ["heading", "title"]);
      const subheading = readString(c, ["subheading", "subtitle"]);
      const label = readString(c, ["label", "eyebrow"]);

      return (
        <div className="space-y-3">
          <FieldRow label="Eyebrow / Label (optional)"><Input value={label} onChange={(e) => onChange(syncBlockContent(c, { label: e.target.value, eyebrow: e.target.value }, { label: ["eyebrow"], eyebrow: ["label"] }))} /></FieldRow>
          <FieldRow label="Section Heading"><Input value={heading} onChange={(e) => onChange(syncBlockContent(c, { heading: e.target.value, title: e.target.value }, { heading: ["title"], title: ["heading"] }))} /></FieldRow>
          <FieldRow label="Subheading (optional)"><Textarea value={subheading} onChange={(e) => onChange(syncBlockContent(c, { subheading: e.target.value, subtitle: e.target.value }, { subheading: ["subtitle"], subtitle: ["subheading"] }))} rows={2} /></FieldRow>
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
      );
    }

    case "online_booking": {
      return (
        <div className="space-y-3">
          <FieldRow label="Section Heading">
            <Input value={String(c.heading ?? "")} onChange={(e) => set("heading", e.target.value)} placeholder="Book an Appointment" />
          </FieldRow>
          <FieldRow label="Subheading">
            <Input value={String(c.subheading ?? "")} onChange={(e) => set("subheading", e.target.value)} placeholder="Choose a service and pick a time that suits you." />
          </FieldRow>
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
}: {
  block: Block;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onContentChange: (id: string, content: Record<string, unknown>) => void;
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

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
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
        no_index: page.no_index,
        show_in_nav: page.show_in_nav,
        nav_label: page.nav_label ?? "",
      });
      setIsDirty(false);
    }
  }, [page]);

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
                no_index: page.no_index,
                show_in_nav: page.show_in_nav,
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
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: Block palette ──────────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 border-r bg-muted/30 overflow-y-auto p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground px-1 pb-1">Add Block</p>
          {BLOCK_PALETTE.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => addBlock(item.type)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                title={item.description}
              >
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                <Plus className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
              </button>
            );
          })}
        </aside>

        {/* ── Centre: Block list ───────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 space-y-2">
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
              />
            ))
          )}
        </main>

        {/* ── Right: Page settings ─────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 border-l overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-3">Page Settings</h2>
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
