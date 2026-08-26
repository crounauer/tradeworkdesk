import test from "node:test";
import assert from "node:assert/strict";

import { getTransactionalSenderEmail } from "./email";
import { buildSummaryBody } from "./technician-daily-summary";
import { validateJobEmailSendRequest } from "../routes/jobs";

test("uses a dedicated transactional sender email by default", () => {
  process.env.TRANSACTIONAL_FROM_EMAIL = "notifications@mail.tradeworkdesk.co.uk";
  assert.equal(getTransactionalSenderEmail(), "notifications@mail.tradeworkdesk.co.uk");
});

test("allows a message-only customer email with no attachments", () => {
  const result = validateJobEmailSendRequest({
    to: "customer@example.com",
    customer_message: "Please call when you can.",
  });

  assert.deepEqual(result, { ok: true });
});

test("keeps technician summaries operational and adds spam guidance", () => {
  const body = buildSummaryBody({
    technicianName: "Alex",
    companyName: "North East EcoHeat LTD",
    targetDate: "2026-08-26",
    jobs: [{
      job_ref: "NEE-204",
      scheduled_time: "09:00",
      all_day: false,
      status: "scheduled",
      description: "Annual service check",
      customers: { first_name: "Jamie", last_name: "Smith", business_name: null },
      properties: { address_line1: "14 Market Street", postcode: "NE1 2AB" },
    }],
  });

  assert.match(body, /Your job summary for/);
  assert.match(body, /spam folder/i);
  assert.match(body, /notifications@mail\.tradeworkdesk\.co\.uk/);
  assert.doesNotMatch(body, /notifications@tradeworkdesk\.co\.uk/);
  assert.doesNotMatch(body, /Powered by TradeWorkDesk/i);
});
