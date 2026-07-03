const liveAliases: Record<string, string> = {
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
  pricing_table: "feature_cards",
};

const liveToStorybook: Record<string, string> = {
  hero: "hero.standard",
  hero_split: "hero.standard",
  text: "about.intro",
  rich_text: "about.intro",
  text_section: "about.intro",
  cta: "cta.banner",
  cta_band: "cta.banner",
  services: "services.grid",
  services_grid: "services.grid",
  service_detail: "about.intro",
  contact_form: "contact.split",
  contact: "contact.split",
  testimonials: "reviews.grid",
  reviews: "reviews.grid",
  gallery: "gallery.grid",
  accreditations: "trust.badges",
  trust_badges: "trust.badges",
  why_choose_us: "features.list",
  features_bar: "features.list",
  feature_cards: "features.list",
  faq: "faq.accordion",
  process: "process.steps",
  steps: "process.steps",
  how_it_works: "process.steps",
  areas: "areas.grid",
  areas_grid: "areas.grid",
  area_detail_hero: "areas.grid",
  project_showcase: "gallery.grid",
  case_study: "gallery.grid",
  projects: "gallery.grid",
  online_booking: "cta.banner",
  booking: "cta.banner",
  sticky_mobile_cta: "cta.banner",
  blog_index: "blog.index",
  blog_post: "blog.index",
  legal_content: "legal.content",
  image: "gallery.grid",
  spacer: "cta.banner",
  brands: "trust.badges",
  partners: "trust.badges",
};

export function normalizeLiveBlockType(blockType: string): string {
  const normalized = String(blockType || "").trim().toLowerCase();
  return liveAliases[normalized] || normalized;
}

export function toStorybookBlockType(blockType: string): string {
  const raw = String(blockType || "").trim();
  if (raw.includes(".")) return raw;
  const normalized = normalizeLiveBlockType(raw);
  return liveToStorybook[normalized] || "about.intro";
}
