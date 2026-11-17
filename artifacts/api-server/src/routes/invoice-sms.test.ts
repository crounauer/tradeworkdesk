import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.SUPABASE_URL = "https://invoice-sms-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "invoice-sms-test-secret";
process.env.QUOTE_ACTION_TOKEN_SECRET = "invoice-sms-test-secret";
process.env.APP_URL = "https://example.test";

const { default: smsRouter } = await import("./sms");
const { default: invoiceRouter } = await import("./invoices");
const tenantId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const invoiceId = "33333333-3333-4333-8333-333333333333";

test("invoice SMS sends a tenant-scoped, revocable public PDF link only after provider acceptance", async t => {
  const invoice = {
    id: invoiceId, tenant_id: tenantId, customer_id: customerId, job_id: null,
    type: "invoice", status: "draft", sent_at: null as string | null,
    updated_at: "2026-01-01T00:00:00Z", invoice_number: "INV-1",
    issue_date: "2026-01-01", subtotal: 100, vat_rate: 0, vat_amount: 0, total: 100,
  };
  let active = true;
  let credits = 10;
  let providerFails = false;
  let updateFails = false;
  let logFails = false;
  let creditReadsFail = false;
  let creditWriteFails = false;
  let ownInvoice = true;
  let sentMessage = "";
  const messages: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (...[input, init]: Parameters<typeof fetch>) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    if (url.hostname === "api.thesmsworks.co.uk") {
      if (url.pathname.endsWith("/auth/token")) return Response.json({ token: "JWT test" });
      assert.equal(invoice.status, "draft", "provider must be called before marking draft sent");
      sentMessage = JSON.parse(String(init?.body)).content;
      return providerFails
        ? Response.json({ error: `failed: ${sentMessage}` }, { status: 400 })
        : Response.json({ messageid: "provider-1", credits: 1 });
    }
    assert.equal(url.hostname, "invoice-sms-test.invalid");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: tenantId, email: "test@example.test" });
    if (url.pathname.endsWith("/factors")) return Response.json([]);
    const table = url.pathname.split("/").pop();
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
    let data: unknown = null;
    switch (table) {
      case "profiles": data = url.searchParams.get("select") === "role,tenant_id"
        ? { role: "admin", tenant_id: tenantId } : []; break;
      case "tenants": data = { status: "active", stripe_subscription_id: "sub_test", trial_ends_at: null }; break;
      case "company_settings": data = { invoices_enabled: true, name: "Test Company" }; break;
      case "tenant_addons": data = active ? [{ id: "addon", addons: { feature_keys: ["sms_messaging"] } }] : []; break;
      case "addons": data = { id: "addon", billing_model: "usage", usage_bundle_size: 1000, usage_bundle_price: 10 }; break;
      case "tenant_addon_credits":
        if (creditReadsFail || (creditWriteFails && init?.method === "PATCH")) {
          return Response.json({ message: "credits unavailable" }, { status: 500 });
        }
        if (init?.method === "PATCH") credits = body.credits_remaining;
        data = { id: "credit", credits_remaining: credits };
        break;
      case "invoices":
        if (url.searchParams.has("tenant_id") && url.searchParams.get("tenant_id") !== `eq.${tenantId}`) break;
        if (url.searchParams.has("tenant_id") && !ownInvoice) break;
        if (init?.method === "PATCH") {
          if (updateFails) break;
          Object.assign(invoice, body);
        }
        data = invoice;
        break;
      case "customers":
        if (url.searchParams.get("select") !== "tenant_id") {
          assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        }
        data = { tenant_id: tenantId, first_name: "Customer", last_name: "Test" };
        break;
      case "invoice_line_items":
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        data = [];
        break;
      case "platform_settings": data = [
        { key: "sms_works_api_key", value: "key" },
        { key: "sms_works_secret", value: "secret" },
      ]; break;
      case "sms_messages":
        messages.push(body);
        if (logFails) return Response.json({ message: "failed" }, { status: 500 });
        data = { id: "sms-1", status: body.status, sms_works_message_id: "provider-1" };
        break;
      default: data = []; break;
    }
    return Response.json(data);
  });
  const app = express();
  app.use(express.json(), smsRouter, invoiceRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const send = (authorization = "Bearer test") => fetch(`${base}/invoices/${invoiceId}/send-sms`, {
    method: "POST",
    headers: { authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ destination: "07700900000", content: "Your invoice" }),
  });
  const view = (token: string) => fetch(`${base}/public/invoice-view/pdf`, {
    method: "POST", headers: { authorization: `Bearer ${token}` },
  });

  assert.equal((await fetch(`${base}/sms/availability`)).status, 401);
  const availability = () => fetch(`${base}/sms/availability`, { headers: { authorization: "Bearer test" } });
  assert.equal((await send("")).status, 401);
  ownInvoice = false;
  assert.equal((await send()).status, 404);
  ownInvoice = true;
  active = false;
  assert.deepEqual(await (await availability()).json(), { available: false });
  assert.equal((await send()).status, 402);
  active = true;
  credits = 0;
  assert.deepEqual(await (await availability()).json(), { available: false });
  assert.equal((await send()).status, 402);
  credits = 10;
  assert.deepEqual(await (await availability()).json(), { available: true });
  creditReadsFail = true;
  assert.equal((await send()).status, 503);
  assert.equal(invoice.status, "draft");
  creditReadsFail = false;
  providerFails = true;
  const failure = await send();
  assert.equal(failure.status, 502);
  assert.equal(invoice.status, "draft");
  assert.equal((await failure.text()).includes("invoice-view#"), false);
  providerFails = false;
  const success = await send();
  assert.equal(success.status, 200);
  assert.equal(invoice.status, "sent");
  assert.equal(credits, 9);
  const token = sentMessage.split("#")[1];
  assert.equal(token.length, 48);
  assert.ok(messages.every(message => !String(message.content).includes("/api/public/invoice-view#")));
  const pdf = await view(token);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-type") || "", /application\/pdf/);
  assert.equal(pdf.headers.get("cache-control"), "no-store");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
  invoice.status = "paid";
  assert.equal((await view(token)).status, 200);
  invoice.sent_at = "2026-01-02T00:00:00Z";
  assert.equal((await view(token)).status, 404);
  assert.equal((await view(`${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`)).status, 404);
  invoice.status = "cancelled";
  assert.equal((await view(token)).status, 404);
  invoice.status = "draft";
  invoice.sent_at = null;
  assert.equal((await view(token)).status, 404);
  updateFails = true;
  logFails = true;
  creditWriteFails = true;
  const partial = await send();
  assert.equal(partial.status, 200);
  const result = await partial.json() as { invoice_warning: string };
  assert.match(result.invoice_warning, /link may not work/i);
  assert.match(result.invoice_warning, /message history/i);
  assert.match(result.invoice_warning, /credit balance/i);
  assert.equal(invoice.status, "draft");
});
