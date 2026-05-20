import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { stripe } from "../lib/stripe";
import { spawn } from "child_process";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { unlink, readFile } from "fs/promises";
import crypto from "crypto";
import {
  sendTrialExpiryReminder,
  sendRenewalReminder,
  sendLowCreditsAlert,
} from "../lib/email";

// ── SigV4 helpers for R2 ────────────────────────────────────────────────────
function sha256hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}
function signingKey(secret: string, dateStamp: string): Buffer {
  return hmacSha256(hmacSha256(hmacSha256(hmacSha256(`AWS4${secret}`, dateStamp), "auto"), "s3"), "aws4_request");
}
function signR2Get(opts: { host: string; path: string; query: string; accessKeyId: string; secretAccessKey: string }): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex("");
  const canonHeaders = `host:${opts.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonReq = ["GET", opts.path, opts.query, canonHeaders, signedHeaders, payloadHash].join("\n");
  const credScope = `${dateStamp}/auto/s3/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amzDate, credScope, sha256hex(canonReq)].join("\n");
  const sig = hmacSha256(signingKey(opts.secretAccessKey, dateStamp), sts).toString("hex");
  return {
    host: opts.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  };
}
function signR2Put(opts: { host: string; path: string; accessKeyId: string; secretAccessKey: string; contentLength: number }): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonHeaders = `content-length:${opts.contentLength}\nhost:${opts.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-length;host;x-amz-content-sha256;x-amz-date";
  const canonReq = ["PUT", opts.path, "", canonHeaders, signedHeaders, payloadHash].join("\n");
  const credScope = `${dateStamp}/auto/s3/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amzDate, credScope, sha256hex(canonReq)].join("\n");
  const sig = hmacSha256(signingKey(opts.secretAccessKey, dateStamp), sts).toString("hex");
  return {
    "content-length": String(opts.contentLength),
    host: opts.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  };
}
function signR2Delete(opts: { host: string; path: string; accessKeyId: string; secretAccessKey: string }): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex("");
  const canonHeaders = `host:${opts.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonReq = ["DELETE", opts.path, "", canonHeaders, signedHeaders, payloadHash].join("\n");
  const credScope = `${dateStamp}/auto/s3/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amzDate, credScope, sha256hex(canonReq)].join("\n");
  const sig = hmacSha256(signingKey(opts.secretAccessKey, dateStamp), sts).toString("hex");
  return {
    host: opts.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  };
}

// ── Backup helpers ──────────────────────────────────────────────────────────
function findPgDump(): string {
  // 1. Try shell's PATH (handles nix profile, custom installs, etc.)
  try {
    const p = execSync("which pg_dump 2>/dev/null", { encoding: "utf8", timeout: 5000 }).trim();
    if (p) { console.log("[backup] found pg_dump via which:", p); return p; }
  } catch {}
  // 2. Well-known apt/homebrew locations
  const candidates = [
    "/usr/bin/pg_dump",
    "/usr/local/bin/pg_dump",
    "/usr/lib/postgresql/17/bin/pg_dump",
    "/usr/lib/postgresql/16/bin/pg_dump",
    "/usr/lib/postgresql/15/bin/pg_dump",
  ];
  for (const c of candidates) {
    try { execSync(`test -x "${c}"`, { timeout: 2000 }); console.log("[backup] found pg_dump at:", c); return c; } catch {}
  }
  // 3. Nix store fallback
  try {
    const p = execSync("find /nix/store -name pg_dump -type f 2>/dev/null | head -1", { encoding: "utf8", timeout: 10000, shell: true }).trim();
    if (p) { console.log("[backup] found pg_dump in nix store:", p); return p; }
  } catch {}
  const path = process.env.PATH ?? "(unset)";
  throw new Error(`pg_dump not found. PATH=${path}`);
}

