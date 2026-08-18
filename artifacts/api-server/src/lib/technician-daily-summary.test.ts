import test from "node:test";
import assert from "node:assert/strict";

import { isSummaryTimeDue } from "./technician-daily-summary";

test("isSummaryTimeDue treats 08:00 as due when the server is a few minutes late", () => {
  const due = isSummaryTimeDue("08:00", new Date("2026-08-18T08:05:00+01:00"));
  assert.equal(due, true);
});

test("isSummaryTimeDue does not trigger before the configured time", () => {
  const due = isSummaryTimeDue("08:00", new Date("2026-08-18T07:59:00+01:00"));
  assert.equal(due, false);
});
