import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://confirmation-recipient-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
const { buildJobConfirmationRecipients } = await import("./jobs");

test("returns separately tracked landlord and tenant recipients", () => {
  assert.deepEqual(buildJobConfirmationRecipients({
    customerName: "Karl Malone",
    customerEmail: "landlord@example.com",
    tenantName: "Alex Tenant",
    tenantEmail: "tenant@example.com",
  }), [
    { email: "landlord@example.com", name: "Karl Malone", role: "landlord" },
    { email: "tenant@example.com", name: "Alex Tenant", role: "tenant" },
  ]);
});

test("deduplicates identical landlord and tenant emails case-insensitively", () => {
  assert.deepEqual(buildJobConfirmationRecipients({
    customerName: "Karl Malone",
    customerEmail: "Shared@Example.com",
    tenantName: "Alex Tenant",
    tenantEmail: "shared@example.com",
  }), [
    { email: "Shared@Example.com", name: "Karl Malone", role: "landlord" },
  ]);
});

test("uses an override for the landlord while retaining the tenant recipient", () => {
  assert.deepEqual(buildJobConfirmationRecipients({
    customerName: "Karl Malone",
    customerEmail: "old@example.com",
    overrideEmail: "new@example.com",
    tenantEmail: "tenant@example.com",
  }), [
    { email: "new@example.com", name: "Karl Malone", role: "landlord" },
    { email: "tenant@example.com", name: "Tenant", role: "tenant" },
  ]);
});

test("includes multiple tenant contacts and deduplicates emails", () => {
  assert.deepEqual(buildJobConfirmationRecipients({
    customerName: "Karl Malone",
    customerEmail: "landlord@example.com",
    tenantContacts: [
      { name: "Alex", email: "alex@example.com" },
      { name: "Sam", email: "sam@example.com" },
      { name: "Alex duplicate", email: "ALEX@example.com" },
    ],
  }), [
    { email: "landlord@example.com", name: "Karl Malone", role: "landlord" },
    { email: "alex@example.com", name: "Alex", role: "tenant" },
    { email: "sam@example.com", name: "Sam", role: "tenant" },
  ]);
});
