import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";

process.env.SUPABASE_URL = "https://job-clash-routes-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "job-clash-routes-test-key";

const { default: jobsRouter } = await import("./jobs");
const { default: followUpsRouter } = await import("./follow-ups");
const tenantId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const engineerId = "33333333-3333-4333-8333-333333333333";
const customerId = "44444444-4444-4444-8444-444444444444";
const propertyId = "55555555-5555-4555-8555-555555555555";

async function requestClashingBooking(
  t: TestContext,
  action: "create" | "reschedule" | "follow-up" | "rebook",
  options: { existingAllDay?: boolean; newAllDay?: boolean; onlyAllDayChanging?: boolean; allowJobClash?: boolean | string; leave?: boolean; bookableLeave?: "all-day" | "overlapping" | "adjacent"; allowLeaveClash?: boolean; expectLeaveWarning?: boolean } = {},
) {
  const date = options.existingAllDay || options.newAllDay ? "2026-10-27" : "2026-10-26";
  let jobWrites = 0;
  let clashChecks = 0;
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (...[input, init]: Parameters<typeof fetch>) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "job-clash-routes-test.invalid");
    const table = url.pathname.split("/").pop();
    let data: unknown = [];
    if (table === "tenants") data = { status: "active", plans: { max_users: 2 } };
    else if (table === "profiles" || table === "customers" || table === "properties") data = { tenant_id: tenantId };
    else if (table === "company_settings") data = { job_number_next: 1, job_number_prefix: "JOB" };
    else if (table === "calendar_holidays") data = [
      ...(options.bookableLeave ? [{
        technician_id: engineerId, holiday_type: "technician_leave", name: "Working from home",
        start_date: date, end_date: date, allow_bookings: true,
        start_time: options.bookableLeave === "all-day" ? null : options.bookableLeave === "adjacent" ? "12:00" : "10:00",
        end_time: options.bookableLeave === "all-day" ? null : "13:00",
      }] : []),
      ...(options.leave ? [{
        technician_id: engineerId, holiday_type: "technician_leave", name: "Annual leave",
        start_date: date, end_date: date, start_time: null, end_time: null, allow_bookings: false,
      }] : []),
    ];
    else if (table === "follow_ups") data = {
      id: jobId, tenant_id: tenantId, status: "open", customer_id: customerId, property_id: propertyId,
      original_job_id: jobId, original_job: { id: jobId, estimated_duration: 180 },
    };
    else if (table === "jobs" || table === "job_schedule_entries") {
      if (init?.method === "POST" || init?.method === "PATCH") jobWrites++;
      if (url.searchParams.has("assigned_technician_id")) {
        clashChecks++;
        assert.equal(url.searchParams.get("scheduled_date"), `lte.${date}`);
        data = [{
          id: "existing-job", job_ref: "JOB-0026", scheduled_date: date,
          scheduled_time: options.existingAllDay ? null : "09:00:00",
          all_day: options.existingAllDay === true, estimated_duration: 180, status: "scheduled",
        }];
      } else if (init?.method === "POST") {
        const inserted = JSON.parse(String(init.body));
        assert.equal("allow_job_clash" in inserted, false);
        assert.equal("allow_leave_clash" in inserted, false);
        data = { id: jobId };
      } else if (url.searchParams.get("id") === `eq.${jobId}`) data = {
        assigned_technician_id: engineerId, scheduled_date: options.onlyAllDayChanging ? date : "2026-10-25",
        scheduled_time: options.onlyAllDayChanging || options.newAllDay ? "14:00:00" : "09:00:00",
        scheduled_end_date: null, estimated_duration: 180, all_day: options.newAllDay === true,
      };
    } else assert.fail(`Unexpected database access: ${table}`);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": "0-1/2" },
    });
  });

  const path = action === "create" ? "/jobs" : action === "reschedule" ? "/jobs/:id"
    : action === "rebook" ? "/jobs/:id/duplicate" : "/follow-ups/:id/convert-to-job";
  const router = action === "follow-up" ? followUpsRouter : jobsRouter;
  const layer = router.stack.find(layer => layer.route?.path === path && layer.route.stack.some(
    (entry: { method?: string }) => entry.method === (action === "reschedule" ? "patch" : "post"),
  ));
  assert.ok(layer?.route);
  const handler: RequestHandler = layer.route.stack[layer.route.stack.length - 1].handle;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { tenantId, userId: engineerId, userRole: "admin" });
    next();
  });
  app[action === "reschedule" ? "patch" : "post"](path, handler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}${path.replace(":id", jobId)}`, {
    method: action === "reschedule" ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options.onlyAllDayChanging ? { all_day: true } : {
      scheduled_date: date,
      scheduled_time: options.newAllDay ? undefined : options.existingAllDay ? "14:00" : "09:00",
      estimated_duration: 180,
      allow_job_clash: options.allowJobClash,
      allow_leave_clash: options.allowLeaveClash,
      ...(options.newAllDay ? { all_day: true } : {}),
      ...(action === "reschedule" ? {} : {
        customer_id: customerId, property_id: propertyId, job_type: "service", assigned_technician_id: engineerId,
      }),
    }),
  });
  if (action === "create" && options.allowJobClash === true && !options.leave && !options.expectLeaveWarning) {
    assert.equal(response.status, 201, await response.clone().text());
    assert.deepEqual(await response.json(), { id: jobId });
    assert.equal(clashChecks, 1);
    assert.equal(jobWrites, 1);
    return;
  }
  assert.equal(response.status, 409, await response.clone().text());
  const body = await response.json() as { code?: string; error?: string; can_book_anyway?: boolean; conflict?: { holiday_name?: string } };
  const leaveConflict = options.leave || options.expectLeaveWarning;
  assert.equal(body.code, leaveConflict ? "TECHNICIAN_LEAVE_CONFLICT" : "TECHNICIAN_JOB_CLASH");
  assert.equal(body.can_book_anyway, options.expectLeaveWarning ? true : undefined);
  if (options.expectLeaveWarning) assert.equal(body.conflict?.holiday_name, "Working from home");
  if (options.leave) assert.equal(body.conflict?.holiday_name, "Annual leave");
  if (options.existingAllDay) {
    assert.ok("error" in body && typeof body.error === "string");
    assert.match(body.error, /booked all day on 2026-10-27/);
  }
  assert.equal(clashChecks, leaveConflict ? 0 : 1);
  assert.equal(jobWrites, 0);
}

test("Booking a job at 9am on Monday 26 October alerts before inserting", async t => {
  await requestClashingBooking(t, "create");
});

test("Rescheduling onto Monday's occupied 9am slot alerts before updating", async t => {
  await requestClashingBooking(t, "reschedule");
});

test("Converting a follow-up onto Monday's occupied 9am slot alerts before inserting", async t => {
  await requestClashingBooking(t, "follow-up");
});

test("A 2pm job cannot be created over Tuesday's all-day job", async t => {
  await requestClashingBooking(t, "create", { existingAllDay: true });
});

test("A job cannot be rescheduled to 2pm over Tuesday's all-day job", async t => {
  await requestClashingBooking(t, "reschedule", { existingAllDay: true });
});

test("A follow-up cannot be booked over Tuesday's all-day job", async t => {
  await requestClashingBooking(t, "follow-up", { existingAllDay: true });
});

test("A new all-day job cannot be created over an existing timed appointment", async t => {
  await requestClashingBooking(t, "create", { newAllDay: true });
});

test("Changing only the all-day flag still checks existing appointments", async t => {
  await requestClashingBooking(t, "reschedule", { newAllDay: true, onlyAllDayChanging: true });
});

test("Rebooking a timed job over Tuesday's all-day job reports the clash", async t => {
  await requestClashingBooking(t, "rebook", { existingAllDay: true });
});

test("Rebooking an all-day job still reserves working hours even with a saved time", async t => {
  await requestClashingBooking(t, "rebook", { newAllDay: true });
});

test("An explicit override allows a new clashing job to be saved", async t => {
  await requestClashingBooking(t, "create", { allowJobClash: true });
});

test("A string override does not bypass job clash protection", async t => {
  await requestClashingBooking(t, "create", { allowJobClash: "true" });
});

test("A job clash override does not bypass technician leave", async t => {
  await requestClashingBooking(t, "create", { allowJobClash: true, leave: true });
});

test("A new-booking override cannot bypass rescheduling protection", async t => {
  await requestClashingBooking(t, "reschedule", { allowJobClash: true });
});

test("Book Job warns before saving over all-day or overlapping timed leave that allows bookings", async t => {
  for (const bookableLeave of ["all-day", "overlapping"] as const) {
    await t.test(bookableLeave, test => requestClashingBooking(test, "create", {
      bookableLeave, allowLeaveClash: false, allowJobClash: true, expectLeaveWarning: true,
    }));
  }
});

test("Acknowledged leave and adjacent timed leave still permit booking", async t => {
  await t.test("confirmed overlap", test => requestClashingBooking(test, "create", {
    bookableLeave: "overlapping", allowLeaveClash: true, allowJobClash: true,
  }));
  await t.test("job ends when leave starts", test => requestClashingBooking(test, "create", {
    bookableLeave: "adjacent", allowLeaveClash: false, allowJobClash: true,
  }));
});

test("The leave override cannot bypass non-bookable leave even with a bookable clash", async t => {
  await requestClashingBooking(t, "create", {
    bookableLeave: "all-day", leave: true, allowLeaveClash: true, allowJobClash: true,
  });
});
