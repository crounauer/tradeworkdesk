import test from "node:test";
import assert from "node:assert/strict";

import { getProfileDeleteCleanupPlan } from "./profile-delete-cleanup";

test("profile delete cleanup plan includes all profile-linked tables that block auth user deletion", () => {
  const plan = getProfileDeleteCleanupPlan();

  assert.ok(plan.some((step) => step.table === "jobs" && step.column === "assigned_technician_id"));
  assert.ok(plan.some((step) => step.table === "service_records" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "job_notes" && step.column === "author_id"));
  assert.ok(plan.some((step) => step.table === "tenant_audit_log" && step.column === "actor_id"));
});
