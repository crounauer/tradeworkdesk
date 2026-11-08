import assert from "node:assert/strict";
import test from "node:test";
import { DATABASE_REQUEST_TIMEOUT_MS, fetchWithDatabaseTimeout } from "./database-fetch";

test("database timeout leaves authentication and storage requests unchanged", async t => {
  const calls: Array<RequestInit | undefined> = [];
  t.mock.method(globalThis, "fetch", async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push(init);
    return Response.json({});
  });
  const init = { method: "POST", body: "test" };
  await fetchWithDatabaseTimeout("https://db.example/auth/v1/token", init);
  await fetchWithDatabaseTimeout("https://db.example/storage/v1/object/test", init);
  assert.deepEqual(calls, [init, init]);
});

test("database requests preserve headers and body without retrying mutations", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls++;
    assert.equal(init?.method, "POST");
    assert.equal(init?.body, '{"test":true}');
    assert.deepEqual(init?.headers, { apikey: "test" });
    assert.ok(init?.signal);
    return Response.json({ message: "Failed" }, { status: 503 });
  });
  const response = await fetchWithDatabaseTimeout("https://db.example/rest/v1/rpc/test", {
    method: "POST", body: '{"test":true}', headers: { apikey: "test" },
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test("caller abort propagates from Request and RequestInit", async t => {
  t.mock.method(globalThis, "fetch", async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    return Response.json({});
  });
  const controller = new AbortController();
  controller.abort(new Error("Caller cancelled"));
  await assert.rejects(fetchWithDatabaseTimeout("https://db.example/rest/v1/jobs", { signal: controller.signal }), /Caller cancelled/);
  await assert.rejects(fetchWithDatabaseTimeout(new Request("https://db.example/rest/v1/jobs", { signal: controller.signal })), /Caller cancelled/);
});

test("a stalled database request aborts at the 30-second deadline", async t => {
  assert.equal(DATABASE_REQUEST_TIMEOUT_MS, 30_000);
  const keepAlive = setTimeout(() => {}, 35_000);
  t.after(() => clearTimeout(keepAlive));
  t.mock.method(globalThis, "fetch", (_input: Parameters<typeof fetch>[0], init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    assert.ok(init?.signal);
    init.signal.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  const started = Date.now();
  await assert.rejects(fetchWithDatabaseTimeout("https://db.example/rest/v1/jobs"), { name: "TimeoutError" });
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 29_900 && elapsed < 33_000, `Actual timeout: ${elapsed}ms`);
});