function runPgDump(dbUrl: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let pgDump: string;
    try { pgDump = findPgDump(); } catch (e) { return reject(e); }
    const proc = spawn(pgDump, [
      "--dbname", dbUrl,
      "--format", "custom",
      "--no-acl",
      "--no-owner",
      "--file", outputPath,
    ]);
    const stderr: string[] = [];
    proc.stderr.on("data", (d: Buffer) => stderr.push(d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited ${code}: ${stderr.join("").trim()}`));
    });
  });
}

type R2Cfg = {
  backup_r2_account_id: string;
  backup_r2_access_key_id: string;
  backup_r2_secret_access_key: string;
  backup_r2_bucket_name: string;
};

async function r2Upload(cfg: R2Cfg, filename: string, buf: Buffer): Promise<void> {
  const host = `${cfg.backup_r2_account_id}.r2.cloudflarestorage.com`;
  const path = `/${cfg.backup_r2_bucket_name}/${filename}`;
  const headers = signR2Put({ host, path, accessKeyId: cfg.backup_r2_access_key_id, secretAccessKey: cfg.backup_r2_secret_access_key, contentLength: buf.length });
  const res = await fetch(`https://${host}${path}`, { method: "PUT", headers, body: buf, signal: AbortSignal.timeout(120000) });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`R2 upload failed ${res.status}: ${txt}`);
  }
}

async function r2Prune(cfg: R2Cfg, keepCount: number): Promise<number> {
  const host = `${cfg.backup_r2_account_id}.r2.cloudflarestorage.com`;
  const bucketPath = `/${cfg.backup_r2_bucket_name}`;
  const query = "list-type=2&max-keys=200&prefix=backup_";
  const listHeaders = signR2Get({ host, path: bucketPath, query, accessKeyId: cfg.backup_r2_access_key_id, secretAccessKey: cfg.backup_r2_secret_access_key });
  const listRes = await fetch(`https://${host}${bucketPath}?${query}`, { method: "GET", headers: listHeaders, signal: AbortSignal.timeout(15000) });
  if (!listRes.ok) return 0;
  const xml = await listRes.text();
  const keys: string[] = [];
  for (const m of xml.matchAll(/<Key>(.*?)<\/Key>/g)) {
    if (m[1].endsWith(".dump")) keys.push(m[1]);
  }
  keys.sort();
  const toDelete = keys.slice(0, Math.max(0, keys.length - keepCount));
  for (const key of toDelete) {
    const delPath = `/${cfg.backup_r2_bucket_name}/${key}`;
    const delHeaders = signR2Delete({ host, path: delPath, accessKeyId: cfg.backup_r2_access_key_id, secretAccessKey: cfg.backup_r2_secret_access_key });
    await fetch(`https://${host}${delPath}`, { method: "DELETE", headers: delHeaders, signal: AbortSignal.timeout(10000) }).catch(() => null);
  }
  return toDelete.length;
}

const router = Router();

const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";
const BILLING_URL = `${APP_URL}/billing`;

function requireCronSecret(req: Request, res: Response): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  const provided = req.headers["x-cron-secret"];
  if (!secret || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/internal/send-trial-reminders", async (req: Request, res: Response): Promise<void> => {
  if (!requireCronSecret(req, res)) return;

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
  const in1 = new Date(now.getTime() + 1 * 86400000).toISOString().split("T")[0];

  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, company_name, contact_email, trial_ends_at")
    .eq("status", "trial")
    .not("contact_email", "is", null);

  const results: Array<{ id: string; email: string; days: number; sent: boolean }> = [];
  let successCount = 0;

  for (const tenant of tenants || []) {
    if (!tenant.contact_email || !tenant.trial_ends_at) continue;
    const endsDate = new Date(tenant.trial_ends_at).toISOString().split("T")[0];
    let daysLeft: number | null = null;
    if (endsDate === in7) daysLeft = 7;
    else if (endsDate === in1) daysLeft = 1;
    if (daysLeft === null) continue;

    try {
      await sendTrialExpiryReminder(tenant.contact_email, tenant.company_name, daysLeft, BILLING_URL);
      results.push({ id: tenant.id, email: tenant.contact_email, days: daysLeft, sent: true });
      successCount++;
    } catch {
      results.push({ id: tenant.id, email: tenant.contact_email, days: daysLeft, sent: false });
    }
  }

  res.json({ sent: successCount, results });
});

