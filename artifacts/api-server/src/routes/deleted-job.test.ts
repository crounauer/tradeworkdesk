import assert from "node:assert/strict";
import test from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://deleted-job-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "deleted-job-test-key";
const { default: jobsRouter } = await import("./jobs");

test("Deleted jobs return 404 from job details instead of being displayed", async t => {
  const jobId = "22222222-2222-4222-8222-222222222222";
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const originalFetch = globalThis.fetch;
  const calls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "deleted-job-test.invalid");
    calls.push(url);
    assert.ok(url.pathname.endsWith("/jobs"));
    assert.equal(url.searchParams.get("id"), `eq.${jobId}`);
    assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
    assert.equal(url.searchParams.get("is_active"), "eq.true");
    return Response.json({ code: "PGRST116", message: "No rows found" }, { status: 406 });
  });

  const route = jobsRouter.stack.find(layer => layer.route?.path === "/jobs/:id")?.route;
  assert.ok(route);
  const handler: RequestHandler = route.stack[route.stack.length - 1].handle;
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userRole: "admin" });
    next();
  });
  app.get("/jobs/:id", handler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/jobs/${jobId}`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Job not found" });
  assert.equal(calls.length, 1);
});
