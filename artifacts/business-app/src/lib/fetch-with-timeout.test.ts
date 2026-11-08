import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTimeout, READ_REQUEST_TIMEOUT_MS } from "./fetch-with-timeout";

test("frontend reads fail at 15 seconds even if a fetch interceptor never settles", async t => {
  assert.equal(READ_REQUEST_TIMEOUT_MS, 15_000);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    signal = init?.signal;
    return new Promise<Response>(() => {});
  });
  const response = fetchWithTimeout("https://app.example/api/me/init");
  const rejected = assert.rejects(response, /taking too long/);
  t.mock.timers.tick(14_999);
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(signal?.aborted, true);
});

test("successful frontend reads retain the response and clear their deadline", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    signal = init?.signal;
    return Response.json({ ok: true });
  });
  const response = await fetchWithTimeout("https://app.example/api/calendar");
  assert.deepEqual(await response.json(), { ok: true });
  t.mock.timers.tick(15_000);
  assert.equal(signal?.aborted, false);
});

test("frontend reads preserve explicit cancellation", async t => {
  t.mock.method(globalThis, "fetch", async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    return Response.json({});
  });
  const controller = new AbortController();
  controller.abort(new Error("Cancelled"));
  await assert.rejects(fetchWithTimeout("https://app.example/api/calendar", { signal: controller.signal }), /Cancelled/);
});
