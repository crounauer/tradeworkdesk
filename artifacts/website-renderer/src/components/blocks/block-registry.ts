const blockTypeAliases: Record<string, string> = {
  trust_bar: "trust_badges",
  benefits_grid: "feature_cards",
  accreditation_logos: "accreditations",
  process_steps: "process",
  reviews_carousel: "reviews",
  cta_banner: "cta_band",
  blog_cards: "blog_index",
  footer_cta: "cta_band",
};

export function normalizeBlockType(blockType: string): string {
  const normalized = blockType.trim().toLowerCase();
  return blockTypeAliases[normalized] || normalized;
}

const supportedBlockTypes = new Set([
  "hero",
  "hero_split",
  "text",
  "rich_text",
  "text_section",
  "image",
  "cta",
  "cta_band",
  "services",
  "services_grid",
  "service_detail",
  "contact_form",
  "contact",
  "testimonials",
  "reviews",
  "gallery",
  "accreditations",
  "trust_badges",
  "spacer",
  "why_choose_us",
  "faq",
  "areas",
  "areas_grid",
  "area_detail_hero",
  "brands",
  "partners",
  "features_bar",
  "feature_cards",
  "process",
  "steps",
  "how_it_works",
  "project_showcase",
  "case_study",
  "projects",
  "online_booking",
  "booking",
  "blog_index",
  "blog_post",
  "legal_content",
]);

export function hasBlockRendererForType(blockType: string): boolean {
  return supportedBlockTypes.has(normalizeBlockType(blockType));
}
