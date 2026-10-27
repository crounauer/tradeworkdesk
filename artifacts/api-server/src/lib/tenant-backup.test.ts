import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { openAsBlob } from "node:fs";

process.env.SUPABASE_URL = "https://snapshot-memory-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "snapshot-memory-test-key";
const { runTenantRestBackup } = await import("./tenant-backup");
const { openTenantSnapshot } = await import("./backup-recovery");

test("Large media snapshots, uploads and validation stay below a 128 MiB memory increase and clean up", async t => {
  const fileSize = 64 * 1024 * 1024;
  const mediaCount = 3;
  let archivePath: string | undefined;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/archive.zip") {
      assert.ok(archivePath);
      return new Response(await openAsBlob(archivePath));
    }
    if (url.pathname.includes("/object/sign/")) {
      return Response.json({ signedURL: "/object/download/large" });
    }
    if (url.pathname.includes("/object/download/")) {
      let remaining = fileSize;
      return new Response(new ReadableStream<Uint8Array>({
        pull(controller) {
          if (remaining === 0) {
            controller.close();
            return;
          }
          const bytes = randomBytes(Math.min(64 * 1024, remaining));
          remaining -= bytes.length;
          controller.enqueue(bytes);
        },
      }));
    }
    assert.equal(url.searchParams.get("tenant_id"), "eq.memory-test");
    return Response.json(url.pathname.endsWith("/file_attachments")
      ? Array.from({ length: mediaCount }, (_, index) => ({
        id: `media-${index}`, tenant_id: "memory-test", storage_path: `large-${index}.jpg`, file_type: "image/jpeg",
      })) : []);
  });
  const baseline = process.memoryUsage().rss;
  let peak = baseline;
  const sample = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 10);
  t.after(() => clearInterval(sample));
  const snapshot = await runTenantRestBackup("memory-test", {});
  archivePath = snapshot.filePath;
  try {
    assert.ok(snapshot.sizeBytes >= fileSize * mediaCount, "All incompressible media must be included");
    const blob = await openAsBlob(snapshot.filePath);
    const reader = blob.stream().getReader();
    let uploaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      uploaded += value.length;
    }
    assert.equal(uploaded, snapshot.sizeBytes);
    const validation = await openTenantSnapshot("https://snapshot-memory-test.invalid/archive.zip", "memory-test");
    try { assert.deepEqual(validation.violations, []); }
    finally { await validation.cleanup(); }
    assert.ok(peak - baseline < 128 * 1024 * 1024, `Peak RSS increase: ${Math.round((peak - baseline) / 1024 / 1024)} MiB`);
  } finally {
    await snapshot.cleanup();
  }
  await assert.rejects(access(snapshot.filePath), { code: "ENOENT" });
});

test("Failed streamed media downloads fail explicitly", async t => {
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.includes("/object/sign/")) return Response.json({ signedURL: "/object/download/broken" });
    if (url.pathname.includes("/object/download/")) return new Response(new ReadableStream({
      start(controller) { controller.error(new Error("Download interrupted")); },
    }));
    return Response.json(url.pathname.endsWith("/file_attachments")
      ? [{ id: "broken", storage_path: "broken.pdf" }] : []);
  });
  await assert.rejects(runTenantRestBackup("memory-test", {}), /Download interrupted/);
});
