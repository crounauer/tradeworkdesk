import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

test("public readiness reports database failures, caches probes, and recovers without changing liveness", async t => {
  process.env.SUPABASE_URL = "https://readiness-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.EMAIL_SERVICE_REMINDERS = "false";
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const originalFetch = globalThis.fetch;
  let failed = false;
  let stalled = false;
  let probes = 0;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "readiness-test.invalid");
    assert.equal(url.pathname, "/rest/v1/jobs");
    assert.equal(url.searchParams.get("select"), "id");
    assert.equal(url.searchParams.get("limit"), "1");
    assert.equal(init?.method || "GET", "GET");
    probes++;
    if (stalled) {
      return new Promise<Response>((_resolve, reject) => {
        assert.ok(init?.signal);
        init.signal.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    }
    return failed
      ? Response.json({ code: "PGRST003", message: "Timed out acquiring connection from connection pool." }, { status: 504 })
      : Response.json([{ id: "must-not-be-exposed" }]);
  });
  const { serveDatabaseReadiness } = await import("../lib/database-readiness");
  const app = express();
  app.get("/health/ready", serveDatabaseReadiness);
  app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const healthy = await fetch(`${baseUrl}/health/ready`);
  assert.equal(healthy.status, 200);
  assert.equal(healthy.headers.get("cache-control"), "no-store");
  assert.deepEqual(await healthy.json(), {
    status: "ok", database: { status: "ok", checkedAt: new Date(now).toISOString() },
  });
  failed = true;
  now += 15_000;
  const unavailable = await fetch(`${baseUrl}/health/ready`);
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    status: "degraded", database: { status: "unavailable", checkedAt: new Date(now).toISOString() },
  });
  assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  await fetch(`${baseUrl}/health/ready`);
  assert.equal(probes, 2);
  failed = false;
  now += 30_000;
  assert.equal((await fetch(`${baseUrl}/health/ready`)).status, 200);
  assert.equal(probes, 3);
  stalled = true;
  now += 15_000;
  const started = performance.now();
  assert.equal((await fetch(`${baseUrl}/health/ready`)).status, 503);
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 4_900 && elapsed < 6_500, `Probe timeout: ${elapsed}ms`);
  assert.equal(probes, 4);
});
