import test from "node:test";
import assert from "node:assert/strict";

import { cleanupProfileReferences, getProfileDeleteCleanupPlan } from "./profile-delete-cleanup";

test("profile delete cleanup plan includes all profile-linked tables that block auth user deletion", () => {
  const plan = getProfileDeleteCleanupPlan();

  assert.ok(plan.some((step) => step.table === "jobs" && step.column === "assigned_technician_id"));
  assert.ok(plan.some((step) => step.table === "service_records" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "job_notes" && step.column === "author_id"));
  assert.ok(plan.some((step) => step.table === "tenant_audit_log" && step.column === "actor_id"));
  assert.ok(plan.some((step) => step.table === "oil_tank_inspections" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "oil_tank_risk_assessments" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "combustion_analysis_records" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "burner_setup_records" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "fire_valve_test_records" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "oil_line_vacuum_tests" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "job_completion_reports" && step.column === "technician_id"));
  assert.ok(plan.some((step) => step.table === "invoices" && step.column === "created_by"));
  assert.ok(plan.some((step) => step.table === "shopping_lists" && step.column === "created_by"));
  assert.ok(plan.some((step) => step.table === "shopping_lists" && step.column === "assigned_to"));
  assert.ok(plan.some((step) => step.table === "community_threads" && step.column === "created_by"));
  assert.ok(plan.some((step) => step.table === "community_posts" && step.column === "author_id"));
  assert.ok(plan.some((step) => step.table === "community_post_reports" && step.column === "reported_by"));
  assert.ok(plan.some((step) => step.table === "job_time_entries" && step.column === "created_by"));
  assert.ok(plan.some((step) => step.table === "job_email_logs" && step.column === "sent_by"));
  assert.ok(plan.some((step) => step.table === "job_schedule_history" && step.column === "changed_by"));
  assert.ok(plan.some((step) => step.table === "website_templates" && step.column === "created_by"));
  assert.ok(plan.some((step) => step.table === "invoice_payments" && step.column === "created_by"));
  assert.ok(plan.some((step) => step.table === "template_conversions" && step.column === "created_by"));
  assert.ok(plan.some((step) => step.table === "template_conversions" && step.column === "approved_by"));
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
