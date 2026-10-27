import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://visits-calendar-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "visits-calendar-test-key";
const { default: calendarRouter, invalidateCalendarCache } = await import("./calendar");
const { bookingRouter } = await import("./booking");
const { default: homepageRouter, invalidateHomepageCache } = await import("./homepage");
const { businessToday, addBusinessDays } = await import("../lib/business-date");
const tenantId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const engineerId = "33333333-3333-4333-8333-333333333333";
const primary = {
  id: jobId, scheduled_date: "2026-11-12", scheduled_time: "09:00", scheduled_end_date: null,
  estimated_duration: 120, all_day: false, status: "scheduled", job_type: "installation",
  assigned_technician_id: engineerId, customer_confirmation_status: "confirmed",
  customers: { first_name: "Test", last_name: "Customer" },
};
const visits = [
  { id: "visit-nov16", job_id: jobId, scheduled_date: "2026-11-16", scheduled_time: "14:00", all_day: false, estimated_duration: 120, assigned_technician_id: engineerId },
  { id: "visit-dec05", job_id: jobId, scheduled_date: "2026-12-05", scheduled_time: null, all_day: true, estimated_duration: null, assigned_technician_id: engineerId },
];

async function start(t: TestContext, options: { booking?: boolean; homepage?: boolean; tech?: boolean; fail?: boolean; extendedHours?: boolean } = {}) {
  invalidateCalendarCache();
  invalidateHomepageCache();
  const calls: URL[] = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "visits-calendar-test.invalid");
    calls.push(url);
    const table = url.pathname.split("/").pop();
    let data: unknown = [];
    if (table === "jobs") {
      const to = url.searchParams.get("scheduled_date")?.slice(4) || "";
      const from = url.searchParams.get("or")?.split("scheduled_date.gte.")[1]?.slice(0, 10) || "";
      data = !options.homepage && primary.scheduled_date >= from && primary.scheduled_date <= to ? [primary] : [];
    } else if (table === "job_visits") {
      if (options.fail) return Response.json({ message: "Visit storage unavailable" }, { status: 500 });
      const bounds = url.searchParams.getAll("scheduled_date");
      const from = bounds.find(v => v.startsWith("gte."))?.slice(4) || "";
      const to = bounds.find(v => v.startsWith("lte."))?.slice(4) || "";
      const parent = options.homepage ? {
        ...primary, job_type: "service", customer_id: tenantId, property_id: tenantId,
        priority: "medium", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        scheduled_date: addBusinessDays(businessToday(), -2),
      } : primary;
      const dates = options.homepage ? [
        { ...visits[0], scheduled_date: businessToday(), scheduled_time: "14:00" },
        { ...visits[0], id: "later-today", scheduled_date: businessToday(), scheduled_time: "16:00" },
        { ...visits[0], scheduled_date: addBusinessDays(businessToday(), 1) },
      ] : visits.filter(v => v.scheduled_date >= from && v.scheduled_date <= to);
      data = dates.map(v => ({ ...v, profiles: { full_name: "Visit Engineer" }, jobs: parent }));
    } else if (table === "profiles") data = [{ id: engineerId, full_name: "Visit Engineer" }];
    else if (table === "booking_settings") data = {
      is_enabled: true, working_hours: Array.from({ length: 7 }, (_, day) => ({
        day, start: options.extendedHours ? "07:00" : "09:00", end: options.extendedHours ? "19:00" : "17:00",
      })),
      slot_duration_minutes: 60, buffer_between_minutes: 0, min_advance_hours: 0, max_advance_days: 365,
    };
    else if (table === "job_schedule_entries") {
      assert.equal(url.searchParams.get("is_active"), "eq.true");
      if (options.fail) return Response.json({ message: "Visit storage unavailable" }, { status: 500 });
      data = [{ ...visits[1], scheduled_end_date: null, status: "scheduled" }];
    }
    return Response.json(data);
  });
  const path = options.booking ? "/booking/slots" : options.homepage ? "/homepage" : "/calendar";
  const router = options.booking ? bookingRouter : options.homepage ? homepageRouter : calendarRouter;
  const route = router.stack.find(layer => layer.route?.path === path)?.route;
  assert.ok(route);
  const handler: RequestHandler = route.stack[route.stack.length - 1].handle;
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userId: engineerId, userRole: options.tech ? "technician" : "admin" });
    next();
  });
  app.get(path, handler);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: err.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { calls, url: `http://127.0.0.1:${address.port}${path}` };
}

