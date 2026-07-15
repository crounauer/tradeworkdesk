"use client";

import type { ComponentType, ReactElement } from "react";
import type { SiteBlock, SiteData, SitePage } from "@/lib/api";
import HeroBlock from "./HeroBlock";
import TextBlock from "./TextBlock";
import ImageBlock from "./ImageBlock";
import CtaBlock from "./CtaBlock";
import ServicesBlock from "./ServicesBlock";
import ServiceRatesBlock from "./ServiceRatesBlock";
import ContactFormBlock from "./ContactFormBlock";
import TestimonialsBlock from "./TestimonialsBlock";
import GalleryBlock from "./GalleryBlock";
import AccreditationsBlock from "./AccreditationsBlock";
import SpacerBlock from "./SpacerBlock";
import WhyChooseUsBlock from "./WhyChooseUsBlock";
import FaqBlock from "./FaqBlock";
import AreasBlock from "./AreasBlock";
import BrandsBlock from "./BrandsBlock";
import FeaturesBarBlock from "./FeaturesBarBlock";
import ProcessBlock from "./ProcessBlock";
import ProjectShowcaseBlock from "./ProjectShowcaseBlock";
import OnlineBookingBlock from "./OnlineBookingBlock";
import StickyMobileCtaBlock from "./StickyMobileCtaBlock";
import BlogIndexBlock from "./BlogIndexBlock";
import BlogPostBlock from "./BlogPostBlock";
import LegalContentBlock from "./LegalContentBlock";
import FeatureCardsBlock from "./FeatureCardsBlock";
import DetailSectionBlock from "./DetailSectionBlock";
import AmazonBlock from "./AmazonBlock";
import { hasBlockRendererForType, isSkippableBlockType, normalizeBlockType } from "./block-registry";
import { resolveSiteTheme } from "@/lib/siteTheme";

interface Props {
  block: SiteBlock;
  websiteId: string;
  /** Site-level theme — values here are used as fallbacks when the block
   *  doesn't define its own accent_color / background_color etc. */
  theme?: Record<string, string>;
  /** Tenant ID — injected into blocks that need it (e.g. online_booking) */
  tenantId?: string;
  /** Company contact fallback values */
  companyContact?: { phone?: string | null; email?: string | null };
  site?: SiteData;
  page?: SitePage;
  showFallback?: boolean;
}

type BlockRenderContext = {
  content: Record<string, unknown>;
  site?: SiteData;
  page?: SitePage;
};

