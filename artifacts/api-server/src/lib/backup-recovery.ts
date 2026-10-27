import crypto from "node:crypto";
import { createWriteStream, openAsBlob } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import unzipper from "unzipper";
import { z } from "zod";
import { supabaseAdmin } from "./supabase";
import { storageBucketForTenantObject } from "./tenant-backup";

export const databaseBackupPattern = /^backup_\d{8}_\d{6}\.(?:dump|json\.gz)$/;
export const tenantBackupPattern = /^tenant-backups\/([0-9a-f-]{36})\/backup_\d{8}_\d{6}\.zip$/i;

export function isBackupKey(key: string): boolean {
  return databaseBackupPattern.test(key) || tenantBackupPattern.test(key);
}

export function isTenantBackupKey(key: string, tenantId: string): boolean {
  return tenantBackupPattern.exec(key)?.[1] === tenantId;
}

const rowSchema = z.record(z.string(), z.unknown());
const manifestSchema = z.object({
  tenantId: z.string(),
  format: z.literal("tradeworkdesk-tenant-snapshot-v2"),
  createdAt: z.string(),
  tenant: z.object({ companyName: z.string().optional(), contactEmail: z.string().nullish() }),
  tables: z.array(z.string()),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  skippedTables: z.array(z.object({ table: z.string(), reason: z.string() })),
  media: z.object({
    included: z.literal(true),
    objectCount: z.number().int().nonnegative(),
    objects: z.array(z.object({
      table: z.enum(["file_attachments", "signatures", "website_media"]),
      rowId: z.string(), bucket: z.enum(["service-photos", "service-documents", "public-uploads", "signatures", "website-images"]),
      storagePath: z.string(), archivePath: z.string(), sizeBytes: z.number().int().nonnegative(),
    })),
  }),
});

