import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://job-visits-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "job-visits-test-key";
const { default: router, jobVisitBody } = await import("./job-visits");
const tenantId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const techId = "33333333-3333-4333-8333-333333333333";
const visitId = "44444444-4444-4444-8444-444444444444";
const payload = {
  scheduled_date: "2026-11-16", scheduled_time: "14:00", all_day: false,
  estimated_duration: 120, assigned_technician_id: techId, notes: "Continue installation",
};

type Options = {
  method?: "post" | "patch" | "delete" | "get"; body?: object; clash?: boolean;
  leave?: boolean; missingJob?: boolean; missingVisit?: boolean; invalidTech?: boolean;
  status?: string; failAvailability?: boolean; role?: string; assigned?: boolean;
};

async function request(t: TestContext, options: Options = {}) {
  const writes: Array<{ table: string; method: string; body: Record<string, unknown> | undefined }> = [];
  const calls: URL[] = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "job-visits-test.invalid");
    const table = url.pathname.split("/").pop()!;
    calls.push(url);
    const method = init?.method || "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (method === "POST") assert.equal(body?.tenant_id, tenantId);
    else assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`, `Missing tenant filter on ${table}`);
    if (method !== "GET") writes.push({ table, method, body });
    let data: unknown = null;
    if (table === "jobs") data = options.missingJob ? null : { id: jobId, status: options.status || "scheduled", assigned_technician_id: options.role === "technician" ? null : techId };
    else if (table === "profiles") data = options.invalidTech ? null : { id: techId };
    else if (table === "calendar_holidays") data = options.leave ? [{
      technician_id: techId, name: "Annual leave", holiday_type: "technician_leave",
      start_date: payload.scheduled_date, end_date: payload.scheduled_date, allow_bookings: false,
    }] : [];
    else if (table === "job_schedule_entries") {
      if (options.failAvailability) return Response.json({ message: "Unavailable" }, { status: 500 });
      if (url.searchParams.get("select") === "id") data = options.assigned ? [{ id: visitId }] : [];
      else data = options.clash ? [{
        id: "existing-visit", job_id: jobId, job_ref: "JOB-12",
        scheduled_date: payload.scheduled_date, scheduled_time: "14:00:00", estimated_duration: 120,
      }] : [];
    } else if (table === "job_visits") {
      if (method === "POST" || method === "PATCH") data = { id: visitId, ...body };
      else if (url.searchParams.has("id")) data = options.missingVisit ? null : { id: visitId };
      else data = [{ id: visitId, ...payload }];
    } else assert.fail(`Unexpected table: ${table}`);
    return Response.json(data);
  });
  const method = options.method || "post";
  const path = method === "patch" || method === "delete" ? "/jobs/:id/visits/:visitId" : "/jobs/:id/visits";
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.stack.some(
    (entry: { method?: string }) => entry.method === method,
  ))?.route;
  assert.ok(route);
  const handlers: RequestHandler[] = route.stack.slice(2).map((entry: { handle: RequestHandler }) => entry.handle);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userId: techId, userRole: options.role || "admin" });
    next();
  });
  app[method](path, ...handlers);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}${path.replace(":id", jobId).replace(":visitId", visitId)}`, {
    method: method.toUpperCase(), headers: { "Content-Type": "application/json" },
    ...(method === "post" || method === "patch" ? { body: JSON.stringify(options.body || payload) } : {}),
  });
  return { response, writes, calls };
}

test("Additional dates are stored under one job without moving its primary appointment", async t => {
  const { response, writes } = await request(t);
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], { table: "job_visits", method: "POST", body: { ...payload, tenant_id: tenantId, job_id: jobId } });
});

test("All-day visits clear stale times and durations", async t => {
  const { response, writes } = await request(t, { body: { ...payload, all_day: true } });
  assert.equal(response.status, 201);
  assert.equal(writes[0].body?.scheduled_time, null);
  assert.equal(writes[0].body?.estimated_duration, null);
});

