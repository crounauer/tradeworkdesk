import assert from "node:assert/strict";
import test from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://job-email-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "job-email-test-key";
process.env.RESEND_API_KEY = "job-email-test-key";
const { default: jobsRouter } = await import("./jobs");

test("job emails optionally attach the selected job invoice and fail without sending when it cannot be loaded", async t => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const jobId = "22222222-2222-4222-8222-222222222222";
  const invoiceId = "33333333-3333-4333-8333-333333333333";
  let invoiceAvailable = true;
  let itemsFail = false;
  let role = "admin";
  const emails: Array<{ subject: string; html: string; attachments?: Array<{ filename: string; content: string }> }> = [];
  const logs: Array<{ body_text: string }> = [];
  let invoiceReads = 0;
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    if (url.hostname === "api.resend.com") {
      emails.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "email-test" });
    }
    assert.equal(url.hostname, "job-email-test.invalid");
    const table = url.pathname.split("/").pop();
    switch (table) {
      case "jobs":
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        return Response.json({ id: jobId, job_ref: "JOB-1", customers: { first_name: "Test", last_name: "Customer" } });
      case "tenants": return Response.json({ company_name: "Test Company" });
      case "company_settings": return Response.json({ name: "Test Company", invoices_enabled: true });
      case "customers":
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        return Response.json({ first_name: "Test", last_name: "Customer" });
      case "invoices":
        invoiceReads++;
        assert.equal(url.searchParams.get("id"), `eq.${invoiceId}`);
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        assert.equal(url.searchParams.get("job_id"), `eq.${jobId}`);
        assert.equal(url.searchParams.get("type"), "eq.invoice");
        assert.equal(url.searchParams.get("status"), "in.(draft,sent,overdue,paid)");
        return Response.json(invoiceAvailable ? {
          id: invoiceId, customer_id: "customer-test", type: "invoice",
          invoice_number: "INV-123", issue_date: "2026-11-17",
          subtotal: 100, vat_rate: 20, vat_amount: 20, total: 120,
        } : null);
      case "invoice_line_items":
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        assert.equal(url.searchParams.get("invoice_id"), `eq.${invoiceId}`);
        return itemsFail
          ? Response.json({ message: "Invoice items unavailable" }, { status: 500 })
          : Response.json([{ description: "Service", quantity: 1, unit_price: 100, total: 100, item_type: "service" }]);
      case "profiles": return Response.json({ full_name: "Sender" });
      case "job_email_logs":
        logs.push(JSON.parse(String(init?.body)));
        return Response.json(null);
      case "tenant_email_audit_log": return Response.json(null);
      default: assert.fail(`Unexpected table: ${table}`);
    }
  });

  const route = jobsRouter.stack.find(layer => layer.route?.path === "/jobs/:jobId/email-forms")?.route;
  assert.ok(route);
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    Object.assign(req, { tenantId, userId: tenantId, userRole: role });
    next();
  });
  // Keep the conditional invoice guards; inject the authenticated tenant above.
  app.post("/jobs/:jobId/email-forms", ...route.stack.slice(3).map((layer: { handle: RequestHandler }) => layer.handle));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const send = (body: Record<string, unknown>) => fetch(`http://127.0.0.1:${address.port}/jobs/${jobId}/email-forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: "customer@example.com", ...body }),
  });

  assert.equal((await send({ invoice_id: invoiceId })).status, 200);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].attachments?.length, 1);
  const attachment = emails[0].attachments![0];
  assert.equal(attachment.filename, "invoice-INV-123.pdf");
  assert.equal(Buffer.from(attachment.content, "base64").subarray(0, 4).toString(), "%PDF");
  assert.match(emails[0].html, /Attached Invoice: INV-123/);
  assert.match(logs[0].body_text, /Invoice attached: INV-123/);

  const readsAfterAttachment = invoiceReads;
  assert.equal((await send({ customer_message: "No invoice this time" })).status, 200);
  assert.equal(invoiceReads, readsAfterAttachment);
  assert.equal(emails.length, 2);
  assert.equal(emails[1].attachments, undefined);
  assert.doesNotMatch(emails[1].html, /Attached Invoice/);

  invoiceAvailable = false;
  assert.equal((await send({ invoice_id: invoiceId, customer_message: "Please see invoice" })).status, 404);
  assert.equal(emails.length, 2);
  invoiceAvailable = true;
  itemsFail = true;
  assert.equal((await send({ invoice_id: invoiceId })).status, 500);
  assert.equal(emails.length, 2);
  role = "technician";
  assert.equal((await send({ invoice_id: invoiceId })).status, 403);
  assert.equal(emails.length, 2);
});
