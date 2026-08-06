import { supabaseAdmin } from "./supabase";
import { sendSimpleNotification } from "./email";

let monitorTimer: NodeJS.Timeout | null = null;
let lastAlertAtByTenant = new Map<string, number>();

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function runEmailOpsMonitor(): Promise<void> {
  const enabled = process.env.EMAIL_OPS_MONITOR_ENABLED !== "false";
  if (!enabled) return;

  const now = Date.now();
  const thresholdWindowMinutes = Math.max(5, toNumber(process.env.EMAIL_ALERT_WINDOW_MINUTES, 30));
  const minEvents = Math.max(5, toNumber(process.env.EMAIL_ALERT_MIN_EVENTS, 20));
  const maxFailureRate = Math.min(100, Math.max(1, toNumber(process.env.EMAIL_ALERT_FAILURE_RATE_PERCENT, 25)));
  const suppressionWindowMs = Math.max(10, toNumber(process.env.EMAIL_ALERT_SUPPRESSION_MINUTES, 60)) * 60_000;
  const recipient = (process.env.EMAIL_FAILURE_ALERT_RECIPIENT || "info@tradeworkdesk.co.uk").trim().toLowerCase();

  const sinceIso = new Date(now - thresholdWindowMinutes * 60_000).toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("tenant_email_audit_log")
    .select("tenant_id, status, created_at")
    .gte("created_at", sinceIso)
    .limit(10000);

  if (error) {
    console.error("[email-ops] Failed threshold query:", error.message);
    return;
  }

  const grouped = new Map<string, { total: number; failed: number }>();
  for (const row of (rows || []) as Array<{ tenant_id: string; status: string }>) {
    const tenantId = row.tenant_id;
    const status = String(row.status || "").toLowerCase();
    const bucket = grouped.get(tenantId) || { total: 0, failed: 0 };
    bucket.total += 1;
    if (["failed", "bounced", "suppressed", "complained"].includes(status)) bucket.failed += 1;
    grouped.set(tenantId, bucket);
  }

  for (const [tenantId, stats] of grouped.entries()) {
    if (stats.total < minEvents) continue;
    const rate = (stats.failed / stats.total) * 100;
    if (rate < maxFailureRate) continue;

    const lastSentAt = lastAlertAtByTenant.get(tenantId) || 0;
    if (now - lastSentAt < suppressionWindowMs) continue;

    const body = [
      "Email failure threshold alert",
      "",
      `Tenant: ${tenantId}`,
      `Window: last ${thresholdWindowMinutes} minutes`,
      `Events: ${stats.total}`,
      `Failed-like: ${stats.failed}`,
      `Failure rate: ${rate.toFixed(1)}%`,
    ].join("\n");

    try {
      await sendSimpleNotification(recipient, "[TradeWorkDesk] Email failure threshold exceeded", body);
      lastAlertAtByTenant.set(tenantId, now);
    } catch (err) {
      console.error("[email-ops] Failed to send threshold alert:", err instanceof Error ? err.message : String(err));
    }
  }

  const reconcileHours = Math.max(12, toNumber(process.env.EMAIL_RECONCILE_STALE_HOURS, 36));
  const staleIso = new Date(now - reconcileHours * 60 * 60 * 1000).toISOString();
  const { error: reconcileError } = await supabaseAdmin
    .from("tenant_email_audit_log")
    .update({
      status: "deferred",
      needs_action: true,
      error_message: "No delivery confirmation received within reconciliation window",
      failure_category: "unknown",
      provider_event_at: new Date().toISOString(),
    })
    .in("status", ["accepted", "queued", "sent"])
    .lt("created_at", staleIso);

  if (reconcileError) {
    console.error("[email-ops] Reconciliation update failed:", reconcileError.message);
  }

  const redactDays = Math.max(7, toNumber(process.env.EMAIL_AUDIT_REDACT_DAYS, 90));
  const redactIso = new Date(now - redactDays * 24 * 60 * 60 * 1000).toISOString();
  const { error: redactError } = await supabaseAdmin
    .from("tenant_email_audit_log")
    .update({
      metadata: null,
      error_message: null,
      redacted_at: new Date().toISOString(),
    })
    .lt("created_at", redactIso)
    .is("redacted_at", null);

  if (redactError) {
    console.error("[email-ops] Redaction failed:", redactError.message);
  }

  const retentionDays = Math.max(30, toNumber(process.env.EMAIL_AUDIT_RETENTION_DAYS, 365));
  const purgeIso = new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const { error: purgeError } = await supabaseAdmin
    .from("tenant_email_audit_log")
    .delete()
    .lt("created_at", purgeIso);

  if (purgeError) {
    console.error("[email-ops] Retention purge failed:", purgeError.message);
  }
}

export function startEmailOpsMonitorScheduler(): void {
  if (process.env.EMAIL_OPS_MONITOR_ENABLED === "false") {
    console.log("[email-ops] Disabled via EMAIL_OPS_MONITOR_ENABLED=false");
    return;
  }

  const intervalMinutes = Math.max(5, toNumber(process.env.EMAIL_OPS_MONITOR_INTERVAL_MINUTES, 15));
  const intervalMs = intervalMinutes * 60_000;

  const run = async () => {
    await runEmailOpsMonitor().catch((err) =>
      console.error("[email-ops] Unhandled scheduler error:", err instanceof Error ? err.message : String(err))
    );
  };

  void run();
  monitorTimer = setInterval(() => {
    void run();
  }, intervalMs);

  console.log(`[email-ops] Monitor started with ${intervalMinutes} minute interval`);
}

export function stopEmailOpsMonitorScheduler(): void {
  if (!monitorTimer) return;
  clearInterval(monitorTimer);
  monitorTimer = null;
}