router.get("/internal/send-renewal-reminders", async (req: Request, res: Response): Promise<void> => {
  if (!requireCronSecret(req, res)) return;

  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, company_name, contact_email, subscription_renewal_at, stripe_subscription_id, plans(monthly_price)")
    .eq("status", "active")
    .not("contact_email", "is", null)
    .not("subscription_renewal_at", "is", null);

  const results: Array<{ id: string; email: string; sent: boolean }> = [];
  let successCount = 0;

  for (const tenant of (tenants || []) as Array<{
    id: string;
    company_name: string;
    contact_email: string | null;
    subscription_renewal_at: string | null;
    stripe_subscription_id?: string | null;
    plans?: { monthly_price?: number } | null;
  }>) {
    if (!tenant.contact_email || !tenant.subscription_renewal_at) continue;
    const renewalDate = new Date(tenant.subscription_renewal_at).toISOString().split("T")[0];
    if (renewalDate !== in3) continue;

    let amount = Math.round((tenant.plans?.monthly_price || 0) * 100);
    let currency = "gbp";

    if (stripe && tenant.stripe_subscription_id) {
      try {
        const upcoming = await stripe.invoices.retrieveUpcoming({
          subscription: tenant.stripe_subscription_id,
        });
        amount = upcoming.amount_due;
        currency = upcoming.currency;
      } catch (err) {
        console.warn(`[renewal-reminder] Failed to fetch upcoming invoice for ${tenant.id}, falling back to plan price:`, err);
      }
    }

    try {
      await sendRenewalReminder(
        tenant.contact_email,
        tenant.company_name,
        tenant.subscription_renewal_at,
        amount,
        currency,
        BILLING_URL,
      );
      results.push({ id: tenant.id, email: tenant.contact_email, sent: true });
      successCount++;
    } catch {
      results.push({ id: tenant.id, email: tenant.contact_email, sent: false });
    }
  }

  res.json({ sent: successCount, results });
});

router.get("/internal/send-low-credits-alerts", async (req: Request, res: Response): Promise<void> => {
  if (!requireCronSecret(req, res)) return;

  // Fetch all usage-based addon credit rows that are below 10% of their bundle size
  // and haven't had an alert sent since the last top-up (or ever).
  const { data: rows, error } = await supabaseAdmin
    .from("tenant_addon_credits")
    .select(`
      id,
      tenant_id,
      addon_id,
      credits_remaining,
      total_purchased,
      low_credits_alert_sent_at,
      low_credits_alert_total_purchased,
      addons ( name, usage_bundle_size, usage_unit_label, billing_model ),
      tenants ( company_name, contact_email )
    `)
    .gt("credits_remaining", -1); // fetch all; filter in JS for flexibility

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  type Row = {
    id: string;
    tenant_id: string;
    addon_id: string;
    credits_remaining: number;
    total_purchased: number;
    low_credits_alert_sent_at: string | null;
    low_credits_alert_total_purchased: number | null;
    addons: { name: string; usage_bundle_size: number | null; usage_unit_label: string | null; billing_model: string } | null;
    tenants: { company_name: string; contact_email: string | null } | null;
  };

  const results: Array<{ tenant: string; addon: string; credits: number; sent: boolean; reason?: string }> = [];
  let successCount = 0;

  for (const row of (rows || []) as Row[]) {
    const addon = row.addons;
    const tenant = row.tenants;

    // Skip non-usage addons or rows with missing relations
    if (!addon || addon.billing_model !== "usage" || !tenant?.contact_email) continue;

    const bundleSize = addon.usage_bundle_size ?? 1000;
    const threshold = Math.floor(bundleSize * 0.1);

    // Only alert when below 10% of bundle
    if (row.credits_remaining > threshold) continue;

    // Don't re-alert unless the tenant has topped up since the last alert
    const alreadyAlerted = row.low_credits_alert_sent_at !== null;
    const toppedUpSinceAlert = row.total_purchased > (row.low_credits_alert_total_purchased ?? 0);
    if (alreadyAlerted && !toppedUpSinceAlert) {
      results.push({ tenant: tenant.company_name, addon: addon.name, credits: row.credits_remaining, sent: false, reason: "already alerted" });
      continue;
    }

    try {
      await sendLowCreditsAlert(
        tenant.contact_email,
        tenant.company_name,
        addon.name,
        row.credits_remaining,
        bundleSize,
        addon.usage_unit_label ?? "credits",
        BILLING_URL,
      );

      // Record that we've sent the alert at this total_purchased level
      await supabaseAdmin
        .from("tenant_addon_credits")
        .update({
          low_credits_alert_sent_at: new Date().toISOString(),
          low_credits_alert_total_purchased: row.total_purchased,
        } as Record<string, unknown>)
        .eq("id", row.id);

      results.push({ tenant: tenant.company_name, addon: addon.name, credits: row.credits_remaining, sent: true });
      successCount++;
    } catch {
      results.push({ tenant: tenant.company_name, addon: addon.name, credits: row.credits_remaining, sent: false, reason: "send failed" });
    }
  }

  res.json({ sent: successCount, results });
});

