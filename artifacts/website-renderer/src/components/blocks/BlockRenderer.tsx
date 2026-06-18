/**
 * BlockRenderer: routes each block_type to its React component.
 *
 * Block types supported:
 *   hero        — full-width hero with heading, sub, CTA
 *   text        — rich text / HTML content
 *   image       — single image with optional caption
 *   gallery     — grid of images
 *   testimonials — testimonial slider/grid
 *   contact_form — embedded contact form
 *   cta         — call-to-action banner
 *   services    — service cards list
 *   accreditations — logos/badges row
 *   map         — embedded map (iframe or static)
 *   why_choose_us — feature columns (icon/title/desc), coloured bg
 *   faq         — accordion FAQ list
 *   areas       — areas covered tag pills + text
 *   brands      — brand/partner logo bar
 *   spacer      — vertical spacer
 *   html        — raw HTML embed (sanitised)
 */
"use client";

import type { SiteBlock } from "@/lib/api";
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

interface Props {
  block: SiteBlock;
  /** Site-level theme — values here are used as fallbacks when the block
   *  doesn't define its own accent_color / background_color etc. */
  theme?: Record<string, string>;
}

export default function BlockRenderer({ block, theme }: Props) {
  // Merge site theme as low-priority defaults so per-block overrides still win.
  const siteAccent = theme?.accent_color;
  const base = siteAccent ? { accent_color: siteAccent } : {};
  const content = { ...base, ...(block.content as Record<string, unknown>) };

  switch (block.block_type) {
    case "hero":
      return <HeroBlock content={content} />;
    case "text":
    case "rich_text":
      return <TextBlock content={content} />;
    case "image":
      return <ImageBlock content={content} />;
    case "cta":
      return <CtaBlock content={content} />;
    case "services":
      return <ServicesBlock content={content} />;
    case "contact_form":
      return <ContactFormBlock content={content} />;
    case "testimonials":
      return <TestimonialsBlock content={content} />;
    case "gallery":
      return <GalleryBlock content={content} />;
    case "accreditations":
      return <AccreditationsBlock content={content} />;
    case "spacer":
      return <SpacerBlock content={content} />;
    case "why_choose_us":
    case "features":
      return <WhyChooseUsBlock content={content} />;
    case "faq":
    case "accordion":
      return <FaqBlock content={content} />;
    case "areas":
      return <AreasBlock content={content} />;
    case "brands":
    case "partners":
      return <BrandsBlock content={content} />;
    case "features_bar":
      return <FeaturesBarBlock content={content} />;
    case "process":
    case "steps":
    case "how_it_works":
      return <ProcessBlock content={content} />;
    case "project_showcase":
    case "case_study":
      return <ProjectShowcaseBlock content={content} />;
    default:
      return null;
  }
}