test("Updating a visit excludes only that visit, not other dates on the same job", async t => {
  const { response, writes, calls } = await request(t, { method: "patch" });
  assert.equal(response.status, 200, await response.clone().text());
  const check = calls.find(url => url.pathname.endsWith("job_schedule_entries"));
  assert.equal(check?.searchParams.get("id"), `neq.${visitId}`);
  assert.equal(writes[0].table, "job_visits");
  assert.equal(writes[0].body?.job_id, undefined);
});

test("Removing a visit leaves the job and other visits untouched", async t => {
  const { response, writes, calls } = await request(t, { method: "delete" });
  assert.equal(response.status, 204);
  assert.deepEqual(writes.map(w => [w.table, w.method]), [["job_visits", "DELETE"]]);
  assert.equal(calls.at(-1)?.searchParams.get("job_id"), `eq.${jobId}`);
  assert.equal(calls.at(-1)?.searchParams.get("id"), `eq.${visitId}`);
});

test("Clashing visits on the same job are rejected", async t => {
  const { response, writes } = await request(t, { clash: true });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.ok(body && typeof body === "object" && "code" in body);
  assert.equal(body.code, "TECHNICIAN_JOB_CLASH");
  assert.equal(writes.length, 0);
});

test("Engineer leave blocks additional visits", async t => {
  const { response, writes } = await request(t, { leave: true });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.ok(body && typeof body === "object" && "code" in body);
  assert.equal(body.code, "TECHNICIAN_LEAVE_CONFLICT");
  assert.equal(writes.length, 0);
});

test("Unavailable clash checks block writes instead of booking blindly", async t => {
  const { response, writes } = await request(t, { failAvailability: true });
  assert.equal(response.status, 500);
  assert.equal(writes.length, 0);
});

test("Foreign or missing jobs cannot receive visits", async t => {
  const { response, writes } = await request(t, { missingJob: true });
  assert.equal(response.status, 404);
  assert.equal(writes.length, 0);
});

test("Foreign or missing visits cannot be edited", async t => {
  const { response, writes } = await request(t, { method: "patch", missingVisit: true });
  assert.equal(response.status, 404);
  assert.equal(writes.length, 0);
});

test("Staff must be active and assignable within the tenant", async t => {
  const { response, writes } = await request(t, { invalidTech: true });
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
});

for (const status of ["completed", "invoiced", "cancelled"]) {
  test(`${status} jobs must be reopened before adding dates`, async t => {
    const { response, writes } = await request(t, { status });
    assert.equal(response.status, 409);
    assert.equal(writes.length, 0);
  });
}

test("Technicians assigned only to an additional visit can read the shared visit list", async t => {
  const { response } = await request(t, { method: "get", role: "technician", assigned: true });
  assert.equal(response.status, 200);
});

test("Other technicians cannot read a job's visits", async t => {
  const { response } = await request(t, { method: "get", role: "technician" });
  assert.equal(response.status, 403);
});

for (const method of ["post", "patch", "delete"] as const) {
  test(`Technicians cannot ${method} scheduled visits`, async t => {
    const { response, writes } = await request(t, { method, role: "technician", assigned: true });
    assert.equal(response.status, 403);
    assert.equal(writes.length, 0);
  });
}

test("Visit validation rejects invalid dates, missing times, and overnight windows", () => {
  for (const body of [
    { ...payload, scheduled_date: "2026-02-30" },
    { ...payload, scheduled_time: null },
    { ...payload, estimated_duration: 0 },
    { ...payload, estimated_duration: null },
    { ...payload, scheduled_time: "23:00" },
    { ...payload, assigned_technician_id: "not-a-uuid" },
  ]) assert.equal(jobVisitBody.safeParse(body).success, false);
  assert.ok(jobVisitBody.safeParse({ ...payload, scheduled_time: "22:00" }).success);
});
