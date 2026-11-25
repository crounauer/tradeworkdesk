import assert from "node:assert/strict";
import test from "node:test";
import { customersHaveSameIdentity } from "./customer-duplicates";

const existing = {
  first_name: "Kari",
  last_name: "Malone",
  email: "kari@example.com",
  phone: "07123 456789",
  mobile: null,
  address_line1: "1 High Street",
  postcode: "NE1 1AA",
};

test("matches the same email case-insensitively", () => {
  assert.equal(customersHaveSameIdentity(existing, {
    first_name: "Different",
    last_name: "Person",
    email: " KARI@example.com ",
  }), true);
});

test("matches phone formatting differences only with the same name", () => {
  assert.equal(customersHaveSameIdentity(existing, {
    first_name: " kari ",
    last_name: "MALONE",
    mobile: "+44 7123 456789",
  }), true);
  assert.equal(customersHaveSameIdentity(existing, {
    first_name: "Other",
    last_name: "Person",
    phone: "+44 7123 456789",
  }), false);
});

test("matches the same name at the same postcode or address", () => {
  assert.equal(customersHaveSameIdentity(existing, {
    first_name: "Kari",
    last_name: "Malone",
    postcode: "ne11aa",
  }), true);
  assert.equal(customersHaveSameIdentity(existing, {
    first_name: "Kari",
    last_name: "Malone",
    address_line1: "1, High-Street",
  }), true);
  assert.equal(customersHaveSameIdentity(existing, {
    first_name: "Kari",
    last_name: "Malone",
    postcode: "SW1A 1AA",
  }), false);
});
