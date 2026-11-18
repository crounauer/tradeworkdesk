import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.SUPABASE_URL = "https://calendar-leave-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-database-key";
const { default: router } = await import("./calendar");

test("recurring leave updates use the selected scope and never change booked dates in bulk", async t => {
  const tenantId = "tenant";
  const technicianId = "technician";
  const anchor = "selected";
  const group = "series";
  const date = "2026-11-18";
  const rows = [
    { id: "earlier", tenant_id: tenantId, technician_id: technicianId, recurrence_group_id: group, start_date: "2026-11-11" },
    { id: anchor, tenant_id: tenantId, technician_id: technicianId, recurrence_group_id: group, start_date: date },
    { id: "later", tenant_id: tenantId, technician_id: technicianId, recurrence_group_id: group, start_date: "2026-11-25" },
    { id: "one-off", tenant_id: tenantId, technician_id: technicianId, recurrence_group_id: null, start_date: date },
    { id: "other-person", tenant_id: tenantId, technician_id: "other", recurrence_group_id: group, start_date: date },
    { id: "other-tenant", tenant_id: "other", technician_id: technicianId, recurrence_group_id: group, start_date: date },
  ].map(row => ({ ...row, name: "Annual leave", holiday_type: "technician_leave", allow_bookings: false }));
  let affected: string[] = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.origin + url.pathname, "https://calendar-leave-test.invalid/rest/v1/calendar_holidays");
    const matching = rows.filter(row => Object.entries(row).every(([key, value]) => {
      const filter = url.searchParams.get(key);
      if (filter?.startsWith("eq.")) return value === filter.slice(3);
      if (filter?.startsWith("gte.")) return String(value) >= filter.slice(4);
      if (filter?.startsWith("in.")) return filter.slice(4, -1).split(",").includes(String(value));
      return true;
    }));
    if (init?.method !== "PATCH") return Response.json(matching[0] ?? null);
    for (const row of matching) Object.assign(row, JSON.parse(String(init.body)));
    affected = matching.map(row => row.id);
    return url.searchParams.has("select")
      ? Response.json(matching[0])
      : new Response(null, { status: 204, headers: { "content-range": `*/${matching.length}` } });
  });

  const route = router.stack.find(layer =>
    layer.route?.path === "/calendar/holidays/:id" && layer.route.stack.some(handler => handler.method === "patch"),
  )?.route;
  assert.ok(route);
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    Object.assign(req, { tenantId, userId: technicianId, userRole: "technician" });
    next();
  });
  app.patch("/calendar/holidays/:id", ...route.stack.slice(2).map(layer => layer.handle));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const update = (id: string, body: Record<string, unknown>) => fetch(`http://127.0.0.1:${address.port}/calendar/holidays/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  assert.equal((await update(anchor, { name: "One-day exception" })).status, 200);
  assert.deepEqual(affected, [anchor]);
  assert.deepEqual(await (await update(anchor, { edit_scope: "following", allow_bookings: true })).json(), { updated: 2 });
  assert.deepEqual(affected, [anchor, "later"]);
  assert.deepEqual(await (await update(anchor, { edit_scope: "all", holiday_type: "technician_away" })).json(), { updated: 3 });
  assert.deepEqual(affected, ["earlier", anchor, "later"]);
  assert.equal(rows[1].name, "One-day exception");
  assert.equal(rows[0].allow_bookings, false);
  assert.equal(rows[1].start_date, date);
  assert.equal((await update(anchor, { edit_scope: "all", start_date: "2026-11-19" })).status, 400);
  assert.equal((await update("one-off", { edit_scope: "all", name: "Invalid" })).status, 400);
  assert.equal((await update("other-person", { edit_scope: "following", name: "Invalid" })).status, 403);
});
