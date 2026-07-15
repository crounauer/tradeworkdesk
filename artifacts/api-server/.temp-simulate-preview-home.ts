import "dotenv/config";
import { supabaseAdmin } from "./src/lib/supabase";

const TEMPLATE_ID = "2864b804-9e05-4911-b26d-7a66c04fdc71";
const PREVIEW_DEFAULT_PAGE_BLOCKS: Record<string, string[]> = {
  home: ["site.header", "hero.standard", "trust.badges", "features.list", "services.grid", "process.steps", "testimonials", "cta.banner", "site.footer"],
  services: ["site.header", "hero.standard", "services.grid", "features.list", "faq.accordion", "cta.banner", "site.footer"],
  "service-detail": ["site.header", "hero.standard", "features.list", "process.steps", "cta.banner", "site.footer"],
  emergency: ["site.header", "hero.standard", "process.steps", "cta.banner", "site.footer"],
  areas: ["site.header", "hero.standard", "areas.grid", "contact.split", "site.footer"],
  reviews: ["site.header", "hero.standard", "reviews.grid", "testimonials", "trust.badges", "cta.banner", "site.footer"],
  gallery: ["site.header", "hero.standard", "gallery.grid", "gallery.grid", "cta.banner", "site.footer"],
  "blog-index": ["site.header", "hero.standard", "blog.index", "cta.banner", "site.footer"],
  "blog-post": ["site.header", "hero.standard", "legal.content", "cta.banner", "site.footer"],
  booking: ["site.header", "hero.standard", "contact.split", "cta.banner", "site.footer"],
  contact: ["site.header", "hero.standard", "contact.split", "trust.badges", "site.footer"],
  legal: ["site.header", "hero.standard", "legal.content", "faq.accordion", "site.footer"],
  "404": ["site.header", "hero.standard", "system.notFound", "cta.banner", "site.footer"],
};

async function main() {
  const { data: template } = await supabaseAdmin.from("website_templates").select("*").eq("id", TEMPLATE_ID).maybeSingle();
  if (!template) throw new Error("template not found");

  const { data: conversion } = await supabaseAdmin
    .from("template_conversions").select("block_mapping_report")
    .eq("template_slug", template.slug).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const mapping = (conversion?.block_mapping_report as any) || {};
  const mappedPages = Array.isArray(mapping.pages) ? mapping.pages as string[] : [];
  const mappedCounts = mapping.blocksPerPage && typeof mapping.blocksPerPage === "object" ? mapping.blocksPerPage as Record<string, number> : {};
  const mappedPageBlockProps = mapping.pageBlockProps && typeof mapping.pageBlockProps === "object" ? mapping.pageBlockProps as Record<string, Record<string, any>> : {};

  const demoPages = mappedPages.map((slug) => {
    const rawKeys = Object.keys(mappedPageBlockProps?.[slug] || {});
    const preferredOrder = PREVIEW_DEFAULT_PAGE_BLOCKS[slug] || [];
    const orderedKeys = preferredOrder.length > 0
      ? [...preferredOrder.filter((type) => rawKeys.includes(type)), ...rawKeys.filter((type) => !preferredOrder.includes(type))]
      : rawKeys;
    return {
      slug,
      block_count: Number(mappedCounts[slug] || 0),
      block_types: orderedKeys,
    };
  });

  const home = demoPages.find((p) => p.slug === "home");
  if (!home) throw new Error("no home page");
  console.log("home block_types order:", home.block_types);

  const pageBlockProps = mappedPageBlockProps;
  const blocks = (home.block_types as string[]).map((type) => ({ type, props: pageBlockProps.home?.[type] || null }));
  for (const b of blocks.slice(0, 4)) {
    console.log("\n", b.type, JSON.stringify(b.props, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
