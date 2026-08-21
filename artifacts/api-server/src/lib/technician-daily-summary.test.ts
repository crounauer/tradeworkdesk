import test from "node:test";
import assert from "node:assert/strict";

import { isSummaryTimeDue, shouldSkipTenantSummaryDispatch } from "./technician-daily-summary";

test("isSummaryTimeDue treats 08:00 as due when the server is a few minutes late", () => {
  const due = isSummaryTimeDue("08:00", new Date("2026-08-18T08:05:00+01:00"));
  assert.equal(due, true);
});

test("isSummaryTimeDue does not trigger before the configured time", () => {
  const due = isSummaryTimeDue("08:00", new Date("2026-08-18T07:59:00+01:00"));
  assert.equal(due, false);
});

test("isSummaryTimeDue catches up after a delayed scheduler tick", () => {
  const due = isSummaryTimeDue("21:55", new Date("2026-08-18T22:30:00+01:00"));
  assert.equal(due, true);
});

test("shouldSkipTenantSummaryDispatch stops repeat sends for the same day even when the time is due", () => {
  const skip = shouldSkipTenantSummaryDispatch({
    lastSentDate: "2026-08-18",
    today: "2026-08-18",
    tomorrow: "2026-08-19",
    configuredTime: "17:00",
    now: new Date("2026-08-18T17:00:00+01:00"),
    sendIfNoJobs: false,
    weekdaysOnly: false,
  });

  assert.equal(skip, true);
});
