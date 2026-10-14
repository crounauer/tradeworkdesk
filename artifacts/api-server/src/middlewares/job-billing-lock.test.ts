import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import type { AuthenticatedRequest } from "./auth";
import { jobBillingLock } from "./job-billing-lock";

async function fixture(options: { linked?: boolean; failure?: boolean; tenant?: boolean } = {}) {
  const queries: URL[] = [];
  const db = createClient("https://database.test", "test-key", {
    global: {
      fetch: async input => {
        queries.push(new URL(String(input)));
        if (options.failure) return new Response(JSON.stringify({ message: "Lookup failed" }), { status: 500 });
        return new Response(JSON.stringify(options.linked ? [{ new_job_id: "follow-up-job" }] : []), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  const app = express();
  app.use((req: AuthenticatedRequest, _res, next) => {
    if (options.tenant !== false) req.tenantId = "tenant-1";
    next();
  });
  const guard = jobBillingLock(db);
  for (const section of ["parts", "services", "time-entries"]) {
    app.post(`/jobs/:id/${section}`, guard, (_req, res) => { res.json({ saved: true }); });
    for (const method of ["patch", "delete"] as const) {
      app[method](`/jobs/:id/${section}/:entryId`, guard, (_req, res) => { res.json({ saved: true }); });
    }
  }
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  return {
    queries,
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

test("booked follow-ups reject adding, editing and deleting all billing entry types", async () => {
  const f = await fixture({ linked: true });
  try {
    for (const section of ["parts", "services", "time-entries"]) {
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const response = await fetch(`${f.base}/jobs/original/${section}${method === "POST" ? "" : "/entry"}`, { method });
        assert.equal(response.status, 409);
        const result = await response.json();
        assert.ok(result && typeof result === "object" && "new_job_id" in result && "error" in result);
        assert.equal(result.new_job_id, "follow-up-job");
        assert.equal(typeof result.error, "string");
        assert.match(String(result.error), /read-only/);
      }
    }
    assert.equal(f.queries.length, 9);
    for (const query of f.queries) {
      assert.equal(query.searchParams.get("tenant_id"), "eq.tenant-1");
      assert.equal(query.searchParams.get("original_job_id"), "eq.original");
      assert.equal(query.searchParams.get("status"), "eq.booked");
      assert.equal(query.searchParams.get("new_job_id"), "not.is.null");
    }
  } finally { await f.close(); }
});

test("jobs without a booked follow-up link retain billing writes", async () => {
  const f = await fixture();
  try {
    for (const section of ["parts", "services", "time-entries"]) {
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const response = await fetch(`${f.base}/jobs/return-visit/${section}${method === "POST" ? "" : "/entry"}`, { method });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { saved: true });
      }
    }
  } finally { await f.close(); }
});

test("failed lock checks fail closed with an explicit error", async t => {
  const log = t.mock.method(console, "error", () => {});
  const f = await fixture({ failure: true });
  try {
    const response = await fetch(`${f.base}/jobs/original/parts`, { method: "POST" });
    assert.equal(response.status, 500);
    const result = await response.json();
    assert.ok(result && typeof result === "object" && "error" in result);
    assert.match(String(result.error), /Unable to check/);
    assert.equal(log.mock.callCount(), 1);
  } finally { await f.close(); }
});

test("missing tenant context never queries or allows billing writes", async () => {
  const f = await fixture({ tenant: false });
  try {
    const response = await fetch(`${f.base}/jobs/original/parts`, { method: "POST" });
    assert.equal(response.status, 403);
    assert.equal(f.queries.length, 0);
  } finally { await f.close(); }
});
