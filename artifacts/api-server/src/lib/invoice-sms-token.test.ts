import assert from "node:assert/strict";
import test from "node:test";
import { createInvoiceSmsToken, parseInvoiceSmsToken, verifyInvoiceSmsToken } from "./invoice-sms-token";

test("invoice links expire after 30 days and reject tampering or a changed sent timestamp", t => {
  const previous = process.env.QUOTE_ACTION_TOKEN_SECRET;
  process.env.QUOTE_ACTION_TOKEN_SECRET = "test-invoice-link-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.QUOTE_ACTION_TOKEN_SECRET;
    else process.env.QUOTE_ACTION_TOKEN_SECRET = previous;
  });
  let now = Date.parse("2026-01-01T00:00:00Z");
  t.mock.method(Date, "now", () => now);
  const sentAt = "2026-01-01T00:00:00.000Z";
  const token = createInvoiceSmsToken("11111111-1111-4111-8111-111111111111", sentAt);
  const parsed = parseInvoiceSmsToken(token);
  assert.equal(parsed?.invoiceId, "11111111-1111-4111-8111-111111111111");
  assert.equal(verifyInvoiceSmsToken(parsed, sentAt), true);
  assert.equal(verifyInvoiceSmsToken(parsed, "2026-01-01T00:00:01.000Z"), false);
  assert.equal(verifyInvoiceSmsToken(parsed, null), false);
  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  assert.equal(verifyInvoiceSmsToken(parseInvoiceSmsToken(tampered), sentAt), false);
  now += 30 * 24 * 60 * 60 * 1000 - 1000;
  assert.ok(parseInvoiceSmsToken(token));
  now += 1000;
  assert.equal(parseInvoiceSmsToken(token), null);
});