function buildLocalPlumbingFallback(
  blockType: string,
  pageSlug: string | undefined,
  phone: string | undefined,
  email: string | undefined,
): Record<string, unknown> | null {
  const cityText = "Reading and the surrounding area";

  switch (blockType) {
    case "hero":
    case "hero_split":
      return {
        title: "Reliable Local Plumbing Services",
        subtitle: `Honest, fast and fully insured plumbers serving ${cityText}. Free quotes, 12-month guarantee.`,
        primaryCtaLabel: phone ? `Call Now: ${phone}` : "Call Now",
        primaryCtaHref: phone ? `tel:${phone.replace(/\s+/g, "")}` : "#contact",
        secondaryCtaLabel: "Request a Quote",
        secondaryCtaHref: "#contact",
        background_image_url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1400&h=700&fit=crop&auto=format",
        overlay_color: "15,31,61",
        overlay_opacity: 0.75,
        heading_color: "#ffffff",
        subheading_color: "rgba(255,255,255,0.8)",
        primary_button_bg_color: "#00a8a8",
        primary_button_text_color: "#ffffff",
        primary_button_border_color: "rgba(26, 58, 107, 0.12)",
        secondary_button_bg_color: "#ffffff",
        secondary_button_text_color: "#1a3a6b",
        secondary_button_border_color: "rgba(26, 58, 107, 0.12)",
        border_radius: "10px",
        cta_font_size: "18px",
        cta_line_height: "28px",
        primary_button_padding: "14px 24px",
        secondary_button_padding: "14px 24px",
        heading_font_size: "48px",
        heading_line_height: "60px",
      };
    case "features_bar":
      return {
        heading: "",
        section_bg: "#f0f4f9",
        card_bg: "#f0f4f9",
        heading_color: "#1a3a6b",
        text_color: "#1a3a6b",
        accent_color: "#00a8a8",
        border_color: "rgba(26, 58, 107, 0.12)",
        features: [
          { title: "Fully Insured", icon: "✓" },
          { title: "Local Engineers", icon: "✓" },
          { title: "2-Hour Emergency", icon: "✓" },
          { title: "Free Quotes", icon: "✓" },
        ],
      };
    case "services":
    case "services_grid":
      return {
        heading: "Plumbing Services We Cover",
        label: "What We Do",
        subheading: "From emergency call-outs to planned installations, delivered by trusted local professionals.",
        section_bg: "#ffffff",
        card_bg: "#ffffff",
        heading_color: "#1a3a6b",
        body_color: "#5a6a7e",
        border_color: "rgba(26, 58, 107, 0.12)",
        accent_color: "#00a8a8",
        services: [
          { title: "Emergency Plumbing", description: "Urgent leaks, burst pipes and no-water faults resolved quickly.", href: "/services" },
          { title: "Boiler Repairs", description: "Fast diagnostics and repairs for boiler and heating issues.", href: "/services" },
          { title: "Bathroom Plumbing", description: "Installations, upgrades and fixes for baths, showers and toilets.", href: "/services" },
        ],
      };
    case "service_rates":
      return {
        eyebrow: "Rates",
        title: "Typical Service Rates",
        subtitle: "Clear starting prices for common plumbing jobs.",
        variation: "cards",
        note: "Final quote depends on access, complexity and parts required.",
        rates: [],
      };
    case "process":
    case "how_it_works":
    case "steps":
      return {
        label: "How It Works",
        heading: "Our Simple 4-Step Process",
        section_bg: "#ffffff",
        heading_color: "#1a3a6b",
        body_color: "#5a6a7e",
        border_color: "rgba(26, 58, 107, 0.12)",
        accent_color: "#00a8a8",
        steps: [
          { title: "Call or Book Online", description: "Tell us what you need and choose your preferred contact method." },
          { title: "Rapid Assessment", description: "We assess the issue and provide clear, upfront guidance." },
          { title: "Expert Work", description: "Qualified engineers complete the work safely and efficiently." },
          { title: "Aftercare", description: "We confirm everything is working and share aftercare advice." },
        ],
      };
    case "testimonials":
    case "reviews":
      return {
        label: "Reviews",
        heading: "What Our Customers Say",
        section_bg: "#f0f4f9",
        card_bg: "#ffffff",
        heading_color: "#1a3a6b",
        body_color: "#5a6a7e",
        border_color: "rgba(26, 58, 107, 0.12)",
        star_color: "#f59e0b",
        testimonials: [
          { author_name: "Sarah M.", location: "Reading", rating: 5, body: "Fast response, tidy work and very fair pricing." },
          { author_name: "James T.", location: "Caversham", rating: 5, body: "Excellent communication and the issue was fixed first visit." },
          { author_name: "Priya L.", location: "Tilehurst", rating: 5, body: "Professional team, great advice and no hidden costs." },
        ],
      };
    case "trust_badges":
    case "accreditations":
      return {
        heading: "",
        section_bg: "#f0f4f9",
        card_bg: "#f0f4f9",
        text_color: "#1a3a6b",
        border_color: "rgba(26, 58, 107, 0.12)",
        badges: [
          { name: "Fully Insured" },
          { name: "Local Engineers" },
          { name: "Fast Response" },
          { name: "Free Quotes" },
        ],
      };
    case "cta":
    case "cta_band":
      return {
        heading: "Need Plumbing Help Today?",
        subheading: "Call now for fast local support or request a free quote online.",
        cta_text: phone ? `Call Now: ${phone}` : "Call Now",
        cta_url: phone ? `tel:${phone.replace(/\s+/g, "")}` : "#contact",
        secondaryCtaLabel: "Request a Quote",
        secondary_cta_url: "#contact",
        background_color: "#1a3a6b",
        text_color: "#ffffff",
        primary_color: "#00a8a8",
        primary_text_color: "#ffffff",
        border_color: "rgba(255,255,255,0.3)",
      };
    case "contact":
    case "contact_form":
      return {
        heading: "Request a Quote",
        subheading: "Tell us a few details and we will get back to you quickly.",
        email,
        phone,
      };
    default:
      return null;
  }
}

type BlockRendererFn = (context: BlockRenderContext) => ReactElement | null;

function render(
  Component: ComponentType<{ content: Record<string, unknown> }>,
  context: BlockRenderContext,
): ReactElement | null {
  const BlockComponent = Component as ComponentType<{ content: Record<string, unknown> }>;
  return <BlockComponent content={context.content} />;
}

function renderGallery(context: BlockRenderContext): ReactElement | null {
  const existingImages = Array.isArray(context.content.images)
    ? (context.content.images as Array<Record<string, unknown>>)
    : [];

  const siteGallery = (context.site?.gallery || []).map((item) => ({
    url: item.image_url,
    alt: item.alt_text || undefined,
    caption: item.caption || undefined,
  }));

  const content = existingImages.length > 0
    ? context.content
    : { ...context.content, images: siteGallery };

  return <GalleryBlock content={content} />;
}

