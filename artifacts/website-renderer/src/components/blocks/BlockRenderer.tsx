"use client";

import type { ComponentType, ReactElement } from "react";
import type { SiteBlock, SiteData, SitePage } from "@/lib/api";
import HeroBlock from "./HeroBlock";
import TextBlock from "./TextBlock";
import ImageBlock from "./ImageBlock";
import CtaBlock from "./CtaBlock";
import ServicesBlock from "./ServicesBlock";
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
  const content = { ...base, ...companyBase, ...tenantOverride, ...websiteOverride, ...(block.content as Record<string, unknown>) };
  const normalizedType = normalizeBlockType(block.block_type);
  const renderer = blockRegistry[normalizedType];

  if (!renderer) {
    return <UnsupportedBlock blockType={block.block_type} showFallback={showFallback} />;
  }

  return renderer({ content, site, page });
}