test("Calendar shows distinct visits linked to the original job without spanning gaps", async t => {
  const { url, calls } = await start(t);
  const response = await fetch(`${url}?date_from=2026-11-12&date_to=2026-12-05`);
  assert.equal(response.status, 200);
  const body = await response.json() as { jobs: Array<{ id: string; job_id?: string; visit_id?: string; scheduled_date: string; scheduled_end_date: string | null; customer_confirmation_status: string | null }> };
  assert.deepEqual(body.jobs.map(j => j.scheduled_date), ["2026-11-12", "2026-11-16", "2026-12-05"]);
  assert.equal(new Set(body.jobs.map(j => j.id)).size, 3);
  for (const visit of body.jobs.filter(j => j.visit_id)) {
    assert.equal(visit.job_id, jobId);
    assert.equal(visit.scheduled_end_date, null);
    assert.equal(visit.customer_confirmation_status, null);
  }
  assert.equal(calls.find(c => c.pathname.endsWith("job_visits"))?.searchParams.get("jobs.tenant_id"), `eq.${tenantId}`);
});

test("Visits appear when the job's primary date is outside the calendar range", async t => {
  const { url } = await start(t);
  const response = await fetch(`${url}?date_from=2026-12-01&date_to=2026-12-05`);
  const body = await response.json() as { jobs: Array<{ visit_id?: string }> };
  assert.deepEqual(body.jobs.map(j => j.visit_id), ["visit-dec05"]);
});

test("Dates between visits have no calendar reservation for the job", async t => {
  const { url } = await start(t);
  const response = await fetch(`${url}?date_from=2026-11-17&date_to=2026-12-04`);
  const body = await response.json() as { jobs: unknown[] };
  assert.deepEqual(body.jobs, []);
});

test("Technician calendars filter visits by that visit's assigned engineer", async t => {
  const { url, calls } = await start(t, { tech: true });
  await fetch(`${url}?date_from=2026-11-12&date_to=2026-12-05`);
  const query = calls.find(c => c.pathname.endsWith("job_visits"));
  assert.equal(query?.searchParams.get("assigned_technician_id"), `eq.${engineerId}`);
  assert.equal(query?.searchParams.has("jobs.assigned_technician_id"), false);
});

test("Calendar fails visibly rather than silently omitting visits", async t => {
  const { url } = await start(t, { fail: true });
  assert.equal((await fetch(url)).status, 500);
});

test("Online booking reserves an all-day additional visit but leaves other dates available", async t => {
  const { url, calls } = await start(t, { booking: true });
  const response = await fetch(`${url}?from=2026-12-04&to=2026-12-06`);
  assert.equal(response.status, 200, await response.clone().text());
  const slots = await response.json() as Array<{ start: string }>;
  assert.ok(slots.some(s => s.start.startsWith("2026-12-04")));
  assert.ok(slots.some(s => s.start.startsWith("2026-12-06")));
  assert.equal(slots.some(s => s.start.startsWith("2026-12-05")), false);
  assert.ok(calls.some(c => c.pathname.endsWith("job_schedule_entries")));
});

test("Online booking allows slots before 08:00 and from 17:00 around an all-day visit", async t => {
  const { url } = await start(t, { booking: true, extendedHours: true });
  const response = await fetch(`${url}?from=2026-12-05&to=2026-12-05`);
  assert.equal(response.status, 200);
  const slots = await response.json() as Array<{ start: string }>;
  assert.deepEqual(slots.map(slot => slot.start.slice(11, 16)), ["07:00", "17:00", "18:00"]);
});

test("Online booking does not offer slots if visit availability cannot be checked", async t => {
  const { url } = await start(t, { booking: true, fail: true });
  assert.equal((await fetch(`${url}?from=2026-12-04&to=2026-12-06`)).status, 500);
});

test("Dashboard includes today's and upcoming visits without counting the same job twice", async t => {
  const { url } = await start(t, { homepage: true });
  const response = await fetch(url);
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json() as {
    dashboard: {
      todays_jobs: Array<{ id: string; scheduled_time: string }>;
      upcoming_jobs: Array<{ id: string; scheduled_date: string }>;
      stats: { total_jobs_today: number };
    };
  };
  assert.deepEqual(body.dashboard.todays_jobs.map(j => [j.id, j.scheduled_time]), [[jobId, "14:00"]]);
  assert.equal(body.dashboard.stats.total_jobs_today, 1);
  assert.deepEqual(body.dashboard.upcoming_jobs.map(j => j.id), [jobId]);
});