export async function openTenantSnapshot(url: string, tenantId: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "tenant-recovery-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`Backup download failed: HTTP ${response.status}`);
    const archivePath = path.join(directory, "snapshot.zip");
    await pipeline(response.body, createWriteStream(archivePath));
    const zip = await unzipper.Open.file(archivePath);
    const entries = new Map(zip.files.map(file => [file.path, file]));
    if (entries.size !== zip.files.length) throw new Error("Snapshot contains duplicate ZIP entries");
    const manifestFile = entries.get("manifest.json");
    const dataFile = entries.get("data.json");
    if (!manifestFile || !dataFile) throw new Error("Snapshot is missing manifest.json or data.json");
    const manifest = manifestSchema.parse(JSON.parse((await manifestFile.buffer()).toString()));
    const data = z.record(z.string(), z.array(rowSchema)).parse(JSON.parse((await dataFile.buffer()).toString()));
    const violations: string[] = [];
    if (manifest.tenantId !== tenantId) violations.push("Manifest tenant ID does not match the requested tenant");
    for (const table of ["company_settings", "profiles", "customers", "properties", "jobs"]) {
      if (!data[table]) violations.push(`Required table is missing: ${table}`);
    }
    for (const skipped of manifest.skippedTables) violations.push(`Skipped ${skipped.table}: ${skipped.reason}`);
    const tables = new Set([...manifest.tables, ...Object.keys(data), ...Object.keys(manifest.counts)]);
    for (const table of tables) {
      if (!manifest.tables.includes(table) || !data[table] || manifest.counts[table] !== data[table].length) {
        violations.push(`Table count or manifest mismatch: ${table}`);
      }
      for (const row of data[table] ?? []) {
        if (row.tenant_id !== tenantId) violations.push(`${table} contains a row without the requested tenant ID`);
      }
    }
    if (manifest.media.objectCount !== manifest.media.objects.length) violations.push("Media object count mismatch");
    const mediaKeys = new Set<string>();
    for (const object of manifest.media.objects) {
      const key = `${object.table}:${object.rowId}`;
      if (mediaKeys.has(key)) violations.push(`Duplicate media metadata: ${key}`);
      mediaKeys.add(key);
      const row = data[object.table]?.find(row => row.id === object.rowId);
      if (!row || row.storage_path !== object.storagePath) violations.push(`Media metadata mismatch: ${key}`);
      if (row && storageBucketForTenantObject(object.table, row) !== object.bucket) violations.push(`Media bucket mismatch: ${key}`);
      const file = entries.get(object.archivePath);
      if (!object.archivePath.startsWith("media/") || !file || file.uncompressedSize !== object.sizeBytes) {
        violations.push(`Missing or incorrect media size: ${object.archivePath}`);
      } else {
        // Consume entries without retaining media bytes.
        let bytes = 0;
        for await (const chunk of file.stream()) bytes += Buffer.byteLength(chunk);
        if (bytes !== object.sizeBytes) violations.push(`Incorrect media content size: ${object.archivePath}`);
      }
    }
    for (const table of ["file_attachments", "signatures", "website_media"]) {
      for (const row of data[table] ?? []) {
        if (row.storage_path && !mediaKeys.has(`${table}:${row.id}`)) violations.push(`Unarchived media: ${table}:${row.id}`);
      }
      violations.push(...restoreReferenceViolations(data, tenantId));
    }
    return { manifest, data, entries, directory, violations, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

type Snapshot = Awaited<ReturnType<typeof openTenantSnapshot>>;
const excludedTables = ["tenant_user_push_preferences", "web_push_subscriptions", "website_domains", "tenant_addons"];
const restoreOrder = [
  "company_settings", "customers", "properties", "appliances", "product_catalogue", "service_catalogue", "enquiries", "jobs",
  "job_visits", "job_appliances",
  "job_parts", "job_services", "job_time_entries", "job_notes", "job_email_logs",
  "job_confirmation_responses", "invoices", "invoice_line_items", "quotes", "quote_line_items",
  "enquiry_messages", "follow_ups", "websites", "website_pages", "website_blocks",
  "website_forms", "website_form_submissions", "file_attachments", "signatures", "website_media",
];

function restoreReferenceViolations(data: Record<string, Record<string, unknown>[]>, tenantId: string): string[] {
  const violations: string[] = [];
  const ids = new Set([tenantId]);
  for (const [table, rows] of Object.entries(data)) {
    if (excludedTables.includes(table)) continue;
    if (!restoreOrder.includes(table) && table !== "profiles" && rows.length) violations.push(`Unsupported restore table: ${table}`);
    for (const row of rows) {
      if (typeof row.id !== "string" || ids.has(row.id)) violations.push(`Missing or duplicate record ID in ${table}`);
      else ids.add(row.id);
    }
  }
  const globalReferences = new Set(["template_id"]);
  const profileReferences = new Set(["sent_by", "created_by", "uploaded_by", "changed_by", "approved_by", "assigned_to"]);
  for (const [table, rows] of Object.entries(data)) {
    if (excludedTables.includes(table)) continue;
    for (const row of rows) {
      for (const [field, value] of Object.entries(row)) {
        if ((field.endsWith("_id") || profileReferences.has(field)) && typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
          && !ids.has(value) && !globalReferences.has(field)) {
          violations.push(`Unresolved reference: ${table}.${field} (${value})`);
        }
      }
    }
  }
  return violations;
}

const activeRestores = new Set<string>();

export async function restoreTenantSnapshot(snapshot: Snapshot, sourceTenantId: string) {
  if (activeRestores.has(sourceTenantId)) throw new Error("A restore for this source company is already running");
  activeRestores.add(sourceTenantId);
  try { return await restoreSnapshot(snapshot, sourceTenantId); }
  finally { activeRestores.delete(sourceTenantId); }
}

async function restoreSnapshot(snapshot: Snapshot, sourceTenantId: string) {
  if (snapshot.violations.length) throw new Error(`Snapshot validation failed: ${snapshot.violations.join("; ")}`);
  const unsupported = Object.keys(snapshot.data).filter(table =>
    snapshot.data[table].length && table !== "profiles" && !restoreOrder.includes(table) && !excludedTables.includes(table));
  if (unsupported.length) throw new Error(`Unsupported restore tables: ${unsupported.join(", ")}`);
  const name = `${snapshot.manifest.tenant.companyName || "Company"} (Restored ${new Date().toISOString().slice(0, 10)})`;
  const { data: tenant, error: tenantError } = await supabaseAdmin.from("tenants").insert({
    company_name: name, contact_name: name,
    contact_email: snapshot.manifest.tenant.contactEmail || `restored-${crypto.randomUUID()}@invalid.local`,
    status: "suspended", trial_ends_at: new Date().toISOString(),
  }).select("id, company_name, status").single();
  if (tenantError || !tenant) throw new Error(tenantError?.message || "Failed to create restored tenant");
  const users: string[] = [];
  const storage: Array<{ bucket: string; path: string }> = [];
  try {
    const idMap = new Map<string, string>([[sourceTenantId, tenant.id]]);
    for (const [table, rows] of Object.entries(snapshot.data)) {
      if (excludedTables.includes(table) || table === "profiles") continue;
      for (const row of rows) if (typeof row.id === "string") {
        if (idMap.has(row.id)) throw new Error(`Duplicate record ID: ${row.id}`);
        idMap.set(row.id, crypto.randomUUID());
      }
    }
    const counts: Record<string, number> = {};
    for (const profile of snapshot.data.profiles ?? []) {
      const { data: auth, error } = await supabaseAdmin.auth.admin.createUser({
        email: `recovery-${crypto.randomUUID()}@invalid.local`,
        password: crypto.randomBytes(48).toString("base64url"),
        ban_duration: "876000h", email_confirm: false,
        user_metadata: { recovery_only: true, source_tenant_id: sourceTenantId, tenant_id: tenant.id,
          role: profile.role === "super_admin" ? "office_staff" : profile.role },
      });
      if (error || !auth.user) throw new Error(error?.message || "Failed to create disabled recovery identity");
      users.push(auth.user.id);
      idMap.set(String(profile.id), auth.user.id);
    }
    const mediaReplacements = new Map<string, string>();
    for (const object of snapshot.manifest.media.objects) {
      const file = snapshot.entries.get(object.archivePath);
      if (!file) throw new Error(`Missing media: ${object.archivePath}`);
      const localPath = path.join(snapshot.directory, "restore-media");
      await pipeline(file.stream(), createWriteStream(localPath));
      const { size } = await stat(localPath);
      if (size !== object.sizeBytes) throw new Error(`Media size mismatch: ${object.archivePath}`);
      const source = snapshot.data[object.table].find(row => row.id === object.rowId)!;
      const newPath = `${object.bucket === "public-uploads" ? "form-submissions/" : ""}${tenant.id}/restored/${idMap.get(object.rowId)}/${path.basename(object.storagePath)}`;
      const contentType = String(source.file_type || source.mime_type || "application/octet-stream");
      const { error } = await supabaseAdmin.storage.from(object.bucket).upload(newPath,
        await openAsBlob(localPath, { type: contentType }), { upsert: false, contentType });
      if (error) throw new Error(`Restore media: ${error.message}`);
      storage.push({ bucket: object.bucket, path: newPath });
      mediaReplacements.set(object.storagePath, newPath);
      if (typeof source.public_url === "string" && source.public_url) {
        mediaReplacements.set(source.public_url, supabaseAdmin.storage.from(object.bucket).getPublicUrl(newPath).data.publicUrl);
      }
    }
    function remap(value: unknown): unknown {
      if (typeof value === "string") {
        if (idMap.has(value)) return idMap.get(value);
        if (mediaReplacements.has(value)) return mediaReplacements.get(value);
        let text = value;
        for (const [source, replacement] of mediaReplacements) text = text.replaceAll(source, replacement);
        return text;
      }
      if (Array.isArray(value)) return value.map(remap);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remap(item)]));
      return value;
    }
    async function insertRows(table: string, rows: Record<string, unknown>[]) {
      for (let offset = 0; offset < rows.length; offset += 100) {
        const { error } = await supabaseAdmin.from(table).insert(rows.slice(offset, offset + 100));
        if (error) throw new Error(`Restore ${table}: ${error.message}`);
      }
      if (rows.length) counts[table] = rows.length;
    }
    const profiles = (snapshot.data.profiles ?? []).map(profile => ({
      ...profile, id: idMap.get(String(profile.id)), tenant_id: tenant.id,
      role: profile.role === "super_admin" ? "office_staff" : profile.role, is_active: false,
    }));
    if (profiles.length) {
      // Auth's new-user trigger may already have created these recovery profiles.
      const { error } = await supabaseAdmin.from("profiles").upsert(profiles, { onConflict: "id" });
      if (error) throw new Error(`Restore profiles: ${error.message}`);
      counts.profiles = profiles.length;
    }
    const deferred: Array<{ table: string; id: string; fields: Record<string, unknown> }> = [];
    const inserted = new Set(["profiles", "company_settings"]);
    const tableById = new Map<string, string>();
    for (const [table, rows] of Object.entries(snapshot.data)) {
      for (const row of rows) if (typeof row.id === "string") tableById.set(row.id, table);
    }
    for (const table of restoreOrder) {
      const rows = (snapshot.data[table] ?? []).map(source => {
        const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, remap(value)]));
        row.tenant_id = tenant.id;
        const fields: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(source)) {
          if (field !== "id" && field !== "tenant_id" && field.endsWith("_id") && typeof value === "string") {
            const referencedTable = tableById.get(value);
            if (referencedTable && !inserted.has(referencedTable)) {
              fields[field] = row[field];
              row[field] = null;
            }
          }
        }
        if (Object.keys(fields).length) {
          if (typeof row.id !== "string") throw new Error(`Cannot defer references without an ID: ${table}`);
          deferred.push({ table, id: row.id, fields });
        }
        if (table === "company_settings") {
          for (const field of Object.keys(row)) {
            if (/token|secret|password|api_key/i.test(field)) row[field] = null;
          }
        }
        if (table === "websites") row.status = "draft";
        if (table === "job_confirmation_responses") {
          row.token_hash = crypto.randomBytes(32).toString("hex");
          row.token_expires_at = new Date(0).toISOString();
        }
        if (table === "file_attachments" && "thumbnail_storage_path" in row) row.thumbnail_storage_path = null;
        return row;
      });
      await insertRows(table, rows);
      inserted.add(table);
    }
    for (const update of deferred) {
      const { error } = await supabaseAdmin.from(update.table).update(update.fields).eq("id", update.id).eq("tenant_id", tenant.id);
      if (error) throw new Error(`Restore references ${update.table}: ${error.message}`);
    }
    for (const [table, expected] of Object.entries(counts)) {
      const { count, error } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true }).eq("tenant_id", tenant.id);
      if (error || count !== expected) throw new Error(`Restored count verification failed: ${table}`);
    }
    return { restoredTenant: tenant, restoredCounts: counts, excluded: excludedTables, skipped: [],
      accessWarning: "Recovery identities are banned and inactive. No invitations were sent. Review and map users before activation." };
  } catch (error) {
    const cleanupErrors: string[] = [];
    async function clean(action: () => PromiseLike<{ error: { message: string } | null }>) {
      try {
        const { error } = await action();
        if (error) cleanupErrors.push(error.message);
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    for (const object of storage) {
      await clean(() => supabaseAdmin.storage.from(object.bucket).remove([object.path]));
    }
    await clean(() => supabaseAdmin.from("tenants").delete().eq("id", tenant.id));
    for (const id of users) {
      await clean(() => supabaseAdmin.auth.admin.deleteUser(id));
    }
    throw new Error(`${error instanceof Error ? error.message : String(error)}. Recovery tenant: ${tenant.id}.${cleanupErrors.length ? ` Cleanup incomplete: ${cleanupErrors.join("; ")}` : " Recovery resources removed."}`);
  }
}
