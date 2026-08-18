import test from "node:test";
import assert from "node:assert/strict";

import { cleanupProfileReferences, getProfileDeleteCleanupPlan } from "./profile-delete-cleanup";

test("profile delete cleanup plan includes all profile-linked tables that block auth user deletion", () => {
  const plan = getProfileDeleteCleanupPlan();

  assert.ok(plan.some((step) => step.table === "jobs" && step.column === "assigned_technician_id"));
  assert.ok(plan.some((step) => step.table === "service_records" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "job_notes" && step.column === "author_id"));
  assert.ok(plan.some((step) => step.table === "tenant_audit_log" && step.column === "actor_id"));
});

test("cleanupProfileReferences ignores missing tables instead of failing", async () => {
  const calls: string[] = [];

  const fakeSupabase = {
    from(table: string) {
      calls.push(table);
      return {
        update: () => ({ eq: async () => ({ error: { code: "42P01", message: `relation \"public.${table}\" does not exist` } }) }),
        delete: () => ({ eq: async () => ({ error: { code: "42P01", message: `relation \"public.${table}\" does not exist` } }) }),
      };
    },
  };

  await assert.doesNotReject(() => cleanupProfileReferences(fakeSupabase, "user-123"));
  assert.ok(calls.length > 0);
});
