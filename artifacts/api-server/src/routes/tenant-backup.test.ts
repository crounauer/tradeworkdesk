import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express, { type RequestHandler } from "express";
import JSZip from "jszip";

process.env.SUPABASE_URL = "https://tenant-backup-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "tenant-backup-test-key";
const { default: router } = await import("./platform");
const { default: internalRouter } = await import("./internal");
const tenantId = "11111111-1111-4111-8111-111111111111";

async function start(t: TestContext, options: { missingMedia?: boolean; uploadFails?: boolean; deleteFails?: boolean; paginatedHistory?: boolean } = {}) {
  let archive: Buffer | undefined;
  let key = "";
  const deletedKeys: string[] = [];
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    if (url.hostname === "test-account.r2.cloudflarestorage.com") {
      if (init?.method === "DELETE") {
        deletedKeys.push(url.pathname.slice("/test-bucket/".length));
        assert.ok(new Headers(init.headers).get("Authorization")?.startsWith("AWS4-HMAC-SHA256"));
        return new Response(null, { status: options.deleteFails ? 503 : 204 });
      }
      if (init?.method === "PUT") {
        assert.equal(init.body instanceof Blob && init.body.type, "application/zip");
        assert.ok(url.pathname.endsWith(".zip"));
        if (options.uploadFails) return new Response("Upload unavailable", { status: 503 });
        assert.ok(init.body instanceof Blob);
        archive = Buffer.from(await init.body.arrayBuffer());
        key = url.pathname.slice("/test-bucket/".length);
        return new Response("", { status: 200 });
      }
      if (url.searchParams.has("list-type")) {
        if (options.paginatedHistory && url.searchParams.get("prefix") === "backup_") {
          if (!url.searchParams.has("continuation-token")) {
            return new Response("<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>next&amp;token</NextContinuationToken><Contents><Key>backup_20261027_020000.json.gz</Key><Size>1234</Size><LastModified>2026-10-27T02:00:00Z</LastModified></Contents></ListBucketResult>");
          }
          assert.equal(url.searchParams.get("continuation-token"), "next&token");
          return new Response("<ListBucketResult><Contents><Key>backup_20261026_020000.dump</Key><Size>456</Size><LastModified>2026-10-26T02:00:00Z</LastModified></Contents></ListBucketResult>");
        }
        if (!key.startsWith(url.searchParams.get("prefix") || "")) return new Response("<ListBucketResult/>");
        return new Response(`<ListBucketResult><Contents><Key>${key}</Key></Contents></ListBucketResult>`);
      }
      assert.equal(url.pathname, `/test-bucket/${key}`);
      assert.ok(archive);
      return new Response(new Uint8Array(archive));
    }
    assert.equal(url.hostname, "tenant-backup-test.invalid");
    if (url.pathname.startsWith("/storage/v1/object/sign/")) {
      return Response.json({ signedURL: `/object/download/${url.pathname.slice("/storage/v1/object/sign/".length)}` });
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      if (options.missingMedia) return Response.json({ message: "Media unavailable" }, { status: 404 });
      return new Response(`bytes:${url.pathname}`);
    }
    const table = url.pathname.split("/").pop();
    if (table === "tenants") {
      const tenant = { id: tenantId, company_name: "Test Company", status: "active" };
      return Response.json(url.searchParams.has("id") ? tenant : [tenant]);
    }
    if (table === "platform_settings") return Response.json([
      { key: "backup_r2_account_id", value: "test-account" },
      { key: "backup_r2_access_key_id", value: "test-access" },
      { key: "backup_r2_secret_access_key", value: "test-secret" },
      { key: "backup_r2_bucket_name", value: "test-bucket" },
    ]);
    if (table === "platform_audit_log") return Response.json({});
    assert.equal(url.searchParams.get("tenant_id"), `eq.${tenantId}`);
    if (table === "customers") return Response.json([{ id: "customer", tenant_id: tenantId }]);
    if (table === "file_attachments") return Response.json([
      { id: "photo", tenant_id: tenantId, storage_path: `${tenantId}/photo.jpg`, file_type: "image/jpeg" },
      { id: "document", tenant_id: tenantId, storage_path: `${tenantId}/document.pdf`, file_type: "application/pdf" },
      { id: "submission", tenant_id: tenantId, storage_path: "form-submissions/test.pdf", file_type: "application/pdf" },
    ]);
    if (table === "signatures" || table === "website_media") return Response.json([
      { id: table, tenant_id: tenantId, storage_path: `${tenantId}/${table}.png` },
    ]);
    return Response.json([]);
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { userId: "test-admin", userEmail: "admin@example.invalid" });
    next();
  });
  for (const path of ["/platform/tenants/:id/backup", "/platform/tenants/:id/backup/validate", "/platform/tenants/:id/backup/restore"]) {
    const route = router.stack.find(layer => layer.route?.path === path)?.route;
    assert.ok(route);
    const handler: RequestHandler = route.stack[route.stack.length - 1].handle;
    app.post(path, handler);
  }
  const deleteRoute = router.stack.find(layer => layer.route?.path === "/platform/backup-logs/:name")?.route;
  assert.ok(deleteRoute);
  const deleteHandler: RequestHandler = deleteRoute.stack[deleteRoute.stack.length - 1].handle;
  app.delete("/platform/backup-logs/:name", deleteHandler);
  const historyRoute = router.stack.find(layer => layer.route?.path === "/platform/backup-logs")?.route;
  assert.ok(historyRoute);
  const historyHandler: RequestHandler = historyRoute.stack[historyRoute.stack.length - 1].handle;
  app.get("/platform/backup-logs", historyHandler);
  app.use("/api", internalRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}/platform/tenants/${tenantId}/backup`,
    archive: () => archive,
    deleteUrl: `http://127.0.0.1:${address.port}/platform/backup-logs`,
    deletedKeys,
    scheduledUrl: `http://127.0.0.1:${address.port}/api/internal/run-tenant-backups`,
  };
}

