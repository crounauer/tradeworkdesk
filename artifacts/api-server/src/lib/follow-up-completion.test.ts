import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://follow-up-completion.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
const { finishFollowUpsForJob } = await import("./follow-up-completion");

test("closing a return job completes its original only when the last open follow-up is closed", async t => {
  let booked = true;
  let siblingOpen = true;
  let originalStatus = "follow_up_scheduled";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://follow-up-completion.test");
    assert.equal(url.searchParams.get("tenant_id"), "eq.tenant");
    const patch = init?.method === "PATCH";
    if (url.pathname.endsWith("/follow_ups") && url.searchParams.has("new_job_id")) {
      assert.equal(url.searchParams.get("new_job_id"), "eq.return");
      if (!patch) return Response.json([{ id: "linked", original_job_id: "original" }]);
      assert.equal(url.searchParams.get("status"), "eq.booked");
      assert.equal(JSON.parse(String(init?.body)).status, "completed");
      booked = false;
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/follow_ups")) {
      assert.equal(url.searchParams.get("original_job_id"), "eq.original");
      assert.equal(url.searchParams.get("status"), "in.(awaiting_parts,parts_arrived,booked)");
      return Response.json(siblingOpen || booked ? [{ id: "open" }] : []);
    }
    assert.equal(url.pathname, "/rest/v1/jobs");
    assert.equal(url.searchParams.get("id"), "eq.original");
    assert.equal(url.searchParams.get("status"), "eq.follow_up_scheduled");
    if (originalStatus === "follow_up_scheduled") originalStatus = JSON.parse(String(init?.body)).status;
    return new Response(null, { status: 204 });
  });

  await finishFollowUpsForJob("tenant", "return");
  assert.equal(booked, false);
  assert.equal(originalStatus, "follow_up_scheduled");
  siblingOpen = false;
  await finishFollowUpsForJob("tenant", "return");
  assert.equal(originalStatus, "completed");
  originalStatus = "invoiced";
  await finishFollowUpsForJob("tenant", "return");
  assert.equal(originalStatus, "invoiced");
});
