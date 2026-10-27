import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { CreateJobBody, UpdateJobBody } from "@workspace/api-zod";

process.env.SUPABASE_URL = "https://job-clashes-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "job-clashes-test-key";

const { findTechnicianJobClash } = await import("./technician-job-clashes");
const existingJob = {
  id: "existing-job",
  job_ref: "JOB-0026",
  scheduled_date: "2026-10-26",
  scheduled_time: "09:00:00",
  scheduled_end_date: null as string | null,
  all_day: false,
  estimated_duration: 180,
  status: "scheduled",
};
const appointment = {
  tenantId: "tenant-1",
  technicianId: "engineer-1",
  scheduledDate: "2026-10-26",
  scheduledTime: "09:00",
  estimatedDuration: 60,
};

function mockJobs(t: TestContext, jobs: Array<Omit<typeof existingJob, "scheduled_time"> & { scheduled_time: string | null; job_id?: string }> = [existingJob], fail = false) {
  const calls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url);
    assert.equal(url.hostname, "job-clashes-test.invalid");
    return Response.json(fail ? { message: "Database unavailable", code: "XX000" } : jobs, { status: fail ? 500 : 200 });
  });
  return calls;
}

test("New-job schema dates are normalised before checking Monday's 9am bookings", async t => {
  const calls = mockJobs(t);
  const parsed = CreateJobBody.parse({
    customer_id: "11111111-1111-4111-8111-111111111111",
    property_id: "22222222-2222-4222-8222-222222222222",
    job_type: "service",
    scheduled_date: "2026-10-26",
  });
  assert.ok(parsed.scheduled_date instanceof Date);
  const clash = await findTechnicianJobClash({ ...appointment, scheduledDate: parsed.scheduled_date });
  assert.equal(clash?.existing_job_id, existingJob.id);
  assert.equal(calls[0].pathname, "/rest/v1/job_schedule_entries");
  assert.equal(calls[0].searchParams.get("tenant_id"), "eq.tenant-1");
  assert.equal(calls[0].searchParams.get("assigned_technician_id"), "eq.engineer-1");
  assert.equal(calls[0].searchParams.get("is_active"), "eq.true");
  assert.equal(calls[0].searchParams.get("scheduled_date"), "lte.2026-10-26");
  assert.equal(calls[0].searchParams.get("or"), "(scheduled_end_date.gte.2026-10-26,and(scheduled_end_date.is.null,scheduled_date.gte.2026-10-26))");
  assert.equal(calls[0].searchParams.get("status"), "not.in.(cancelled,completed,invoiced)");
});

test("Rescheduling schema dates and legacy Date strings both check the correct day", async t => {
  mockJobs(t);
  const parsed = UpdateJobBody.parse({ scheduled_date: "2026-10-26" });
  const clash = await findTechnicianJobClash({ ...appointment, scheduledDate: String(parsed.scheduled_date) });
  assert.equal(clash?.existing_job_id, existingJob.id);
});

test("A booking within an existing three-hour visit clashes", async t => {
  mockJobs(t);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: "11:30" }));
});

test("A booking starting earlier but running into the existing visit clashes", async t => {
  mockJobs(t);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: "08:30" }));
});

test("Back-to-back appointments do not clash", async t => {
  mockJobs(t);
  assert.equal(await findTechnicianJobClash({ ...appointment, scheduledTime: "12:00" }), null);
  assert.equal(await findTechnicianJobClash({ ...appointment, scheduledTime: "08:00" }), null);
});

test("Rescheduling excludes the job being edited", async t => {
  const calls = mockJobs(t, []);
  assert.equal(await findTechnicianJobClash({ ...appointment, excludeJobId: "current-job" }), null);
  assert.equal(calls[0].searchParams.get("id"), "neq.current-job");
});

test("Database failures stop booking instead of reporting no clash", async t => {
  mockJobs(t, [], true);
  await assert.rejects(findTechnicianJobClash(appointment), /Unable to check appointment clashes/);
});

test("Missing duration uses the existing one-hour fallback", async t => {
  mockJobs(t, [{ ...existingJob, estimated_duration: 0 }]);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: "09:30", estimatedDuration: null }));
});

test("Unassigned bookings do not reserve an engineer", async t => {
  const calls = mockJobs(t);
  assert.equal(await findTechnicianJobClash({ ...appointment, technicianId: null }), null);
  assert.equal(calls.length, 0);
});

