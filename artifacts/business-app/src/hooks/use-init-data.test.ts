import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { initDataQueryOptions } from "./use-init-data";

test("startup failures are errors, not empty-account success responses or automatic retries", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  });
  const client = new QueryClient();
  t.after(() => client.clear());
  await assert.rejects(client.fetchQuery(initDataQueryOptions), /Unable to load your account/);
  assert.equal(calls, 1);
  assert.equal(client.getQueryData(["me-init"]), undefined);
  assert.equal(client.getQueryState(["me-init"])?.status, "error");
  assert.equal(initDataQueryOptions.retryOnMount, false);
});

test("manual startup retry recovers and later refresh failures retain the last good account", async t => {
  let available = true;
  const account = {
    profile: { id: "test-user", role: "admin" },
    planFeatures: { features: { job_management: true } },
  };
  t.mock.method(globalThis, "fetch", async () => available
    ? Response.json(account)
    : Response.json({ error: "Database unavailable" }, { status: 503 }));
  const client = new QueryClient();
  t.after(() => client.clear());
  await client.fetchQuery(initDataQueryOptions);
  available = false;
  await assert.rejects(client.fetchQuery({ ...initDataQueryOptions, staleTime: 0 }), /Unable to load your account/);
  assert.deepEqual(client.getQueryData(["me-init"]), account);
  available = true;
  assert.deepEqual(await client.fetchQuery({ ...initDataQueryOptions, staleTime: 0 }), account);
});
