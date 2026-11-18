import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.SUPABASE_URL = "https://merge-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-database-key";
const { default: router } = await import("./customers");

test("overlapping merges are rejected, and an archived duplicate cannot be merged back", async t => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const primaryId = "22222222-2222-4222-8222-222222222222";
  const duplicateId = "33333333-3333-4333-8333-333333333333";
  const active = new Map([[primaryId, true], [duplicateId, true]]);
  const locks = new Map<string, string>();
  let markArchiveStarted!: () => void;
  let allowArchiveToFinish!: () => void;
  const archiveStarted = new Promise<void>(resolve => { markArchiveStarted = resolve; });
  const archiveMayFinish = new Promise<void>(resolve => { allowArchiveToFinish = resolve; });
  let archives = 0;
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    assert.equal(url.hostname, "merge-test.invalid");
    const table = url.pathname.split("/").pop();
    if (table === "customer_merge_locks") {
      if (init?.method === "POST") {
        const claims = JSON.parse(String(init.body)) as { tenant_id: string; customer_id: string; merge_id: string }[];
        assert.deepEqual(claims.map(claim => claim.customer_id), [primaryId, duplicateId]);
        assert.ok(claims.every(claim => claim.tenant_id === tenantId && claim.merge_id === claims[0].merge_id));
        if (claims.some(claim => locks.has(claim.customer_id))) return Response.json({ code: "23505" }, { status: 409 });
        for (const claim of claims) locks.set(claim.customer_id, claim.merge_id);
      } else {
        assert.equal(init?.method, "DELETE");
        assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
        for (const [customerId, mergeId] of locks) {
          if (url.searchParams.get("merge_id") === `eq.${mergeId}`) locks.delete(customerId);
        }
      }
      return new Response(null, { status: 204 });
    }
    if (table === "customers") {
      const id = url.searchParams.get("id")?.slice(3) || "";
      assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
      if (init?.method === "PATCH") {
        archives++;
        markArchiveStarted();
        await archiveMayFinish;
        active.set(id, false);
        return Response.json([{ id }]);
      }
      return Response.json(active.has(id) ? [{ id, first_name: "Test", last_name: "Customer", is_active: active.get(id) }] : []);
    }
    if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "*/0" } });
    return Response.json([]);
  });

  const route = router.stack.find(layer => layer.route?.path === "/customers/:id/merge")?.route;
  assert.ok(route);
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    Object.assign(req, { tenantId, userRole: "admin" });
    next();
  });
  app.post("/customers/:id/merge", ...route.stack.slice(3).map(layer => layer.handle));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const merge = (into: string, from: string) => fetch(`http://127.0.0.1:${address.port}/customers/${into}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ duplicate_customer_id: from }),
  });

  const first = merge(primaryId, duplicateId);
  try {
    await Promise.race([archiveStarted, first.then(() => assert.fail("Merge finished without reaching the archive step"))]);
    const reverse = await merge(duplicateId, primaryId);
    assert.equal(reverse.status, 409);
    assert.match((await reverse.json() as { error: string }).error, /already in progress/);
  } finally {
    allowArchiveToFinish();
  }
  assert.equal((await first).status, 200);
  const stale = await merge(duplicateId, primaryId);
  assert.equal(stale.status, 409);
  assert.match((await stale.json() as { error: string }).error, /must be active/);
  assert.equal(active.get(primaryId), true);
  assert.equal(active.get(duplicateId), false);
  assert.equal(archives, 1);
});
