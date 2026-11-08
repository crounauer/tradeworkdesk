import assert from "node:assert/strict";
import test from "node:test";
import { createDatabaseReadinessCheck, databaseGuardedTask } from "./database-readiness";

test("readiness coalesces concurrent probes and caches successes for 15 seconds", async () => {
  let now = 0;
  let calls = 0;
  let resolveProbe: (() => void) | undefined;
  const check = createDatabaseReadinessCheck(
    () => { calls++; return new Promise<void>(resolve => { resolveProbe = resolve; }); },
    () => now,
    () => {},
  );
  const first = check();
  const second = check();
  assert.equal(first, second);
  resolveProbe!();
  assert.deepEqual(await first, { status: "ok", checkedAt: new Date(0).toISOString() });
  now = 14_999;
  await check();
  assert.equal(calls, 1);
  now = 15_000;
  const next = check();
  resolveProbe!();
  await next;
  assert.equal(calls, 2);
});

test("failures back off through 30/60/120/240/300 seconds and reset on recovery", async t => {
  t.mock.method(console, "error", () => {});
  let now = 0;
  let calls = 0;
  let failed = true;
  const reports: boolean[] = [];
  const check = createDatabaseReadinessCheck(async () => {
    calls++;
    if (failed) throw new Error("PGRST003");
  }, () => now, available => { reports.push(available); });
  assert.equal((await check()).status, "unavailable");
  for (const delay of [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]) {
    const before = calls;
    now += delay - 1;
    assert.equal((await check()).status, "unavailable");
    assert.equal(calls, before);
    now += 1;
    assert.equal((await check()).status, "unavailable");
    assert.equal(calls, before + 1);
  }
  assert.deepEqual(reports, [false]);
  failed = false;
  now += 300_000;
  assert.equal((await check()).status, "ok");
  assert.deepEqual(reports, [false, true]);
  failed = true;
  now += 15_000;
  assert.equal((await check()).status, "unavailable");
  assert.deepEqual(reports, [false, true, false]);
  const before = calls;
  now += 30_000;
  await check();
  assert.equal(calls, before + 1);
});

test("guarded workers skip unavailable databases, avoid overlap, and resume", async () => {
  let available = false;
  let runs = 0;
  let finish: (() => void) | undefined;
  const run = databaseGuardedTask("test-worker", () => {
    runs++;
    return new Promise<void>(resolve => { finish = resolve; });
  }, async () => ({ status: available ? "ok" : "unavailable", checkedAt: new Date().toISOString() }));
  await run();
  assert.equal(runs, 0);
  available = true;
  const first = run();
  await Promise.resolve();
  await run();
  assert.equal(runs, 1);
  finish!();
  await first;
  const second = run();
  await Promise.resolve();
  finish!();
  await second;
  assert.equal(runs, 2);
});

test("a failed worker logs its error and releases the overlap lock", async t => {
  const messages: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { messages.push(args); });
  let runs = 0;
  const run = databaseGuardedTask("test-worker", async () => {
    runs++;
    throw new Error("Worker failed");
  }, async () => ({ status: "ok", checkedAt: new Date().toISOString() }));
  await run();
  await run();
  assert.equal(runs, 2);
  assert.equal(messages.length, 2);
});