function renderBlogIndex(context: BlockRenderContext): ReactElement | null {
  return <BlogIndexBlock content={context.content} site={context.site} />;
}

function renderBlogPost(context: BlockRenderContext): ReactElement | null {
  return <BlogPostBlock content={context.content} site={context.site} page={context.page} />;
}

function renderLegalContent(context: BlockRenderContext): ReactElement | null {
  return <LegalContentBlock content={context.content} />;
}

function renderFeatureCards(context: BlockRenderContext): ReactElement | null {
  return <FeatureCardsBlock content={context.content} />;
}

function renderDetailSection(context: BlockRenderContext): ReactElement | null {
  return <DetailSectionBlock content={context.content} />;
}

const blockRegistry: Record<string, BlockRendererFn> = {
  hero: (context) => render(HeroBlock, context),
  hero_split: (context) => render(HeroBlock, context),
  text: (context) => render(TextBlock, context),
  rich_text: (context) => render(TextBlock, context),
  text_section: (context) => render(TextBlock, context),
  image: (context) => render(ImageBlock, context),
  cta: (context) => render(CtaBlock, context),
  cta_band: (context) => render(CtaBlock, context),
  services: (context) => render(ServicesBlock, context),
  services_grid: (context) => render(ServicesBlock, context),
  service_rates: (context) => render(ServiceRatesBlock, context),
  service_detail: renderDetailSection,
  contact_form: (context) => render(ContactFormBlock, context),
  contact: (context) => render(ContactFormBlock, context),
  testimonials: (context) => render(TestimonialsBlock, context),
  reviews: (context) => render(TestimonialsBlock, context),
  gallery: renderGallery,
  accreditations: (context) => render(AccreditationsBlock, context),
  trust_badges: (context) => render(AccreditationsBlock, context),
  spacer: (context) => render(SpacerBlock, context),
  why_choose_us: (context) => render(WhyChooseUsBlock, context),
  faq: (context) => render(FaqBlock, context),
  areas: (context) => render(AreasBlock, context),
  areas_grid: (context) => render(AreasBlock, context),
  area_detail_hero: renderDetailSection,
  brands: (context) => render(BrandsBlock, context),
  partners: (context) => render(BrandsBlock, context),
  features_bar: (context) => render(FeaturesBarBlock, context),
  feature_cards: renderFeatureCards,
  process: (context) => render(ProcessBlock, context),
  steps: (context) => render(ProcessBlock, context),
  how_it_works: (context) => render(ProcessBlock, context),
  project_showcase: (context) => render(ProjectShowcaseBlock, context),
  case_study: (context) => render(ProjectShowcaseBlock, context),
  projects: (context) => render(ProjectShowcaseBlock, context),
  online_booking: (context) => render(OnlineBookingBlock, context),
  booking: (context) => render(OnlineBookingBlock, context),
  sticky_mobile_cta: (context) => render(StickyMobileCtaBlock, context),
  blog_index: renderBlogIndex,
  blog_post: renderBlogPost,
  legal_content: renderLegalContent,
  amazon: (context) => render(AmazonBlock, context),
  amazon_products: (context) => render(AmazonBlock, context),
  amazon_affiliates: (context) => render(AmazonBlock, context),
};

function UnsupportedBlock({ blockType, showFallback }: { blockType: string; showFallback?: boolean }) {
  if (!showFallback) return null;

  return (
    <section style={{ padding: "32px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", background: "#fffaf3", color: "#92400e" }}>
        <strong>Unsupported block type:</strong> {blockType}
      </div>
    </section>
  );
}

