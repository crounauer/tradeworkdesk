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

interface Props {
  block: SiteBlock;
}

export default function BlockRenderer({ block }: Props) {
  const content = block.content as Record<string, unknown>;

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
    default:
      return null;
  }
}
