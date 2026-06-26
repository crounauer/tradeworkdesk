import { strict as assert } from "assert";
import { test } from "node:test";
import { hasBlockRendererForType, normalizeBlockType } from "./block-registry";

test("normalizeBlockType trims and lowercases values", () => {
  assert.equal(normalizeBlockType(" Hero "), "hero");
});

test("hasBlockRendererForType detects supported and unsupported blocks", () => {
  assert.equal(hasBlockRendererForType("hero"), true);
  assert.equal(hasBlockRendererForType("unknown_block_type"), false);
});
