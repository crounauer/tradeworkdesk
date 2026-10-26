import assert from "node:assert/strict";
import test from "node:test";

test("send me a copy sends the PDF even when the user's address is the reply-to", async t => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.SUPABASE_URL = "https://database.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.EMAIL_SEND_TIMEOUT_MS = "1000";
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    assert.ok(url.startsWith("https://api.resend.com/") || url.startsWith("https://database.test/"), `Unexpected request: ${url}`);
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(url.startsWith("https://api.resend.com/") ? { id: "copy-message" } : null), {
      headers: { "Content-Type": "application/json" },
    });
  });
  const { sendAdminCcCopy } = await import("./email");
  await sendAdminCcCopy({
    extraCc: [" Owner@Example.com ", "owner@example.com"],
    to: "customer@example.com",
    replyTo: "owner@example.com",
    subject: "Invoice INV-1",
    html: "<p>Invoice attached</p>",
    from: "Test <notifications@example.com>",
    tenantId: "tenant-test",
    emailType: "invoice",
    attachments: [{ filename: "invoice.pdf", content: Buffer.from("test-pdf") }],
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].body.to, ["owner@example.com"]);
  assert.equal(requests[0].body.subject, "[Copy] Invoice INV-1");
  assert.deepEqual(requests[0].body.attachments, [{ filename: "invoice.pdf", content: Buffer.from("test-pdf").toString("base64") }]);
  assert.equal(requests[1].body.email_type, "invoice_admin_copy");
  assert.equal(requests[1].body.status, "accepted");
  assert.equal(requests[1].body.provider_message_id, "copy-message");
  assert.equal(requests[1].body.to_email, "owner@example.com");
});