export default function BlockRenderer({ block, websiteId, theme, tenantId, companyContact, site, page, showFallback }: Props) {
  if (isSkippableBlockType(block.block_type)) {
    return null;
  }

  const normalizedType = normalizeBlockType(block.block_type);
  if ((normalizedType === "online_booking" || normalizedType === "booking") && site?.booking?.is_enabled === false) {
    return null;
  }

  const normalizedTheme = resolveSiteTheme(theme, site?.website?.template_slug);
  const themeObj = (theme && typeof theme === "object") ? theme as Record<string, unknown> : {};
  const globalHeadingFont = typeof themeObj.heading_font_family === "string" ? themeObj.heading_font_family : undefined;
  const globalBodyFont = typeof themeObj.body_font_family === "string" ? themeObj.body_font_family : undefined;
  const globalButtonFont = typeof themeObj.button_font_family === "string" ? themeObj.button_font_family : undefined;
  const base = {
    accent_color: normalizedTheme.accentColor,
    primary_color: normalizedTheme.primaryColor,
    primary_text_color: normalizedTheme.primaryTextColor,
    background_color: normalizedTheme.backgroundColor,
    muted_background_color: normalizedTheme.mutedBackgroundColor,
    border_color: normalizedTheme.borderColor,
    text_color: normalizedTheme.textColor,
    muted_text_color: normalizedTheme.mutedTextColor,
    global_heading_font_family: globalHeadingFont,
    global_body_font_family: globalBodyFont,
    global_button_font_family: globalButtonFont,
    template_slug: site?.website?.template_slug || undefined,
  };
  const companyBase = {
    phone: companyContact?.phone ?? undefined,
    email: companyContact?.email ?? undefined,
  };
  const tenantOverride = tenantId ? { tenant_id: tenantId } : {};
  const websiteOverride = websiteId ? { website_id: websiteId } : {};
  const rawContent = (block.content as Record<string, unknown>) || {};
  const templateSlug = String(site?.website?.template_slug || "").toLowerCase();
  const hasMeaningfulContent = Object.keys(rawContent).length > 0;

  const fallbackContent =
    templateSlug === "local-plumbing-pro" && !hasMeaningfulContent
      ? buildLocalPlumbingFallback(normalizedType, page?.slug, companyContact?.phone ?? undefined, companyContact?.email ?? undefined)
      : null;

  const content = {
    ...base,
    ...companyBase,
    ...tenantOverride,
    ...websiteOverride,
    ...(fallbackContent || {}),
    ...rawContent,
    ...(templateSlug === "local-plumbing-pro" && normalizedType === "hero"
      ? {
          trust_items:
            Array.isArray(rawContent.trust_items) && rawContent.trust_items.length > 0
              ? rawContent.trust_items
              : [
                  { text: "Fully Insured", icon: "🛡" },
                  { text: "Local Engineers", icon: "📍" },
                  { text: "Fast Response", icon: "⚡" },
                  { text: "Free Quotes", icon: "✓" },
                ],
        }
      : {}),
    ...(templateSlug === "local-plumbing-pro" && normalizedType === "features_bar"
      ? {
          heading: typeof rawContent.heading === "string" ? rawContent.heading : "",
          subheading: typeof rawContent.subheading === "string" ? rawContent.subheading : "",
          label: typeof rawContent.label === "string" ? rawContent.label : "",
          layout_variant:
            typeof rawContent.layout_variant === "string"
              ? rawContent.layout_variant
              : (typeof rawContent.layout === "string" ? rawContent.layout : "local-strip"),
          section_bg: typeof rawContent.section_bg === "string" ? rawContent.section_bg : "#eef3f8",
          card_bg: typeof rawContent.card_bg === "string" ? rawContent.card_bg : "#eef3f8",
          heading_color: typeof rawContent.heading_color === "string" ? rawContent.heading_color : "#1a3a6b",
          text_color: typeof rawContent.text_color === "string" ? rawContent.text_color : "#1a3a6b",
          accent_color: typeof rawContent.accent_color === "string" ? rawContent.accent_color : "#00a8a8",
          border_color: typeof rawContent.border_color === "string" ? rawContent.border_color : "rgba(26, 58, 107, 0.14)",
          features:
            Array.isArray(rawContent.features) && rawContent.features.length > 0
              ? rawContent.features
              : (Array.isArray(rawContent.items) && rawContent.items.length > 0
                ? rawContent.items
              : [
                  { title: "Fully Insured", icon: "🛡" },
                  { title: "Local Engineers", icon: "📍" },
                  { title: "2-Hour Emergency", icon: "⚡" },
                  { title: "Free Quotes", icon: "✓" },
                  { title: "12-Month Guarantee", icon: "◎" },
                  { title: "Mon-Sat 7am-8pm", icon: "◷" },
                ]),
        }
      : {}),
    ...(normalizedType === "service_rates" && Array.isArray(site?.service_catalogue) && site.service_catalogue.length > 0
      ? {
          rates: site.service_catalogue.map((service) => {
            const defaultPrice = typeof service.default_price === "number"
              ? `From £${service.default_price.toFixed(0)}`
              : "Price on request";
            const durationMinutes = typeof service.booking_duration_minutes === "number" && service.booking_duration_minutes > 0
              ? `${service.booking_duration_minutes} min`
              : undefined;

            return {
              service: service.name,
              price: service.website_service_price_text || defaultPrice,
              description: service.website_service_description || undefined,
              duration: durationMinutes,
              badge: service.website_service_badge || undefined,
              cta_text: service.website_service_cta_text || undefined,
              cta_url: service.website_service_cta_url || undefined,
            };
          }),
        }
      : {}),
  };
  const renderer = blockRegistry[normalizedType];

  if (!renderer) {
    return <UnsupportedBlock blockType={block.block_type} showFallback={showFallback} />;
  }

  return renderer({ content, site, page });
}
