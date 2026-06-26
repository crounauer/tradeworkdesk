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
});

test("hasBlockRendererForType detects supported and unsupported blocks", () => {
  assert.equal(hasBlockRendererForType("hero"), true);
  assert.equal(hasBlockRendererForType("trust_bar"), true);
  assert.equal(hasBlockRendererForType("blog_cards"), true);
  assert.equal(hasBlockRendererForType("unknown_block_type"), false);
});
