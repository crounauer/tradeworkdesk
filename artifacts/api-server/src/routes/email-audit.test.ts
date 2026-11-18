import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.SUPABASE_URL = "https://email-audit-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-database-key";
process.env.RESEND_API_KEY = "test-email-key";
const { default: router } = await import("./email-audit");

test("email audit previews expose only tenant-scoped sent content and trusted attachment links", async t => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const auditId = "22222222-2222-4222-8222-222222222222";
  const providerId = "33333333-3333-4333-8333-333333333333";
  const photoUrl = `https://outbound-cdn.resend.com/${providerId}/attachments/photo?signature=test`;
  let auditExists = true;
  let providerMessageId: string | null = providerId;
  let messageStatus = 200;
  let attachmentStatus = 200;
  let userRole = "office_staff";
  let providerReads = 0;
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    if (url.hostname === "email-audit-test.invalid") {
      assert.equal(url.pathname, "/rest/v1/tenant_email_audit_log");
      assert.equal(url.searchParams.get("id"), `eq.${auditId}`);
      assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
      return Response.json(auditExists ? { provider: "resend", provider_message_id: providerMessageId } : null);
    }
    assert.equal(url.hostname, "api.resend.com");
    providerReads++;
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-email-key");
    if (url.pathname === `/emails/${providerId}`) {
      return Response.json({ id: providerId, html: "<p>Service photos attached.</p>", text: null }, { status: messageStatus });
    }
    assert.equal(url.pathname, `/emails/${providerId}/attachments`);
    return Response.json({
      data: [
        { id: "photo", filename: "boiler.png", content_type: "image/png", download_url: photoUrl },
        { id: "pdf", filename: "report.pdf", content_type: "application/pdf", download_url: "https://outbound-cdn.resend.com.evil.invalid/report.pdf" },
      ],
    }, { status: attachmentStatus });
  });

  const route = router.stack.find(layer => layer.route?.path === "/email-audit/:id/content")?.route;
  assert.ok(route);
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userRole });
    next();
  });
  // Inject the authenticated tenant while keeping the route's actual role guard.
  app.get("/email-audit/:id/content", ...route.stack.slice(2).map(layer => layer.handle));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const read = () => fetch(`http://127.0.0.1:${address.port}/email-audit/${auditId}/content`);

  userRole = "technician";
  assert.equal((await read()).status, 403);
  userRole = "office_staff";
  auditExists = false;
  assert.equal((await read()).status, 404);
  auditExists = true;
  providerMessageId = null;
  assert.equal((await read()).status, 404);
  assert.equal(providerReads, 0);

  providerMessageId = providerId;
  const preview = await read();
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("cache-control") || "", /no-store/);
  assert.deepEqual(await preview.json(), {
    text: null,
    html: "<p>Service photos attached.</p>",
    attachments: [
      { id: "photo", filename: "boiler.png", content_type: "image/png", download_url: photoUrl },
      { id: "pdf", filename: "report.pdf", content_type: "application/pdf", download_url: null },
    ],
  });

  attachmentStatus = 503;
  const partial = await read();
  assert.equal(partial.status, 200);
  assert.deepEqual(await partial.json(), { text: null, html: "<p>Service photos attached.</p>", attachments: null });
  messageStatus = 404;
  assert.equal((await read()).status, 404);
});
