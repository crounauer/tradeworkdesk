import assert from "node:assert/strict";
import test from "node:test";
import { getPropertyTenantContacts } from "./property-tenants";

test("returns multiple property tenant contacts and preserves legacy contact", () => {
  assert.deepEqual(getPropertyTenantContacts({
    tenant_name: "Alex",
    tenant_email: "alex@example.com",
    tenant_contacts: [
      { name: "Sam", email: "sam@example.com", phone: "07111" },
      { name: "Jo", email: "jo@example.com", phone: "" },
    ],
  }), [
    { name: "Alex", email: "alex@example.com", phone: "" },
    { name: "Sam", email: "sam@example.com", phone: "07111" },
    { name: "Jo", email: "jo@example.com", phone: "" },
  ]);
});

test("does not duplicate the legacy contact", () => {
  assert.equal(getPropertyTenantContacts({
    tenant_email: "same@example.com",
    tenant_contacts: [{ name: "Same", email: "SAME@example.com" }],
  }).length, 1);
});
