import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";
import { buildPortalAccessGuide } from "../lib/portal-access-guide";

process.env.SUPABASE_URL = "https://portal-guide-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.RESEND_API_KEY = "test-key";
process.env.APP_URL = "https://portal-guide.example/";
const { default: router } = await import("./customers");

const tenantId = "tenant-guide";
const customerId = "customer-guide";
const customerEmail = "customer@example.com";
const futureExpiry = "2099-12-01T12:00:00Z";
const registeredPortal = {
  is_active: true,
  auth_user_id: "auth-customer",
  invite_token: "used-invite",
  invite_email: customerEmail,
  invite_expires_at: "2020-01-01T00:00:00Z",
};

type Options = {
  portal?: Record<string, unknown> | null;
  email?: string | null;
  missingCustomer?: boolean;
  failedTable?: string;
  role?: string;
};

async function request(t: TestContext, options: Options = {}) {
  const emails: Array<{ subject: string; html: string; to: string }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    if (url.hostname === "api.resend.com") {
      emails.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "guide-email" });
    }
    assert.equal(url.hostname, "portal-guide-test.invalid");
    const table = url.pathname.split("/").pop();
    if (table === "tenant_email_audit_log") {
      audits.push(JSON.parse(String(init?.body)));
      return Response.json(null);
    }
    assert.equal(init?.method || "GET", "GET", "Sending a guide must not mutate portal access");
    assert.equal(url.searchParams.get(table === "tenants" ? "id" : "tenant_id"), `eq.${tenantId}`);
    if (table === options.failedTable) {
      return Response.json({ message: "Read failed" }, { status: 400 });
    }
    if (table === "customers") {
      assert.equal(url.searchParams.get("id"), `eq.${customerId}`);
      return Response.json(options.missingCustomer ? null : {
        id: customerId, first_name: "Test", last_name: "Customer",
        email: options.email === undefined ? customerEmail : options.email,
      });
    }
    if (table === "customer_portal_users") {
      assert.equal(url.searchParams.get("customer_id"), `eq.${customerId}`);
      return Response.json(options.portal === undefined ? registeredPortal : options.portal);
    }
    if (table === "company_settings") return Response.json({
      name: "Test Heating", email: "office@example.com", phone: "01234 567890",
    });
    if (table === "tenants") return Response.json({ company_name: "Test Heating" });
    assert.fail(`Unexpected table: ${table}`);
  });

  const route = router.stack.find(layer => layer.route?.path === "/customers/:id/portal-access-guide")?.route;
  assert.ok(route);
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userId: "admin-guide", userRole: options.role || "admin" });
    next();
  });
  app.post(route.path, ...route.stack.slice(-2).map((entry: { handle: RequestHandler }) => entry.handle));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/customers/${customerId}/portal-access-guide`, { method: "POST" });
  return { response, emails, audits };
}

test("registered customers receive a complete sign-in guide without an invitation or access changes", async t => {
  const { response, emails, audits } = await request(t);
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await response.json(), { success: true, sent_to: customerEmail });
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, customerEmail);
  assert.match(emails[0].subject, /Test Heating.*portal access guide/);
  assert.match(emails[0].html, /href="https:\/\/portal-guide\.example\/portal\/login"/);
  assert.match(emails[0].html, /already set up/);
  assert.match(emails[0].html, /Forgot your password/);
  for (const section of ["Properties:", "Jobs:", "Invoices:", "Sign Out", customerEmail, "01234 567890"]) {
    assert.ok(emails[0].html.includes(section), section);
  }
  assert.doesNotMatch(emails[0].html, /used-invite|register\?token=/);
  assert.ok(audits.some(audit => audit.email_type === "portal_access_guide" && audit.status === "accepted"));
});

test("unregistered customers receive their existing valid invitation and setup steps", async t => {
  const { response, emails } = await request(t, {
    portal: { ...registeredPortal, auth_user_id: null, invite_token: "personal-token", invite_expires_at: futureExpiry },
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(emails.length, 1);
  assert.match(emails[0].html, /portal\/register\?token=personal-token/);
  assert.match(emails[0].html, /Create Account/);
  assert.match(emails[0].html, /1 December 2099/);
});

for (const [label, portal] of [
  ["missing", null],
  ["disabled", { ...registeredPortal, is_active: false }],
  ["expired", { ...registeredPortal, auth_user_id: null }],
  ["invalid expiry", { ...registeredPortal, auth_user_id: null, invite_expires_at: "invalid" }],
  ["missing token", { ...registeredPortal, auth_user_id: null, invite_token: null, invite_expires_at: futureExpiry }],
  ["changed email", { ...registeredPortal, auth_user_id: null, invite_email: "old@example.com", invite_expires_at: futureExpiry }],
] as const) {
  test(`does not send a guide for ${label} portal access`, async t => {
    const { response, emails } = await request(t, { portal });
    assert.equal(response.status, 400, await response.clone().text());
    assert.equal(emails.length, 0);
  });
}

test("missing customers cannot receive a guide", async t => {
  const missing = await request(t, { missingCustomer: true });
  assert.equal(missing.response.status, 404);
  assert.equal(missing.emails.length, 0);
});

test("a customer email is required", async t => {
  const { response, emails } = await request(t, { email: null });
  assert.equal(response.status, 400);
  assert.equal(emails.length, 0);
});

for (const table of ["customers", "customer_portal_users", "company_settings", "tenants"]) {
  test(`reports ${table} read failures without sending an email`, async t => {
    const { response, emails } = await request(t, { failedTable: table });
    assert.equal(response.status, 500);
    assert.equal(emails.length, 0);
  });
}

test("engineers cannot email portal guides", async t => {
  const { response, emails } = await request(t, { role: "engineer" });
  assert.equal(response.status, 403);
  assert.equal(emails.length, 0);
});

test("guide distinguishes existing accounts from first-time registration", () => {
  const body = buildPortalAccessGuide({
    customerName: "Test Customer", customerEmail, companyName: "Test Heating",
    loginUrl: "https://portal-guide.example/portal/login", isRegistered: true,
  });
  assert.match(body, /do not need to register again or request access/);
  assert.match(body, /using your usual contact details/);
  assert.doesNotMatch(body, /undefined|null/);
});
