import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import JSZip from "jszip";
import { access } from "node:fs/promises";

process.env.SUPABASE_URL = "https://backup-recovery-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "recovery-test-key";
const { openTenantSnapshot, restoreTenantSnapshot } = await import("./backup-recovery");
const sourceId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const profileId = "33333333-3333-4333-8333-333333333333";
const newProfileId = "44444444-4444-4444-8444-444444444444";
const customerId = "55555555-5555-4555-8555-555555555555";
const jobId = "66666666-6666-4666-8666-666666666666";
const mediaId = "77777777-7777-4777-8777-777777777777";
const invoiceId = "88888888-8888-4888-8888-888888888888";

async function setup(t: TestContext, options: { skipped?: boolean; crossTenant?: boolean; missingMedia?: boolean;
  badCount?: boolean; failInsert?: boolean; failVerification?: boolean; unresolved?: boolean; cleanupFails?: boolean } = {}) {
  const data = {
    company_settings: [{ id: "settings", tenant_id: sourceId, singleton_id: "default", smtp_password: "do-not-copy" }], properties: [],
    profiles: [{ id: profileId, tenant_id: sourceId, email: "live@example.invalid", full_name: "Engineer", role: "admin" }],
    customers: [{ id: customerId, tenant_id: options.crossTenant ? targetId : sourceId, first_name: "Test" }],
    jobs: [{ id: jobId, tenant_id: sourceId, customer_id: customerId, assigned_technician_id: profileId,
      invoice_id: invoiceId, description: `Attachment: ${sourceId}/test.pdf`,
      ...(options.unresolved ? { property_id: "99999999-9999-4999-8999-999999999999" } : {}) }],
    invoices: [{ id: invoiceId, tenant_id: sourceId, job_id: jobId }],
    websites: [{ id: "website", tenant_id: sourceId, status: "published" }],
    job_confirmation_responses: [{ id: "confirmation", tenant_id: sourceId, job_id: jobId,
      sent_by: profileId, token_hash: "old-token", token_expires_at: "2030-01-01T00:00:00Z" }],
    file_attachments: [{ id: mediaId, tenant_id: sourceId, job_id: jobId, uploaded_by: profileId,
      storage_path: `${sourceId}/test.pdf`, file_type: "application/pdf" }],
    tenant_addons: [{ id: "addon", tenant_id: sourceId }],
  };
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({
    format: "tradeworkdesk-tenant-snapshot-v2", tenantId: sourceId, createdAt: "2026-10-27T02:00:00Z",
    tenant: { companyName: "Live Company", contactEmail: "live@example.invalid" },
    tables: Object.keys(data), counts: Object.fromEntries(Object.entries(data).map(([table, rows]) =>
      [table, table === "jobs" && options.badCount ? 999 : rows.length])),
    skippedTables: options.skipped ? [{ table: "quotes", reason: "Database unavailable" }] : [],
    media: { included: true, objectCount: 1, objects: [{
      table: "file_attachments", rowId: mediaId, bucket: "service-documents",
      storagePath: `${sourceId}/test.pdf`, archivePath: "media/test.pdf", sizeBytes: 4,
    }] },
  }));
  zip.file("data.json", JSON.stringify(data));
  if (!options.missingMedia) zip.file("media/test.pdf", "test");
  const archive = await zip.generateAsync({ type: "nodebuffer" });
  const rows = new Map<string, Record<string, unknown>[]>();
  const deletes: string[] = [];
  const authRequests: Record<string, unknown>[] = [];
  const uploads: string[] = [];
  let tenantWrites = 0;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "archive.invalid") return new Response(new Uint8Array(archive));
    assert.equal(url.hostname, "backup-recovery-test.invalid");
    if (url.pathname.startsWith("/auth/")) {
      assert.ok(!url.pathname.includes("invite"), "Recovery must never invite or email live users");
      if (init?.method === "DELETE") { deletes.push("auth"); return Response.json({}); }
      const body = JSON.parse(String(init?.body));
      authRequests.push(body);
      assert.equal(body.ban_duration, "876000h");
      assert.notEqual(body.email, "live@example.invalid");
      assert.equal(body.user_metadata.tenant_id, targetId);
      return Response.json({ id: newProfileId, email: body.email });
    }
    if (url.pathname.startsWith("/storage/")) {
      if (init?.method === "DELETE") {
        deletes.push("storage");
        return options.cleanupFails ? Response.json({ message: "Cleanup unavailable" }, { status: 503 }) : Response.json([]);
      }
      assert.ok(url.pathname.includes(targetId));
      uploads.push(url.pathname);
      return Response.json({ Key: url.pathname });
    }
    const table = url.pathname.split("/").pop()!;
    if (table === "tenants") {
      if (init?.method === "DELETE") {
        assert.equal(url.searchParams.get("id"), `eq.${targetId}`);
        deletes.push("tenant");
        return Response.json({});
      }
      const body = JSON.parse(String(init?.body));
      assert.equal(body.status, "suspended");
      tenantWrites++;
      return Response.json({ id: targetId, company_name: body.company_name, status: body.status });
    }
    if (init?.method === "HEAD") {
      assert.equal(url.searchParams.get("tenant_id"), `eq.${targetId}`);
      const count = options.failVerification ? 999 : rows.get(table)?.length || 0;
      return new Response(null, { headers: { "Content-Range": `0-0/${count}` } });
    }
    if (options.failInsert && table === "jobs") return Response.json({ message: "Insert blocked" }, { status: 400 });
    const body = JSON.parse(String(init?.body));
    if (init?.method === "PATCH") {
      assert.equal(url.searchParams.get("tenant_id"), `eq.${targetId}`);
      const row = rows.get(table)?.find(row => `eq.${row.id}` === url.searchParams.get("id"));
      assert.ok(row);
      Object.assign(row, body);
      return Response.json([]);
    }
    const inserted = Array.isArray(body) ? body : [body];
    for (const row of inserted) assert.equal(row.tenant_id, targetId);
    rows.set(table, [...(rows.get(table) ?? []), ...inserted]);
    return Response.json([]);
  });
  const snapshot = await openTenantSnapshot("https://archive.invalid/snapshot.zip", sourceId);
  t.after(snapshot.cleanup);
  return { snapshot, rows, deletes, authRequests, uploads, tenantWrites: () => tenantWrites };
}

