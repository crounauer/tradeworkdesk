import assert from "node:assert/strict";
import test from "node:test";
import { getDuplicatePropertyGroups, propertiesHaveSameIdentity } from "./property-duplicates";

test("matches the same address and postcode after normalization", () => {
  assert.equal(propertiesHaveSameIdentity(
    { id: "one", address_line1: "12 High Street", postcode: "NE1 1AA" },
    { id: "two", address_line1: "12, HIGH-STREET", postcode: "ne11aa" },
  ), true);
  assert.equal(propertiesHaveSameIdentity(
    { id: "one", address_line1: "12 High Street", postcode: "NE1 1AA" },
    { id: "two", address_line1: "14 High Street", postcode: "NE1 1AA" },
  ), false);
});

test("does not merge incomplete address identities", () => {
  assert.equal(propertiesHaveSameIdentity(
    { id: "one", address_line1: "12 High Street", postcode: null },
    { id: "two", address_line1: "12 High Street", postcode: null },
  ), false);
});

test("keeps a property originally owned by the surviving customer", () => {
  const preferredId = "primary-property";
  const groups = getDuplicatePropertyGroups([
    { id: "duplicate-property", address_line1: "12 High Street", postcode: "NE1 1AA", created_at: "2020-01-01" },
    { id: preferredId, address_line1: "12 High Street", postcode: "NE1 1AA", created_at: "2025-01-01" },
  ], new Set([preferredId]));

  assert.equal(groups[0][0].id, preferredId);
  assert.equal(groups[0][1].id, "duplicate-property");
});