const BACKUP_SETTING_KEYS = [
  "backup_supabase_db_url",
  "backup_r2_account_id",
  "backup_r2_access_key_id",
  "backup_r2_secret_access_key",
  "backup_r2_bucket_name",
] as const;

router.get("/internal/backup-config", async (req: Request, res: Response): Promise<void> => {
  if (!requireCronSecret(req, res)) return;

  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", [...BACKUP_SETTING_KEYS]);

  if (error) { res.status(500).json({ error: error.message }); return; }

  const config: Record<string, string | null> = {};
  for (const key of BACKUP_SETTING_KEYS) {
    config[key] = data?.find(r => r.key === key)?.value ?? null;
  }

  const missing = BACKUP_SETTING_KEYS.filter(k => !config[k]);
  if (missing.length > 0) {
    res.status(422).json({ error: "Missing backup credentials", missing });
    return;
  }

  res.json(config);
});

router.post("/internal/run-backup", async (req: Request, res: Response): Promise<void> => {
  if (!requireCronSecret(req, res)) return;

  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", [...BACKUP_SETTING_KEYS]);
  if (error) { res.status(500).json({ error: error.message }); return; }

  const config: Record<string, string | null> = {};
  for (const key of BACKUP_SETTING_KEYS) {
    config[key] = data?.find(r => r.key === key)?.value ?? null;
  }
  const missing = BACKUP_SETTING_KEYS.filter(k => !config[k]);
  if (missing.length > 0) {
    res.status(422).json({ error: "Missing backup credentials", missing });
    return;
  }

  const now = new Date();
  const ts = now.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "_");
  const filename = `backup_${ts}.dump`;
  const tmpPath = join(tmpdir(), filename);

  try {
    await runPgDump(config.backup_supabase_db_url!, tmpPath);
    const buf = await readFile(tmpPath);
    const r2cfg: R2Cfg = {
      backup_r2_account_id: config.backup_r2_account_id!,
      backup_r2_access_key_id: config.backup_r2_access_key_id!,
      backup_r2_secret_access_key: config.backup_r2_secret_access_key!,
      backup_r2_bucket_name: config.backup_r2_bucket_name!,
    };
    await r2Upload(r2cfg, filename, buf);
    const pruned = await r2Prune(r2cfg, 30);
    console.log(`[run-backup] ${filename} uploaded (${buf.length} bytes), pruned ${pruned} old file(s)`);
    res.json({ status: "success", filename, sizeBytes: buf.length, pruned });
  } catch (err) {
    console.error("[run-backup] error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    await unlink(tmpPath).catch(() => null);
  }
});

export default router;
