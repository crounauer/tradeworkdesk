const blockTypeAliases: Record<string, string> = {
  trust_bar: "trust_badges",
  benefits_grid: "feature_cards",
  accreditation_logos: "accreditations",
  process_steps: "process",
  reviews_carousel: "reviews",
  cta_banner: "cta_band",
  blog_cards: "blog_index",
  footer_cta: "cta_band",
  hero_centered: "hero",
  service_detail_intro: "service_detail",
  team_cards: "feature_cards",
  area_list: "areas_grid",
  map_opening_hours: "contact",
  gallery_grid: "gallery",
  before_after: "gallery",
  faq_accordion: "faq",
  contact_form_section: "contact_form",
  richtext_article_body: "rich_text",
  system_404: "text",
  "system.notfound": "text",
  pricing_table: "feature_cards",
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

const skippableBlockTypes = new Set(["site.header", "site.footer"]);

export function normalizeBlockType(blockType: string): string {
  const normalized = blockType.trim().toLowerCase();
  return blockTypeAliases[normalized] || normalized;
}

export function isSkippableBlockType(blockType: string): boolean {
  return skippableBlockTypes.has(String(blockType || "").trim().toLowerCase());
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
