import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";
import { DashboardResponse } from "../lib/dashboard-response";

process.env.SUPABASE_URL = "https://follow-up-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "follow-up-test-key";

const { default: router } = await import("./follow-ups");
const tenantId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const propertyId = "33333333-3333-4333-8333-333333333333";
const jobId = "44444444-4444-4444-8444-444444444444";
const followUpId = "55555555-5555-4555-8555-555555555555";

async function request(t: TestContext, method: "post" | "delete", path: string, body: object, database: (url: URL, init?: RequestInit) => unknown) {
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (...[input, init]: Parameters<typeof fetch>) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "follow-up-test.invalid");
    const result = database(url, init);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const layer = router.stack.find(item => item.route?.path === path && item.route.stack.some(
    (entry: { method?: string }) => entry.method === method,
  ));
  assert.ok(layer?.route);
  const handler: RequestHandler = layer.route.stack[layer.route.stack.length - 1].handle;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, { tenantId, userId: jobId }); next(); });
  app[method](path, handler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return fetch(`http://127.0.0.1:${address.port}${path.replace(":id", followUpId)}`, {
    method: method.toUpperCase(), headers: { "Content-Type": "application/json" }, body: method === "post" ? JSON.stringify(body) : undefined,
  });
}

test("creates an unscheduled customer follow-up with no property or delivery date", async t => {
  let inserted: Record<string, unknown> | undefined;
  const res = await request(t, "post", "/follow-ups", {
    customer_id: customerId, parts_required: true, parts_description: "Pump",
  }, (url, init) => {
    const table = url.pathname.split("/").pop();
    if (table === "customers") {
      assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
      return { id: customerId };
    }
    if (table === "follow_ups") {
      inserted = JSON.parse(String(init?.body));
      return { id: followUpId };
    }
    assert.fail(`Unexpected table ${table}`);
  });
  assert.equal(res.status, 201, await res.clone().text());
  assert.equal(inserted?.original_job_id, null);
  assert.equal(inserted?.tenant_id, tenantId);
  assert.equal(inserted?.property_id, null);
  assert.equal(inserted?.expected_parts_date, null);
  assert.equal(inserted?.status, "awaiting_parts");
});

test("rejects a property that does not belong to the customer", async t => {
  const res = await request(t, "post", "/follow-ups", {
    customer_id: customerId, property_id: propertyId, parts_required: true, parts_description: "Pump",
  }, url => {
    const table = url.pathname.split("/").pop();
    if (table === "customers") return { id: customerId };
    if (table === "properties") {
      assert.equal(url.searchParams.get("customer_id"), `eq.${customerId}`);
      assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
      return null;
    }
    assert.fail(`Unexpected table ${table}`);
  });
  assert.equal(res.status, 400, await res.clone().text());
});

test("rejects an original job belonging to a different customer", async t => {
  const res = await request(t, "post", "/follow-ups", { customer_id: customerId, original_job_id: jobId }, url => {
    assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
    return { id: jobId, customer_id: propertyId, property_id: propertyId, status: "invoiced" };
  });
  assert.equal(res.status, 400, await res.clone().text());
});

test("links an invoiced job without changing it", async t => {
  let inserted: Record<string, unknown> | undefined;
  const res = await request(t, "post", "/follow-ups", {
    customer_id: customerId, original_job_id: jobId, parts_required: true, parts_description: "Pump",
  }, (url, init) => {
    const table = url.pathname.split("/").pop();
    if (table === "jobs") {
      assert.equal(init?.method || "GET", "GET");
      return { id: jobId, customer_id: customerId, property_id: propertyId, status: "invoiced" };
    }
    if (table === "follow_ups" && init?.method === "POST") {
      inserted = JSON.parse(String(init.body));
      return { id: followUpId };
    }
    if (table === "follow_ups") return [];
    assert.fail(`Unexpected table ${table}`);
  });
  assert.equal(res.status, 201, await res.clone().text());
  assert.equal(inserted?.original_job_id, jobId);
  assert.equal(inserted?.property_id, propertyId);
});