test("A clash with an additional visit identifies its parent job", async t => {
  mockJobs(t, [{ ...existingJob, id: "extra-visit", job_id: "parent-job" }]);
  assert.equal((await findTechnicianJobClash(appointment))?.existing_job_id, "parent-job");
});

test("Non-consecutive visit dates do not reserve days between visits", async t => {
  mockJobs(t, [
    { ...existingJob, scheduled_date: "2026-11-16" },
    { ...existingJob, scheduled_date: "2026-12-05" },
  ]);
  assert.equal(await findTechnicianJobClash({ ...appointment, scheduledDate: "2026-11-20" }), null);
});

test("Tuesday 27 October's all-day job clashes with a 2pm appointment", async t => {
  const calls = mockJobs(t, [{ ...existingJob, scheduled_date: "2026-10-27", scheduled_time: null, all_day: true }]);
  const clash = await findTechnicianJobClash({ ...appointment, scheduledDate: "2026-10-27", scheduledTime: "14:00" });
  assert.equal(clash?.existing_job_id, existingJob.id);
  assert.equal(clash.scheduled_time, null);
  assert.equal(calls[0].searchParams.get("scheduled_time"), null);
});

test("An all-day booking clashes with an existing 2pm job", async t => {
  mockJobs(t, [{ ...existingJob, scheduled_time: "14:00:00" }]);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: null, allDay: true }));
});

test("An all-day flag takes precedence over a leftover appointment time", async t => {
  mockJobs(t, [{ ...existingJob, scheduled_time: "14:00:00" }]);
  assert.ok(await findTechnicianJobClash({ ...appointment, allDay: true }));
});

test("Legacy untimed jobs also reserve working hours", async t => {
  mockJobs(t, [{ ...existingJob, scheduled_time: null }]);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: "14:00" }));
});

test("All-day jobs reserve exactly 08:00 to 17:00", async t => {
  mockJobs(t, [{ ...existingJob, all_day: true, scheduled_time: null }]);
  assert.equal(await findTechnicianJobClash({ ...appointment, scheduledTime: "07:00" }), null);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: "07:30" }));
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: "08:00" }));
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: "16:59" }));
  assert.equal(await findTechnicianJobClash({ ...appointment, scheduledTime: "17:00" }), null);
  assert.equal(await findTechnicianJobClash({ ...appointment, scheduledTime: "18:00" }), null);
});

test("Multi-day all-day jobs leave evenings free on intermediate days", async t => {
  mockJobs(t, [{
    ...existingJob, scheduled_end_date: "2026-10-28", all_day: true, scheduled_time: null,
  }]);
  assert.equal(await findTechnicianJobClash({
    ...appointment, scheduledDate: "2026-10-27", scheduledTime: "18:00",
  }), null);
  assert.ok(await findTechnicianJobClash({
    ...appointment, scheduledDate: "2026-10-27", scheduledTime: "16:30",
  }));
});

test("New all-day ranges allow existing evening jobs", async t => {
  mockJobs(t, [{ ...existingJob, scheduled_date: "2026-10-27", scheduled_time: "18:00" }]);
  assert.equal(await findTechnicianJobClash({
    ...appointment, scheduledEndDate: "2026-10-28", allDay: true,
  }), null);
});

test("New untimed jobs check existing appointments rather than bypassing clashes", async t => {
  mockJobs(t);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledTime: null }));
});

test("A multi-day all-day job blocks appointments on its final day", async t => {
  const calls = mockJobs(t, [{
    ...existingJob, scheduled_date: "2026-10-26", scheduled_end_date: "2026-10-28",
    all_day: true, scheduled_time: null,
  }]);
  assert.ok(await findTechnicianJobClash({ ...appointment, scheduledDate: "2026-10-28", scheduledTime: "14:00" }));
  assert.equal(calls[0].searchParams.get("scheduled_date"), "lte.2026-10-28");
});

test("A new multi-day job checks appointments throughout its date range", async t => {
  const calls = mockJobs(t, [{ ...existingJob, scheduled_date: "2026-10-27", scheduled_time: "14:00:00" }]);
  assert.ok(await findTechnicianJobClash({
    ...appointment, scheduledEndDate: "2026-10-28", scheduledTime: null, allDay: true,
  }));
  assert.equal(calls[0].searchParams.get("scheduled_date"), "lte.2026-10-28");
});

test("Adjacent all-day date ranges do not clash", async t => {
  mockJobs(t, [{ ...existingJob, all_day: true, scheduled_time: null }]);
  assert.equal(await findTechnicianJobClash({ ...appointment, scheduledDate: "2026-10-27", allDay: true }), null);
});
