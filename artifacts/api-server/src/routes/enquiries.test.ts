import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://enquiries-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "enquiries-test-key";

const { default: enquiriesRouter } = await import("./enquiries");
const tenantId = "11111111-1111-4111-8111-111111111111";
const enquiryId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const engineerId = "44444444-4444-4444-8444-444444444444";

async function withConversionEndpoint(t: TestContext, foreignEngineer = false, clashingJob = false) {
  const writes: Array<{ table: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (...[input, init]: Parameters<typeof fetch>) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "enquiries-test.invalid");
    const table = url.pathname.split("/").pop()!;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (body) writes.push({ table, body });
    let data: unknown;
    if (table === "enquiries") {
      data = init?.method === "PATCH" ? [] : { id: enquiryId, status: "new", priority: "medium" };
    } else if (table === "customers" || table === "properties") {
      data = { tenant_id: tenantId };
    } else if (table === "profiles") {
      data = url.searchParams.get("select") === "tenant_id"
        ? { tenant_id: foreignEngineer ? "another-tenant" : tenantId }
        : [];
    } else if (table === "tenants") {
      data = { status: "active", plans: { max_users: 2 } };
    } else if (table === "jobs" || table === "job_schedule_entries") {
      data = init?.method === "POST" ? { id: jobId, ...body } : clashingJob ? [{
        id: "existing-job", job_ref: "JOB-0026", scheduled_date: "2026-10-26",
        scheduled_time: "09:00:00", estimated_duration: 180, status: "scheduled",
      }] : [];
    } else if (table === "tenant_user_push_preferences") {
      data = [];
    } else {
      assert.fail(`Unexpected database access: ${table}`);
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
    });
  });

  const layer = enquiriesRouter.stack.find(layer => layer.route?.path === "/enquiries/:id/convert");
  assert.ok(layer?.route);
  const handler: RequestHandler = layer.route.stack[layer.route.stack.length - 1].handle;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userId: tenantId });
    next();
  });
  app.post("/enquiries/:id/convert", handler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    writes,
    convert: (assignedTechnicianId?: string) => fetch(`http://127.0.0.1:${address.port}/enquiries/${enquiryId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: "customer-1",
        property_id: "property-1",
        job_type: "service",
        scheduled_date: "2026-10-26",
        scheduled_time: "09:00",
        assigned_technician_id: assignedTechnicianId,
      }),
    }),
  };
}

test("Enquiry conversion persists the selected engineer on the new job", async t => {
  const { convert, writes } = await withConversionEndpoint(t);
  const response = await convert(engineerId);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    enquiry_id: enquiryId,
    job_id: jobId,
    customer_id: "customer-1",
    property_id: "property-1",
  });
  assert.equal(writes.find(write => write.table === "jobs")?.body.assigned_technician_id, engineerId);
  assert.equal(writes.find(write => write.table === "enquiries")?.body.linked_job_id, jobId);
});

test("Enquiry conversion can still create an unassigned job", async t => {
  const { convert, writes } = await withConversionEndpoint(t);
  const response = await convert();
  assert.equal(response.status, 201);
  assert.equal(writes.find(write => write.table === "jobs")?.body.assigned_technician_id, null);
});

test("Enquiry conversion rejects an engineer from another tenant before writing", async t => {
  const { convert, writes } = await withConversionEndpoint(t, true);
  const response = await convert(engineerId);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Invalid reference: profiles does not belong to your organisation",
  });

  assert.equal(writes.length, 0);
});

test("Enquiry conversion alerts on a 9am clash before creating any records", async t => {
  const { convert, writes } = await withConversionEndpoint(t, false, true);
  const response = await convert(engineerId);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "This technician already has job JOB-0026 at 09:00 on 2026-10-26.",
    code: "TECHNICIAN_JOB_CLASH",
    conflict: {
      existing_job_id: "existing-job",
      existing_job_ref: "JOB-0026",
      scheduled_date: "2026-10-26",
      scheduled_time: "09:00:00",
      estimated_duration: 180,
    },
  });
  assert.equal(writes.length, 0);
});