for (const originalStatus of [null, "invoiced"] as const) {
  test(`books a ${originalStatus || "standalone"} follow-up without copying old billing entries`, async t => {
    let parts: Array<Record<string, unknown>> = [];
    let bookedProperty: unknown;
    const res = await request(t, "post", "/follow-ups/:id/convert-to-job", {
      scheduled_date: "2026-11-20", property_id: propertyId, carry_forward_services: true, carry_forward_time_entries: true,
    }, (url, init) => {
      const table = url.pathname.split("/").pop();
      const method = init?.method || "GET";
      if (table === "follow_ups" && method === "GET") return {
        id: followUpId, tenant_id: tenantId, customer_id: customerId,
        property_id: originalStatus ? propertyId : null, status: "parts_arrived", parts_description: "2 x Pump",
        original_job_id: originalStatus ? jobId : null,
        original_job: originalStatus ? { id: jobId, status: originalStatus, job_ref: "JOB-1" } : null,
      };
      if (table === "properties") {
        assert.equal(url.searchParams.get("customer_id"), `eq.${customerId}`);
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        return { id: propertyId };
      }
      if (table === "company_settings") return method === "GET" ? { job_number_next: 1 } : null;
      if (table === "jobs" && method === "POST") {
        bookedProperty = JSON.parse(String(init?.body)).property_id;
        return { id: jobId, job_ref: "JOB-0001", scheduled_date: "2026-11-20" };
      }
      if (table === "job_parts" && method === "POST") {
        parts = JSON.parse(String(init?.body));
        return null;
      }
      if (table === "follow_ups" && method === "PATCH") return null;
      assert.fail(`Unexpected database access: ${method} ${table}`);
    });
    assert.equal(res.status, 201, await res.clone().text());
    assert.equal(bookedProperty, propertyId);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].part_name, "Pump");
    assert.equal(parts[0].quantity, 2);
    const result = await res.json() as { copied: unknown };
    assert.deepEqual(result.copied, { parts: true, services: false, time_entries: false });
  });
}

test("deleting a standalone follow-up does not update a job", async t => {
  const res = await request(t, "delete", "/follow-ups/:id", {}, (url, init) => {
    assert.equal(url.pathname.split("/").pop(), "follow_ups");
    return init?.method === "DELETE" ? null : { id: followUpId, original_job_id: null };
  });
  assert.equal(res.status, 200, await res.clone().text());
  const result = await res.json() as { original_job_id: string | null };
  assert.equal(result.original_job_id, null);
});

test("deleting a follow-up cannot reopen an invoiced original job", async t => {
  const res = await request(t, "delete", "/follow-ups/:id", {}, (url, init) => {
    const table = url.pathname.split("/").pop();
    if (table === "follow_ups") return init?.method === "DELETE" ? null : { id: followUpId, original_job_id: jobId };
    if (table === "jobs") {
      assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
      assert.equal(url.searchParams.get("status"), "in.(awaiting_parts,requires_follow_up,follow_up_scheduled)");
      return null;
    }
    assert.fail(`Unexpected table ${table}`);
  });
  assert.equal(res.status, 200, await res.clone().text());
  const result = await res.json() as { original_job_id: string | null };
  assert.equal(result.original_job_id, null);
});

test("dashboard accepts a follow-up without a property", () => {
  const item = {
    id: followUpId, customer_id: customerId, property_id: null, job_type: "follow_up",
    status: "awaiting_parts", priority: "medium", scheduled_date: "2026-11-20",
    is_active: true, created_at: "2026-11-20", updated_at: "2026-11-20",
  };
  assert.equal(DashboardResponse.parse({ follow_up_required: [item] }).follow_up_required?.[0].property_id, null);
});
