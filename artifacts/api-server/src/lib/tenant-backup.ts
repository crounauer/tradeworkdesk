import crypto from "crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import JSZip from "jszip";
import { supabaseAdmin } from "./supabase";

const TENANT_BACKUP_TABLES = [
  "company_settings", "profiles", "customers", "properties", "appliances", "product_catalogue", "service_catalogue", "jobs",
  "job_visits", "job_appliances",
  "job_parts", "job_services", "job_time_entries", "job_notes", "job_email_logs",
  "job_confirmation_responses", "follow_ups", "invoices", "invoice_line_items",
  "quotes", "quote_line_items", "enquiries", "enquiry_messages", "tenant_addons",
  "tenant_user_push_preferences", "web_push_subscriptions", "website_domains",
  "websites", "website_pages", "website_blocks", "website_forms", "website_form_submissions",
  "file_attachments", "signatures", "website_media",
] as const;

export function storageBucketForTenantObject(table: string, row: Record<string, unknown>): string | null {
  if (table === "website_media") return "website-images";
  if (table === "signatures") return "signatures";
  if (table === "file_attachments") {
    const storagePath = String(row.storage_path || "");
    if (storagePath.startsWith("form-submissions/")) return "public-uploads";
    return String(row.file_type || "").startsWith("image/") ? "service-photos" : "service-documents";
  }
  return null;
}

export async function runTenantRestBackup(tenantId: string, tenant: Record<string, unknown>) {
  const directory = await mkdtemp(path.join(tmpdir(), "tenant-backup-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    return await buildTenantSnapshot(tenantId, tenant, directory, cleanup);
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function buildTenantSnapshot(tenantId: string, tenant: Record<string, unknown>, directory: string, cleanup: () => Promise<void>) {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  const skippedTables: Array<{ table: string; reason: string }> = [];

  for (const table of TENANT_BACKUP_TABLES) {
    const rows: unknown[] = [];
    let offset = 0;
    try {
      while (true) {
        const { data: page, error } = await supabaseAdmin
          .from(table)
          .select("*")
          .eq("tenant_id", tenantId)
          .range(offset, offset + 999);
        if (error) throw new Error(error.message);
        rows.push(...(page ?? []));
        if (!page || page.length < 1000) break;
        offset += 1000;
      }
      data[table] = rows;
      counts[table] = rows.length;
    } catch (error) {
      skippedTables.push({ table, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  const mediaObjects: Array<{ table: string; rowId: string; bucket: string; storagePath: string; archivePath: string; sizeBytes: number }> = [];
  const zip = new JSZip();
  for (const table of ["file_attachments", "signatures", "website_media"]) {
    for (const row of (data[table] ?? []) as Array<Record<string, unknown>>) {
      const bucket = storageBucketForTenantObject(table, row);
      const storagePath = String(row.storage_path || "");
      if (!bucket || !storagePath) continue;
      const { data: signed, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 3600);
      if (error || !signed) {
        skippedTables.push({ table: `${bucket}:${storagePath}`, reason: error?.message || "Storage object not found" });
        continue;
      }
      const response = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(120000) });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        skippedTables.push({ table: `${bucket}:${storagePath}`, reason: `Storage download failed: HTTP ${response.status}` });
        continue;
      }
      const rowId = String(row.id || crypto.randomUUID());
      const archivePath = `media/${bucket}/${rowId}-${storagePath.split("/").pop() || "object"}`;
      const mediaPath = path.join(directory, `media-${mediaObjects.length}`);
      await pipeline(response.body, createWriteStream(mediaPath));
      const { size: sizeBytes } = await stat(mediaPath);
      zip.file(archivePath, Readable.from((async function* () {
        yield* createReadStream(mediaPath);
      })()));
      mediaObjects.push({ table, rowId, bucket, storagePath, archivePath, sizeBytes });
    }
  }

  const createdAt = new Date().toISOString();
  const manifest = {
    format: "tradeworkdesk-tenant-snapshot-v2",
    createdAt,
    tenantId,
    tenant: { companyName: tenant.company_name, contactEmail: tenant.contact_email, status: tenant.status },
    tables: Object.keys(data),
    counts,
    skippedTables,
    auth: { included: false },
    media: { included: true, objectCount: mediaObjects.length, objects: mediaObjects },
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("data.json", JSON.stringify(data));
  const filePath = path.join(directory, "snapshot.zip");
  await pipeline(zip.generateNodeStream({ streamFiles: true, compression: "DEFLATE" }), createWriteStream(filePath));
  const { size: sizeBytes } = await stat(filePath);
  return {
    filePath,
    sizeBytes,
    cleanup,
    counts,
    skippedTables,
  };
}
