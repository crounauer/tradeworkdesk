import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { syncSentInvoiceJob } from "./invoice-job-status";

const sentInvoice = { type: "invoice", status: "sent", job_id: "job-1" };

function database(options: { status?: string; followUp?: boolean; failure?: string; changed?: boolean; missing?: boolean } = {}) {
  const requests: Array<{ url: URL; method: string; body: string | undefined }> = [];
  const db = createClient("https://database.test", "test-key", {
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method || "GET";
        const stage = method === "PATCH" ? "update" : url.pathname.endsWith("follow_ups") ? "followUp" : "job";
        requests.push({ url, method, body: init?.body?.toString() });
        if (options.failure === stage) {
          return new Response(JSON.stringify({ message: `${stage} failed`, code: "TEST" }), { status: 500 });
        }
        const data = stage === "job"
          ? options.missing ? [] : [{ status: options.status || "completed" }]
          : stage === "followUp"
            ? options.followUp ? [{ id: "follow-up-1" }] : []
            : options.changed ? null : { id: "job-1" };
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
      },
    },
  });
  return { db, requests };
}

test("a sent invoice marks only its tenant's completed job invoiced", async () => {
  const { db, requests } = database();
  assert.deepEqual(await syncSentInvoiceJob(db, "tenant-1", sentInvoice), { job_marked_invoiced: true });
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.url.searchParams.get("tenant_id"), "eq.tenant-1");
  }
  assert.equal(requests[1].url.searchParams.get("original_job_id"), "eq.job-1");
  assert.equal(requests[1].url.searchParams.get("status"), "in.(awaiting_parts,parts_arrived,booked)");
  assert.equal(requests[2].url.searchParams.get("id"), "eq.job-1");
  assert.equal(requests[2].url.searchParams.get("status"), "eq.completed");
  assert.deepEqual(JSON.parse(requests[2].body!), { status: "invoiced" });
});

test("quotes, draft invoices and unlinked invoices never update jobs", async () => {
  const { db, requests } = database();
  for (const invoice of [
    { ...sentInvoice, type: "quote" },
    { ...sentInvoice, status: "draft" },
    { ...sentInvoice, job_id: null },
  ]) {
    assert.deepEqual(await syncSentInvoiceJob(db, "tenant-1", invoice), { job_marked_invoiced: false });
  }
  assert.equal(requests.length, 0);
});

test("re-sending an already invoiced job is idempotent", async () => {
  const { db, requests } = database({ status: "invoiced" });
  assert.deepEqual(await syncSentInvoiceJob(db, "tenant-1", sentInvoice), { job_marked_invoiced: true });
  assert.equal(requests.length, 1);
});

test("sending an invoice never completes or reopens an unfinished/cancelled job", async () => {
  for (const status of ["scheduled", "in_progress", "cancelled", "requires_follow_up", "awaiting_parts", "follow_up_scheduled"]) {
    const { db, requests } = database({ status });
    assert.deepEqual(await syncSentInvoiceJob(db, "tenant-1", sentInvoice), { job_marked_invoiced: false });
    assert.equal(requests.length, 1);
  }
});

test("active follow-ups keep the original job completed and explain why", async () => {
  const { db, requests } = database({ followUp: true });
  const result = await syncSentInvoiceJob(db, "tenant-1", sentInvoice);
  assert.equal(result.job_marked_invoiced, false);
  assert.match(result.job_status_warning!, /active follow-up/);
  assert.equal(requests.length, 2);
});

test("a concurrent status change is not overwritten", async () => {
  const { db } = database({ changed: true });
  const result = await syncSentInvoiceJob(db, "tenant-1", sentInvoice);
  assert.equal(result.job_marked_invoiced, false);
  assert.match(result.job_status_warning!, /status changed/);
});

test("database failures are logged and reported without pretending delivery failed", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  for (const failure of ["job", "followUp", "update"]) {
    const { db } = database({ failure });
    const result = await syncSentInvoiceJob(db, "tenant-1", sentInvoice);
    assert.equal(result.job_marked_invoiced, false);
    assert.match(result.job_status_warning!, /do not resend/);
  }
  const { db } = database({ missing: true });
  assert.match((await syncSentInvoiceJob(db, "tenant-1", sentInvoice)).job_status_warning!, /do not resend/);
  assert.equal(log.mock.callCount(), 4);
});
