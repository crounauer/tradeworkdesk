import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://sms-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sms-test-key";

const { default: smsRouter } = await import("./sms");
const tenantId = "11111111-1111-4111-8111-111111111111";
const enquiryId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";

async function withSmsEndpoint(
  t: TestContext,
  path: string,
  method: "get" | "post",
  options: { active: boolean; credits?: number; ownEnquiry?: boolean; allowProvider?: boolean },
) {
  const calls: URL[] = [];
  const writes: Array<{ table: string; method: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (...[input, init]: Parameters<typeof fetch>) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    calls.push(url);
    if (url.hostname === "api.thesmsworks.co.uk") {
      assert.ok(options.allowProvider, "SMS provider must not be called when access is denied");
      return Response.json(url.pathname.endsWith("/auth/token")
        ? { token: "JWT test-token" }
        : { messageid: "provider-1", credits: 1 });
    }
    assert.equal(url.hostname, "sms-test.invalid", "No SMS provider call should occur");
    const table = url.pathname.split("/").pop();
    if (init?.body && typeof init.body === "string") {
      writes.push({ table: table || "", method: init.method || "GET", body: JSON.parse(init.body) });
    }
    let data: unknown = [];
    if (table === "tenant_addons") {
      data = options.active ? [{ id: "addon", addons: { feature_keys: ["sms_messaging"] } }] : [];
    } else if (table === "addons") {
      data = { id: "addon", billing_model: "usage", usage_bundle_size: 1000, usage_bundle_price: 10 };
    } else if (table === "tenant_addon_credits") {
      data = { id: "credits-1", credits_remaining: options.credits ?? 10 };
    } else if (table === "jobs") {
      data = { tenant_id: tenantId };
    } else if (table === "enquiries") {
      data = url.searchParams.get("select") === "tenant_id"
        ? { tenant_id: tenantId }
        : options.ownEnquiry === false ? null
          : url.searchParams.get("select") === "id" ? [{ id: enquiryId }]
            : { linked_job_id: null, linked_customer_id: null };
    } else if (table === "sms_messages") {
      data = init?.method === "POST"
        ? { id: "sms-1", status: "sent", sms_works_message_id: "provider-1" }
        : [{ id: "sms-1", content: "Your appointment is confirmed.", status: "sent" }];
    } else if (table === "platform_settings") {
      data = [
        { key: "sms_works_api_key", value: "test-key" },
        { key: "sms_works_secret", value: "test-secret" },
      ];
    } else {
      assert.fail(`Unexpected database access: ${table}`);
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
    });
  });

  const layer = smsRouter.stack.find(layer => layer.route?.path === path);
  assert.ok(layer?.route);
  const handler: RequestHandler = layer.route.stack[layer.route.stack.length - 1].handle;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userId: tenantId });
    next();
  });
  app[method](path, handler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { url: `http://127.0.0.1:${address.port}${path}`, calls, writes };
}

test("SMS history is blocked without the add-on, before accessing messages", async t => {
  const { url, calls } = await withSmsEndpoint(t, "/sms/messages", "get", { active: false });
  const response = await fetch(`${url}?enquiry_id=${enquiryId}`);
  assert.equal(response.status, 402);
  assert.equal(calls.some(url => url.pathname.endsWith("/sms_messages")), false);
});

test("SMS sending is blocked without the add-on, before provider calls", async t => {
  const { url } = await withSmsEndpoint(t, "/sms/send", "post", { active: false });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: "07700900000", content: "Hello", enquiry_id: enquiryId }),
  });
  assert.equal(response.status, 402);
});

test("SMS sending is blocked with zero credits, before provider calls", async t => {
  const { url } = await withSmsEndpoint(t, "/sms/send", "post", { active: true, credits: 0 });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: "07700900000", content: "Hello", enquiry_id: enquiryId }),
  });
  assert.equal(response.status, 402);
});

test("Enquiry SMS history is scoped to its tenant and costs no credits", async t => {
  const { url, calls } = await withSmsEndpoint(t, "/sms/messages", "get", { active: true, credits: 0 });
  const response = await fetch(`${url}?enquiry_id=${enquiryId}`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result && typeof result === "object" && "data" in result && Array.isArray(result.data));
  assert.equal(result.data.length, 1);
  const query = calls.find(url => url.pathname.endsWith("/sms_messages"));
  assert.equal(query?.searchParams.get("tenant_id"), `eq.${tenantId}`);
  assert.equal(query?.searchParams.get("enquiry_id"), `eq.${enquiryId}`);
  assert.equal(calls.some(url => url.pathname.endsWith("/tenant_addon_credits")), false);
});

test("A converted job includes texts sent before the enquiry was linked", async t => {
  const { url, calls } = await withSmsEndpoint(t, "/sms/messages", "get", { active: true });
  const response = await fetch(`${url}?job_id=${jobId}`);
  assert.equal(response.status, 200);
  const query = calls.find(url => url.pathname.endsWith("/sms_messages"));
  assert.equal(query?.searchParams.get("or"), `(job_id.eq.${jobId},enquiry_id.in.(${enquiryId}))`);
});

test("SMS send rejects a foreign enquiry before provider calls", async t => {
  const { url } = await withSmsEndpoint(t, "/sms/send", "post", { active: true, ownEnquiry: false });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: "07700900000", content: "Hello", enquiry_id: enquiryId }),
  });
  assert.equal(response.status, 404);
});

test("An entitled enquiry send logs its link and deducts one credit", async t => {
  const { url, calls, writes } = await withSmsEndpoint(t, "/sms/send", "post", {
    active: true, credits: 10, allowProvider: true,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: "07700900000", content: "Hello", enquiry_id: enquiryId }),
  });
  assert.equal(response.status, 200);
  assert.equal(calls.filter(url => url.pathname.endsWith("/message/send")).length, 1);
  const message = writes.find(write => write.table === "sms_messages");
  assert.equal(message?.body.enquiry_id, enquiryId);
  assert.equal(message?.body.tenant_id, tenantId);
  assert.equal(message?.body.content, "Hello");
  const debit = writes.find(write => write.table === "tenant_addon_credits" && write.method === "PATCH");
  assert.equal(debit?.body.credits_remaining, 9);
});