test("Manual tenant exports create media-inclusive snapshots accepted by validation", async t => {
  const { url, archive } = await start(t);
  const response = await fetch(url, { method: "POST" });
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json() as { key: string; skippedTables: unknown[] };
  assert.ok(body.key.endsWith(".zip"));
  assert.deepEqual(body.skippedTables, []);
  const bytes = archive();
  assert.ok(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
  assert.equal(manifest.format, "tradeworkdesk-tenant-snapshot-v2");
  assert.equal(manifest.tenantId, tenantId);
  assert.equal(manifest.auth.included, false);
  assert.equal(manifest.media.included, true);
  assert.equal(manifest.media.objectCount, 5);
  assert.deepEqual(manifest.media.objects.map((object: { bucket: string }) => object.bucket),
    ["service-photos", "service-documents", "public-uploads", "signatures", "website-images"]);
  for (const object of manifest.media.objects) {
    assert.ok((await zip.file(object.archivePath)!.async("text")).startsWith("bytes:"));
  }
  const data = JSON.parse(await zip.file("data.json")!.async("text"));
  assert.equal(data.customers[0].tenant_id, tenantId);
  const validation = await fetch(`${url}/validate`, { method: "POST" });
  assert.equal(validation.status, 200);
  assert.equal((await validation.json() as { valid: boolean }).valid, true);
});

test("Missing media is reported in the export response and manifest", async t => {
  const { url, archive } = await start(t, { missingMedia: true });
  const response = await fetch(url, { method: "POST" });
  assert.equal(response.status, 200);
  const body = await response.json() as { skippedTables: unknown[] };
  assert.equal(body.skippedTables.length, 5);
  const bytes = archive();
  assert.ok(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));
  assert.equal(manifest.skippedTables.length, 5);
  assert.equal(manifest.media.objectCount, 0);
});

test("Failed snapshot uploads return an explicit error", async t => {
  const { url } = await start(t, { uploadFails: true });
  const response = await fetch(url, { method: "POST" });
  assert.equal(response.status, 502);
  assert.match((await response.json() as { error: string }).error, /Tenant backup upload failed: 503/);
});