test("Tenant recovery creates isolated IDs, preserves relationships and verifies counts without invitations", async t => {
  const { snapshot, rows, authRequests, uploads } = await setup(t);
  assert.deepEqual(snapshot.violations, []);
  const result = await restoreTenantSnapshot(snapshot, sourceId);
  assert.equal(result.restoredTenant.status, "suspended");
  const customer = rows.get("customers")![0];
  const job = rows.get("jobs")![0];
  const media = rows.get("file_attachments")![0];
  assert.notEqual(customer.id, customerId);
  assert.notEqual(job.id, jobId);
  assert.equal(job.customer_id, customer.id);
  assert.equal(job.assigned_technician_id, newProfileId);
  assert.equal(job.invoice_id, rows.get("invoices")![0].id);
  assert.equal(rows.get("invoices")![0].job_id, job.id);
  assert.ok(String(job.description).includes(`${targetId}/restored/`));
  assert.equal(media.job_id, job.id);
  assert.equal(media.uploaded_by, newProfileId);
  assert.ok(String(media.storage_path).startsWith(`${targetId}/`));
  assert.equal(rows.get("profiles")![0].is_active, false);
  assert.equal(rows.get("company_settings")![0].smtp_password, null);
  assert.equal(rows.get("websites")![0].status, "draft");
  assert.notEqual(rows.get("job_confirmation_responses")![0].token_hash, "old-token");
  assert.equal(rows.get("job_confirmation_responses")![0].sent_by, newProfileId);
  assert.equal(authRequests.length, 1);
  assert.equal(uploads.length, 1);
  assert.equal(rows.has("tenant_addons"), false);
  assert.equal(result.restoredCounts.jobs, 1);
  const temporaryDirectory = snapshot.directory;
  await snapshot.cleanup();
  await assert.rejects(access(temporaryDirectory), { code: "ENOENT" });
});

for (const [label, options] of Object.entries({
  "skipped tables": { skipped: true }, "foreign tenant rows": { crossTenant: true },
  "missing media": { missingMedia: true }, "wrong counts": { badCount: true },
  "unresolved source references": { unresolved: true },
})) {
  test(`Validation blocks ${label} before any restore writes`, async t => {
    const { snapshot, tenantWrites } = await setup(t, options);
    assert.ok(snapshot.violations.length);
    await assert.rejects(restoreTenantSnapshot(snapshot, sourceId), /Snapshot validation failed/);
    assert.equal(tenantWrites(), 0);
  });
}

test("Cleanup failures remain explicit while other recovery resources are still removed", async t => {
  const { snapshot, deletes } = await setup(t, { failVerification: true, cleanupFails: true });
  await assert.rejects(restoreTenantSnapshot(snapshot, sourceId), /Cleanup incomplete/);
  assert.ok(deletes.includes("tenant"));
  assert.ok(deletes.includes("auth"));
});

for (const options of [{ failInsert: true }, { failVerification: true }]) {
  test(`Recovery rolls back on ${options.failInsert ? "insert" : "verification"} failure instead of reporting partial success`, async t => {
    const { snapshot, deletes } = await setup(t, options);
    await assert.rejects(restoreTenantSnapshot(snapshot, sourceId), /Recovery resources removed/);
    assert.ok(deletes.includes("tenant"));
    assert.ok(deletes.includes("auth"));
  });
}
