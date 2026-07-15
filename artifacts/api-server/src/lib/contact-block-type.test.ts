import test from "node:test";
import assert from "node:assert/strict";

import { isContactLikeBlockType, normalizeContactBlockType } from "./contact-block-type";

test("normalizeContactBlockType resolves known aliases", () => {
  assert.equal(normalizeContactBlockType("contact.split"), "contact");
  assert.equal(normalizeContactBlockType("contact_form_section"), "contact_form");
  assert.equal(normalizeContactBlockType("map_opening_hours"), "contact");
});

test("normalizeContactBlockType trims and lowercases block types", () => {
  assert.equal(normalizeContactBlockType("  Contact.Split  "), "contact");
  assert.equal(normalizeContactBlockType("  CONTACT_FORM  "), "contact_form");
});

test("isContactLikeBlockType returns true for contact variants", () => {
  assert.equal(isContactLikeBlockType("contact"), true);
  assert.equal(isContactLikeBlockType("contact_form"), true);
  assert.equal(isContactLikeBlockType("contact_form_section"), true);
  assert.equal(isContactLikeBlockType("contact.split"), true);
  assert.equal(isContactLikeBlockType("map_opening_hours"), true);
});

test("isContactLikeBlockType returns false for non-contact blocks", () => {
  assert.equal(isContactLikeBlockType("services_grid"), false);
  assert.equal(isContactLikeBlockType("hero"), false);
  assert.equal(isContactLikeBlockType(undefined), false);
});