test("Database backup deletion removes only the requested backup", async t => {
  const { deleteUrl, deletedKeys } = await start(t);
  for (const name of ["backup_20261027_010249.json.gz", "backup_20261026_020000.dump"]) {
    const response = await fetch(`${deleteUrl}/${name}`, { method: "DELETE" });
    assert.equal(response.status, 204);
  }
  assert.deepEqual(deletedKeys, ["backup_20261027_010249.json.gz", "backup_20261026_020000.dump"]);
});

test("Deletion rejects malformed snapshots, paths and unrelated storage keys", async t => {
  const { deleteUrl, deletedKeys } = await start(t);
  for (const name of ["other.json.gz", "backup_20261027_010249.zip", "tenant-backups/test.zip", "../backup_20261027_010249.json.gz"]) {
    const response = await fetch(`${deleteUrl}/${encodeURIComponent(name)}`, { method: "DELETE" });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(deletedKeys, []);
});

test("Tenant snapshot deletion accepts a scoped snapshot key", async t => {
  const { deleteUrl, deletedKeys } = await start(t);
  const name = `tenant-backups/${tenantId}/backup_20261027_020000.zip`;
  const response = await fetch(`${deleteUrl}/${encodeURIComponent(name)}`, { method: "DELETE" });
  assert.equal(response.status, 204);
  assert.deepEqual(deletedKeys, [name]);
});

test("Unified history includes both types, company names and all R2 pages", async t => {
  const { url, deleteUrl } = await start(t, { paginatedHistory: true });
  assert.equal((await fetch(url, { method: "POST" })).status, 200);
  const response = await fetch(deleteUrl);
  assert.equal(response.status, 200);
  const body = await response.json() as { files: Array<{ name: string; type: string; tenantId: string | null; companyName: string; downloadUrl: string }> };
  assert.equal(body.files.length, 3);
  assert.equal(body.files.filter(file => file.type === "database").length, 2);
  const tenantFile = body.files.find(file => file.type === "tenant");
  assert.ok(tenantFile);
  assert.equal(tenantFile.companyName, "Test Company");
  assert.equal(tenantFile.tenantId, tenantId);
  assert.ok(tenantFile.downloadUrl.includes(tenantFile.name));
});

test("Selected validation and restore reject a different tenant's key", async t => {
  const { url } = await start(t);
  for (const action of ["validate", "restore"]) {
    const response = await fetch(`${url}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "tenant-backups/22222222-2222-4222-8222-222222222222/backup_20261027_020000.zip", confirm: true }),
    });
    assert.equal(response.status, 400);
  }
});

test("Selected incomplete snapshot cannot be restored", async t => {
  const { url } = await start(t, { missingMedia: true });
  const backupResponse = await fetch(url, { method: "POST" });
  const { key } = await backupResponse.json() as { key: string };
  const validation = await fetch(`${url}/validate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }),
  });
  assert.equal((await validation.json() as { valid: boolean }).valid, false);
  const response = await fetch(`${url}/restore`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, confirm: true }),
  });
  assert.equal(response.status, 422);
});

test("Storage deletion failures are not reported as success", async t => {
  const { deleteUrl } = await start(t, { deleteFails: true });
  const response = await fetch(`${deleteUrl}/backup_20261027_010249.json.gz`, { method: "DELETE" });
  assert.equal(response.status, 502);
  assert.match((await response.json() as { error: string }).error, /Backup deletion failed: HTTP 503/);
});

test("Scheduled tenant snapshots upload the disk-backed ZIP and return its size", async t => {
  const previousSecret = process.env.INTERNAL_CRON_SECRET;
  process.env.INTERNAL_CRON_SECRET = "test-cron-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = previousSecret;
  });
  const { scheduledUrl, archive } = await start(t);
  const response = await fetch(scheduledUrl, { method: "POST", headers: { "x-cron-secret": "test-cron-secret" } });
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json() as { status: string; tenants: Array<{ sizeBytes: number }> };
  assert.equal(body.status, "success");
  assert.equal(body.tenants[0].sizeBytes, archive()?.length);
});
