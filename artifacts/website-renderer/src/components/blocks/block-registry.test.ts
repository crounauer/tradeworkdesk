import { strict as assert } from "assert";
import { test } from "node:test";
import { hasBlockRendererForType, normalizeBlockType } from "./block-registry";

test("normalizeBlockType trims and lowercases values", () => {
  assert.equal(normalizeBlockType(" Hero "), "hero");
});

test("normalizeBlockType maps known aliases", () => {
  assert.equal(normalizeBlockType("trust_bar"), "trust_badges");
  assert.equal(normalizeBlockType("benefits_grid"), "feature_cards");
  assert.equal(normalizeBlockType("accreditation_logos"), "accreditations");
  assert.equal(normalizeBlockType("process_steps"), "process");
  assert.equal(normalizeBlockType("reviews_carousel"), "reviews");
  assert.equal(normalizeBlockType("cta_banner"), "cta_band");
  assert.equal(normalizeBlockType("blog_cards"), "blog_index");
  assert.equal(normalizeBlockType("footer_cta"), "cta_band");
  assert.equal(normalizeBlockType("hero_centered"), "hero");
  assert.equal(normalizeBlockType("service_detail_intro"), "service_detail");
  assert.equal(normalizeBlockType("team_cards"), "feature_cards");
  assert.equal(normalizeBlockType("area_list"), "areas_grid");
  assert.equal(normalizeBlockType("map_opening_hours"), "contact");
  assert.equal(normalizeBlockType("gallery_grid"), "gallery");
  assert.equal(normalizeBlockType("before_after"), "gallery");
  assert.equal(normalizeBlockType("faq_accordion"), "faq");
  assert.equal(normalizeBlockType("contact_form_section"), "contact_form");
  assert.equal(normalizeBlockType("richtext_article_body"), "rich_text");
  assert.equal(normalizeBlockType("system_404"), "text");
  assert.equal(normalizeBlockType("pricing_table"), "feature_cards");
});

test("hasBlockRendererForType detects supported and unsupported blocks", () => {
  assert.equal(hasBlockRendererForType("hero"), true);
  assert.equal(hasBlockRendererForType("trust_bar"), true);
  assert.equal(hasBlockRendererForType("blog_cards"), true);
  assert.equal(hasBlockRendererForType("hero_centered"), true);
  assert.equal(hasBlockRendererForType("pricing_table"), true);
  assert.equal(hasBlockRendererForType("unknown_block_type"), false);
});
