import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";
import { getRequestContext } from "./request-context";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn("RESEND_API_KEY is not set — email features will be unavailable");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const PLATFORM_FROM = "TradeWorkDesk <noreply@tradeworkdesk.co.uk>";
const FROM_EMAIL = "noreply@tradeworkdesk.co.uk";
const OPS_EMAIL_FAILURE_RECIPIENT = (process.env.EMAIL_FAILURE_ALERT_RECIPIENT || "info@tradeworkdesk.co.uk").trim().toLowerCase();
const USER_SAFE_EMAIL_FAILURE_MESSAGE = "We couldn't send that email right now. Please try again.";
const USER_ACTIONABLE_RECIPIENT_FAILURE_MESSAGE = "We couldn't deliver this email to the recipient. Please check the email address and ask the recipient to verify their mailbox can receive emails.";
let sendingFailureAlert = false;

type EmailFailureCategory = "recipient" | "provider" | "platform" | "unknown";

export type TenantEmailAuditStatus =
  | "queued"
  | "accepted"
  | "delivered"
  | "deferred"
  | "bounced"
  | "complained"
  | "suppressed"
  | "failed"
  | "sent";

export interface TenantEmailAuditRecord {
  tenantId?: string;
  actorId?: string;
  status: TenantEmailAuditStatus;
  emailType?: string;
  to: string;
  subject: string;
  from?: string;
  replyTo?: string;
  provider?: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  failureCategory?: EmailFailureCategory;
  needsAction?: boolean;
  retryCount?: number;
  nextRetryAt?: string | null;
  providerEventAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

function isTransientProviderFailure(reasonLike: string): boolean {
  const reason = reasonLike.toLowerCase();
  return [
    "429",
    "rate limit",
    "timeout",
    "timed out",
    "503",
    "502",
    "504",
    "temporarily unavailable",
    "temporary",
    "network",
    "connection",
    "socket",
  ].some((signal) => reason.includes(signal));
}

function normalizeStatus(status: TenantEmailAuditStatus): TenantEmailAuditStatus {
  return status === "sent" ? "accepted" : status;
}

function sanitizeErrorForEmail(errorLike: unknown): string {
  if (errorLike instanceof Error) return errorLike.message;
  return String(errorLike);
}

export async function notifyEmailDeliveryFailure(details: {
  to: string;
  subject: string;
  reason: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  if (!resend || sendingFailureAlert) return;

  sendingFailureAlert = true;
  try {
    const timestamp = new Date().toISOString();
    const html = `<div style="font-family:sans-serif;font-size:14px;color:#1e293b;max-width:680px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 16px;color:#b91c1c;">Email Delivery Failure Alert</h2>
      <p style="margin:0 0 12px;">A tenant email send failed and requires attention.</p>
      <table style="border-collapse:collapse;width:100%;margin:8px 0 16px;">
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">When (UTC)</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${escHtml(timestamp)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">Environment</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${escHtml(process.env.NODE_ENV || "unknown")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">App URL</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${escHtml(process.env.APP_URL || "not set")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">Recipient</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${escHtml(details.to)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">Subject</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${escHtml(details.subject)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">From</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${escHtml(details.from || "not set")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;">Reply-To</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${escHtml(details.replyTo || "not set")}</td></tr>
      </table>
      <p style="margin:0 0 6px;font-weight:600;">Error</p>
      <pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-word;">${escHtml(details.reason)}</pre>
      <p style="font-size:12px;color:#64748b;margin-top:16px;">This alert was generated automatically by TradeWorkDesk.</p>
    </div>`;

    const { error } = await resend.emails.send({
      from: PLATFORM_FROM,
      to: OPS_EMAIL_FAILURE_RECIPIENT,
      subject: "[TradeWorkDesk] Tenant email delivery failure",
      html,
    } as Parameters<typeof resend.emails.send>[0]);

    if (error) {
      console.error("[email-alert] Failed to send failure alert:", error.message ?? JSON.stringify(error));
    }
  } catch (err) {
    console.error("[email-alert] Failed to process failure alert:", sanitizeErrorForEmail(err));
  } finally {
    sendingFailureAlert = false;
  }
}

export function getUserSafeEmailFailureMessage(): string {
  return USER_SAFE_EMAIL_FAILURE_MESSAGE;
}

function isRecipientAddressOrMailboxFailure(reasonLike: string): boolean {
  const reason = reasonLike.toLowerCase();
  const recipientSignals = [
    "invalid recipient",
    "invalid email",
    "invalid to",
    "recipient address rejected",
    "recipient rejected",
    "no such user",
    "user unknown",
    "mailbox unavailable",
    "mailbox full",
    "mailbox is full",
    "mailbox not found",
    "undeliverable",
    "bounced",
    "suppressed",
    "inactive recipient",
    "domain not found",
    "does not exist",
    "5.1.1",
    "5.2.2",
    "550",
  ];

  return recipientSignals.some((signal) => reason.includes(signal));
}

export function getTenantEmailFailureMessage(reasonLike?: string): string {
  if (!reasonLike) return USER_SAFE_EMAIL_FAILURE_MESSAGE;
  return isRecipientAddressOrMailboxFailure(reasonLike)
    ? USER_ACTIONABLE_RECIPIENT_FAILURE_MESSAGE
    : USER_SAFE_EMAIL_FAILURE_MESSAGE;
}

function inferEmailFailureCategory(reasonLike?: string): EmailFailureCategory {
  if (!reasonLike) return "unknown";
  const reason = reasonLike.toLowerCase();

  if (isRecipientAddressOrMailboxFailure(reason)) return "recipient";
  if (reason.includes("resend") || reason.includes("rate limit") || reason.includes("429") || reason.includes("service unavailable") || reason.includes("timeout")) return "provider";
  if (reason.includes("not configured") || reason.includes("api key") || reason.includes("tradeworkdesk") || reason.includes("twd")) return "platform";
  return "unknown";
}

export async function writeTenantEmailAudit(record: TenantEmailAuditRecord): Promise<void> {
  const ctx = getRequestContext();
  const tenantId = (record.tenantId || ctx?.tenantId || "").trim();
  if (!tenantId) return;

  const actorId = (record.actorId || ctx?.userId || null) as string | null;
  const failureCategory = record.status === "failed"
    ? (record.failureCategory || inferEmailFailureCategory(record.errorMessage || undefined))
    : null;
  const normalizedStatus = normalizeStatus(record.status);
  const needsAction = typeof record.needsAction === "boolean"
    ? record.needsAction
    : (normalizedStatus === "failed" && (failureCategory === "recipient" || failureCategory === "unknown"));

  const payload = {
    tenant_id: tenantId,
    actor_id: actorId,
    status: normalizedStatus,
    email_type: record.emailType || "general",
    provider: record.provider || "resend",
    provider_message_id: record.providerMessageId || null,
    to_email: String(record.to || "").trim().toLowerCase() || null,
    subject: record.subject || "",
    from_email: record.from || null,
    reply_to: record.replyTo || null,
    error_message: record.errorMessage || null,
    failure_category: failureCategory,
    needs_action: needsAction,
    retry_count: record.retryCount ?? 0,
    last_retry_at: (record.retryCount ?? 0) > 0 ? new Date().toISOString() : null,
    next_retry_at: record.nextRetryAt || null,
    provider_event_at: record.providerEventAt || null,
    request_path: ctx?.originalUrl || null,
    metadata: record.metadata || null,
  };

  const { error } = await supabaseAdmin.from("tenant_email_audit_log").insert(payload);
  if (error) {
    console.error("[email-audit] Failed to write tenant email audit row:", error.message);
  }
}

export async function updateTenantEmailAuditLifecycleByMessageId(args: {
  providerMessageId: string;
  status: TenantEmailAuditStatus;
  errorMessage?: string | null;
  failureCategory?: EmailFailureCategory;
  providerEventAt?: string | null;
  metadataPatch?: Record<string, unknown> | null;
}): Promise<void> {
  const providerMessageId = String(args.providerMessageId || "").trim();
  if (!providerMessageId) return;

  const status = normalizeStatus(args.status);
  const failureCategory = status === "failed" || status === "bounced" || status === "suppressed"
    ? (args.failureCategory || inferEmailFailureCategory(args.errorMessage || undefined))
    : null;
  const needsAction = status === "bounced" || status === "suppressed" || status === "failed";

  const { data: existing } = await supabaseAdmin
    .from("tenant_email_audit_log")
    .select("id, metadata")
    .eq("provider_message_id", providerMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing?.id) return;
  const existingMetadata = (existing.metadata as Record<string, unknown> | null) || {};
  const mergedMetadata = args.metadataPatch
    ? { ...existingMetadata, ...args.metadataPatch }
    : existingMetadata;

  const { error } = await supabaseAdmin
    .from("tenant_email_audit_log")
    .update({
      status,
      error_message: args.errorMessage || null,
      failure_category: failureCategory,
      needs_action: needsAction,
      provider_event_at: args.providerEventAt || new Date().toISOString(),
      metadata: mergedMetadata,
    })
    .eq("id", existing.id);

  if (error) {
    console.error("[email-audit] Failed lifecycle update:", error.message);
  }
}

export async function isEmailSuppressedForTenant(args: {
  tenantId?: string;
  email: string;
  scope?: "all" | "marketing" | "review_requests" | "campaigns";
}): Promise<boolean> {
  const tenantId = String(args.tenantId || getRequestContext()?.tenantId || "").trim();
  const email = String(args.email || "").trim().toLowerCase();
  if (!tenantId || !email) return false;
  const scope = args.scope || "all";

  const { data, error } = await supabaseAdmin
    .from("tenant_email_suppressions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .in("scope", ["all", scope])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[email-suppression] Lookup failed:", error.message);
    return false;
  }
  return !!data;
}

export async function sendResendEmailWithRetry(
  sendOptions: Parameters<NonNullable<typeof resend>["emails"]["send"]>[0],
): Promise<{ messageId: string; attempts: number }> {
  if (!resend) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing)");
  }

  const maxRetries = Math.max(0, Number(process.env.EMAIL_SEND_MAX_RETRIES || "2") || 2);
  const baseDelayMs = Math.max(100, Number(process.env.EMAIL_SEND_RETRY_BASE_DELAY_MS || "400") || 400);
  const requestTimeoutMs = Math.max(1000, Number(process.env.EMAIL_SEND_TIMEOUT_MS || "15000") || 15000);
  let attempts = 0;
  let lastErrorReason = "Unknown email send failure";

  while (attempts <= maxRetries) {
    attempts += 1;
    const { data, error } = await withTimeout(
      resend.emails.send(sendOptions),
      requestTimeoutMs,
      `Email provider timeout after ${requestTimeoutMs}ms`,
    );
    if (!error && data?.id) {
      return { messageId: data.id, attempts };
    }

    lastErrorReason = error?.message || "Email provider did not return a message id";
    if (!isTransientProviderFailure(lastErrorReason) || attempts > maxRetries) {
      throw new Error(lastErrorReason);
    }

    const jitterMs = Math.floor(Math.random() * 120);
    const delayMs = baseDelayMs * Math.pow(2, attempts - 1) + jitterMs;
    await sleep(delayMs);
  }

  throw new Error(lastErrorReason);
}

/** Builds a per-tenant FROM address using the company name as the display name.
 * Prefers email_from_name if set (white-label), otherwise uses trading_name or name.
 */
function buildTenantFrom(company?: EmailCompanyDetails): string {
  const name = company?.email_from_name || company?.trading_name || company?.name;
  return name ? `${name} <${FROM_EMAIL}>` : PLATFORM_FROM;
}

// Keep backward-compat alias used by platform-level emails below
const FROM = PLATFORM_FROM;

export interface EmailCompanyDetails {
  name?: string | null;
  trading_name?: string | null;
  logo_url?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  phone?: string | null;
  email?: string | null;
  notification_emails?: string[] | null;
  website?: string | null;
  gas_safe_number?: string | null;
  oftec_number?: string | null;
  vat_number?: string | null;
  rates_url?: string | null;
  trading_terms_url?: string | null;
  // White-label email branding
  email_from_name?: string | null;
  email_reply_to?: string | null;
}

function normalizeAdditionalRecipients(
  extra: string[] | null | undefined,
  to: string,
  replyTo?: string,
): string[] {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const blacklist = new Set([to.toLowerCase(), (replyTo || "").toLowerCase()]);
  return Array.from(
    new Set(
      (extra || [])
        .map((email) => String(email).trim().toLowerCase())
        .filter((email) => email && EMAIL_RE.test(email) && !blacklist.has(email)),
    ),
  );
}

function renderCompanyHeader(company?: EmailCompanyDetails): string {
  if (!company) {
    return `
    <div class="header">
      <a href="https://www.tradeworkdesk.co.uk" style="text-decoration:none;color:#fff;" target="_blank">
        <div class="header-brand">
          <div class="header-logo">🔥</div>
          <div>
            <h1>TradeWorkDesk</h1>
            <p>Professional Boiler Service Management</p>
          </div>
        </div>
      </a>
    </div>`;
  }

  const companyName = company.name || company.trading_name || "Your Service Provider";

  const logoHtml = company.logo_url
    ? `<div style="background:#fff;display:inline-block;padding:10px 16px;border-radius:8px;margin-bottom:14px;"><img src="${escHtml(company.logo_url)}" alt="${escHtml(companyName)}" style="max-height:50px;max-width:180px;display:block;" /></div>`
    : "";

  return `
    <div class="header" style="background:#1d4ed8;padding:28px 32px;color:#fff;">
      ${logoHtml}
      <div style="font-size:24px;font-weight:800;letter-spacing:-.5px;margin:0;">${companyName}</div>
    </div>`;
}

function renderDocumentLinks(company?: EmailCompanyDetails): string {
  if (!company) return "";
  const links: string[] = [];
  if (company.rates_url) {
    const href = company.rates_url.startsWith("http") ? company.rates_url : `https://${company.rates_url}`;
    links.push(`<a href="${escHtml(href)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;padding:10px 20px;font-weight:600;font-size:13px;margin-right:10px;" target="_blank">View Our Rates</a>`);
  }
  if (company.trading_terms_url) {
    const href = company.trading_terms_url.startsWith("http") ? company.trading_terms_url : `https://${company.trading_terms_url}`;
    links.push(`<a href="${escHtml(href)}" style="display:inline-block;background:#475569;color:#fff;text-decoration:none;border-radius:6px;padding:10px 20px;font-weight:600;font-size:13px;" target="_blank">View Our Trading Terms</a>`);
  }
  if (links.length === 0) return "";
  return `
    <div style="margin:20px 0;padding:16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;text-align:center;">
      <p style="margin:0 0 12px;font-size:13px;color:#0c4a6e;font-weight:600;">Important Documents</p>
      <div>${links.join("")}</div>
    </div>`;
}

function baseHtml(title: string, body: string, company?: EmailCompanyDetails): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .header { background: #1d4ed8; padding: 24px 32px; color: #fff; }
    .header-brand { display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 40px; height: 40px; background: rgba(255,255,255,.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.3px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: .8; }
    .body { padding: 32px; color: #1e293b; line-height: 1.6; }
    .body h2 { margin-top: 0; font-size: 18px; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; padding: 12px 24px; font-weight: 600; font-size: 14px; }
    .footer { padding: 20px 32px; background: #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .info-box p { margin: 4px 0; font-size: 14px; }
    .warning-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .danger-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    ${renderCompanyHeader(company)}
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <a href="https://www.tradeworkdesk.co.uk" style="color:#1d4ed8;font-weight:600;font-size:13px;text-decoration:none;" target="_blank">Powered by TradeWorkDesk</a>
      <span style="display:block;margin:4px 0 8px;font-size:11px;color:#94a3b8;">Simplify your trade service business &mdash; <a href="https://www.tradeworkdesk.co.uk" style="color:#1d4ed8;text-decoration:underline;" target="_blank">Learn more</a></span>
      &copy; ${new Date().getFullYear()} TradeWorkDesk Ltd. All rights reserved.<br/>
      <span style="margin-top:6px; display:block;">To stop receiving emails, contact us at <a href="mailto:support@tradeworkdesk.co.uk" style="color:#64748b;">support@tradeworkdesk.co.uk</a> to unsubscribe.</span>
    </div>
  </div>
</body>
</html>`;
}

async function send(
  to: string,
  subject: string,
  html: string,
  opts?: {
    from?: string;
    replyTo?: string;
    emailType?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedTo = String(to || "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedTo)) {
    await notifyEmailDeliveryFailure({
      to: normalizedTo || String(to || ""),
      subject,
      reason: "invalid recipient email format",
      from: opts?.from || FROM,
      replyTo: opts?.replyTo,
    });
    await writeTenantEmailAudit({
      tenantId: opts?.tenantId,
      status: "failed",
      emailType: opts?.emailType || "general",
      to: normalizedTo || String(to || ""),
      subject,
      from: opts?.from || FROM,
      replyTo: opts?.replyTo,
      errorMessage: "invalid recipient email format",
      failureCategory: "recipient",
      metadata: opts?.metadata,
    });
    throw new Error(getTenantEmailFailureMessage("invalid recipient email format"));
  }

  if (!resend) {
    await writeTenantEmailAudit({
      tenantId: opts?.tenantId,
      status: "failed",
      emailType: opts?.emailType || "general",
      to: normalizedTo,
      subject,
      from: opts?.from || FROM,
      replyTo: opts?.replyTo,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
      metadata: opts?.metadata,
    });
    throw new Error(getTenantEmailFailureMessage());
  }
  const sendOpts: any = {
    from: opts?.from || FROM,
    to: normalizedTo,
    subject,
    html,
  };
  const normalizedReplyTo = String(opts?.replyTo || "").trim().toLowerCase();
  if (normalizedReplyTo && EMAIL_RE.test(normalizedReplyTo)) {
    sendOpts.replyTo = normalizedReplyTo;
  }
  await writeTenantEmailAudit({
    tenantId: opts?.tenantId,
    status: "queued",
    emailType: opts?.emailType || "general",
    to: normalizedTo,
    subject,
    from: String(sendOpts.from || FROM),
    replyTo: normalizedReplyTo || undefined,
    metadata: opts?.metadata,
  });

  try {
    const result = await sendResendEmailWithRetry(sendOpts);
    await writeTenantEmailAudit({
      tenantId: opts?.tenantId,
      status: "accepted",
      emailType: opts?.emailType || "general",
      to: normalizedTo,
      subject,
      from: String(sendOpts.from || FROM),
      replyTo: normalizedReplyTo || undefined,
      providerMessageId: result.messageId,
      retryCount: Math.max(0, result.attempts - 1),
      metadata: opts?.metadata,
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send "${subject}" to ${normalizedTo}:`, reason);
    await notifyEmailDeliveryFailure({
      to: normalizedTo,
      subject,
      reason,
      from: String(sendOpts.from || FROM),
      replyTo: normalizedReplyTo || undefined,
    });
    await writeTenantEmailAudit({
      tenantId: opts?.tenantId,
      status: "failed",
      emailType: opts?.emailType || "general",
      to: normalizedTo,
      subject,
      from: String(sendOpts.from || FROM),
      replyTo: normalizedReplyTo || undefined,
      errorMessage: reason,
      metadata: opts?.metadata,
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}

export async function sendConfirmationEmail(
  to: string,
  contactName: string,
  companyName: string,
  confirmUrl: string,
  company?: EmailCompanyDetails,
): Promise<void> {
  const html = baseHtml("Confirm your TradeWorkDesk account", `
    <h2>Welcome to TradeWorkDesk, ${contactName}!</h2>
    <p>Your company account for <strong>${companyName}</strong> has been created. Please confirm your email address to activate your account and start your 30-day free trial.</p>
    <p style="margin-top:24px;">
      <a href="${confirmUrl}" class="btn">Confirm Email Address</a>
    </p>
    <hr class="divider"/>
    <p style="font-size:13px; color:#64748b;">This link expires in 24 hours. If you didn't create a TradeWorkDesk account, you can safely ignore this email.</p>
  `);
  const from = company ? buildTenantFrom(company) : FROM;
  const replyTo = company?.email_reply_to || undefined;
  await send(to, "TradeWorkDesk — Please confirm your email address", html, { from, replyTo, emailType: "account_confirmation" });
}

export async function sendWelcomeEmail(
  to: string,
  companyName: string,
  trialEndsAt: string,
  company?: EmailCompanyDetails,
): Promise<void> {
  const trialDate = new Date(trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const html = baseHtml("Welcome to TradeWorkDesk", `
    <h2>Welcome to TradeWorkDesk, ${companyName}!</h2>
    <p>Your account is set up and ready to go. You're on a 30-day free trial until <strong>${trialDate}</strong>.</p>
    <p>During your trial you have full access to all features:</p>
    <ul>
      <li>Job management &amp; scheduling</li>
      <li>Customer &amp; property records</li>
      <li>Service records &amp; commissioning forms</li>
      <li>Reports &amp; analytics</li>
    </ul>
    <p style="margin-top:24px;">
      <a href="https://tradeworkdesk.co.uk" class="btn">Open TradeWorkDesk</a>
    </p>
    <hr class="divider"/>
    <p style="font-size:13px; color:#64748b;">If you have any questions, reply to this email and we'll be happy to help.</p>
  `);
  const from = company ? buildTenantFrom(company) : FROM;
  const replyTo = company?.email_reply_to || undefined;
  await send(to, "Welcome to TradeWorkDesk — your trial has started", html, { from, replyTo, emailType: "welcome" });
}

export async function sendBetaInviteCodeEmail(
  to: string,
  code: string,
  inviteUrl: string,
  opts?: {
    expiresAt?: string | null;
    maxUses?: number | null;
    notes?: string | null;
  },
): Promise<void> {
  const expiry = opts?.expiresAt
    ? new Date(opts.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const usageText = opts?.maxUses && opts.maxUses > 1
    ? `This code can be used up to ${opts.maxUses} times.`
    : "This code can be used once.";
  const notesHtml = opts?.notes
    ? `<p><strong>Notes:</strong> ${escHtml(opts.notes)}</p>`
    : "";

  const html = baseHtml("Your TradeWorkDesk beta invite", `
    <h2>You are invited to TradeWorkDesk beta</h2>
    <p>Use the invite code below during sign-up:</p>
    <div class="info-box">
      <p><strong>Invite code:</strong> <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px;">${escHtml(code)}</span></p>
      <p>${usageText}</p>
      ${expiry ? `<p><strong>Expires:</strong> ${expiry}</p>` : ""}
      ${notesHtml}
    </div>
    <p style="margin-top:24px;">
      <a href="${escHtml(inviteUrl)}" class="btn">Register with Invite</a>
    </p>
    <hr class="divider"/>
    <p style="font-size:13px; color:#64748b;">If the button does not work, use this link: <br/><a href="${escHtml(inviteUrl)}">${escHtml(inviteUrl)}</a></p>
  `);

  await send(to, "TradeWorkDesk Beta Invite", html, { emailType: "beta_invite" });
}

export async function sendInvoiceEmail(
  to: string,
  companyName: string,
  amount: number,
  currency: string,
  periodEnd: string,
  invoiceUrl: string,
  company?: EmailCompanyDetails,
): Promise<void> {
  const date = new Date(periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  const html = baseHtml("Payment Received", `
    <h2>Payment received — thank you!</h2>
    <p>Hi ${companyName},</p>
    <p>We've successfully received your payment for your TradeWorkDesk subscription.</p>
    <div class="info-box">
      <p><strong>Amount:</strong> ${formatted}</p>
      <p><strong>Next renewal:</strong> ${date}</p>
    </div>
    <p>
      <a href="${invoiceUrl}" class="btn">View Invoice</a>
    </p>
  `);
  const from = company ? buildTenantFrom(company) : FROM;
  const replyTo = company?.email_reply_to || undefined;
  await send(to, `TradeWorkDesk — Payment received (${formatted})`, html, { from, replyTo, emailType: "payment_confirmation" });
}

export async function sendTrialExpiryReminder(
  to: string,
  companyName: string,
  daysLeft: number,
  billingUrl: string,
  company?: EmailCompanyDetails,
): Promise<void> {
  const urgency = daysLeft <= 1 ? "today" : `in ${daysLeft} days`;
  const html = baseHtml("Your trial is ending soon", `
    <h2>Your trial expires ${urgency}</h2>
    <p>Hi ${companyName},</p>
    <div class="warning-box">
      <p><strong>Your TradeWorkDesk trial expires ${urgency}.</strong></p>
      <p>To keep access to your data and continue using TradeWorkDesk, please upgrade to a paid plan.</p>
    </div>
    <p>Upgrading takes less than 2 minutes. Your data will remain intact.</p>
    <p style="margin-top:24px;">
      <a href="${billingUrl}" class="btn">Upgrade Now</a>
    </p>
  `);
  const from = company ? buildTenantFrom(company) : FROM;
  const replyTo = company?.email_reply_to || undefined;
  await send(to, `TradeWorkDesk — Your trial expires ${urgency}`, html, { from, replyTo, emailType: "trial_expiry" });
}

export async function sendRenewalReminder(
  to: string,
  companyName: string,
  renewalDate: string,
  amount: number,
  currency: string,
  billingUrl: string,
  company?: EmailCompanyDetails,
): Promise<void> {
  const date = new Date(renewalDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  const html = baseHtml("Upcoming renewal", `
    <h2>Your subscription renews on ${date}</h2>
    <p>Hi ${companyName},</p>
    <p>This is a reminder that your TradeWorkDesk subscription will automatically renew on <strong>${date}</strong>.</p>
    <div class="info-box">
      <p><strong>Renewal amount:</strong> ${formatted}</p>
      <p><strong>Renewal date:</strong> ${date}</p>
    </div>
    <p>To update your payment details or manage your subscription:</p>
    <p style="margin-top:24px;">
      <a href="${billingUrl}" class="btn">Manage Billing</a>
    </p>
  `);
  const from = company ? buildTenantFrom(company) : FROM;
  const replyTo = company?.email_reply_to || undefined;
  await send(to, `TradeWorkDesk — Subscription renews on ${date}`, html, { from, replyTo, emailType: "subscription_renewal" });
}

export async function sendLowCreditsAlert(
  to: string,
  companyName: string,
  addonName: string,
  creditsRemaining: number,
  bundleSize: number,
  unitLabel: string,
  billingUrl: string,
  company?: EmailCompanyDetails,
): Promise<void> {
  const isEmpty = creditsRemaining === 0;
  const boxClass = isEmpty ? "danger-box" : "warning-box";
  const heading = isEmpty
    ? `You have no ${addonName} credits left`
    : `Your ${addonName} credits are running low`;
  const urgencyLine = isEmpty
    ? `<strong>You have 0 ${unitLabel} remaining.</strong> This feature is now unavailable until you purchase more credits.`
    : `<strong>You have ${creditsRemaining.toLocaleString()} ${unitLabel} remaining</strong> (less than 10% of a standard bundle of ${bundleSize.toLocaleString()}).`;

  const html = baseHtml(heading, `
    <h2>${heading}</h2>
    <p>Hi ${escHtml(companyName)},</p>
    <div class="${boxClass}">
      <p>${urgencyLine}</p>
    </div>
    <p>Top up your credits on the Billing page to keep using this feature without interruption.</p>
    <p style="margin-top:24px;">
      <a href="${billingUrl}" class="btn">Top Up Credits</a>
    </p>
    <hr class="divider"/>
    <p style="font-size:13px; color:#64748b;">Credits are purchased in bundles of ${bundleSize.toLocaleString()} ${unitLabel}. You can buy as many bundles as you need.</p>
  `);
  const subject = isEmpty
    ? `TradeWorkDesk — ${addonName} credits exhausted`
    : `TradeWorkDesk — ${addonName} credits running low`;
  const from = company ? buildTenantFrom(company) : FROM;
  const replyTo = company?.email_reply_to || undefined;

  await send(to, subject, html, { from, replyTo, emailType: "invoice_email" });
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendJobFormsEmail(
  to: string,
  cc: string | null,
  subject: string,
  jobRef: string,
  customerName: string,
  companyName: string,
  formLabels: string[],
  attachments: EmailAttachment[],
  companyDetails?: EmailCompanyDetails,
  photosAttached?: number,
  customerMessage?: string | null,
): Promise<void> {
  const hasForms = formLabels.length > 0;
  const hasPhotos = (photosAttached || 0) > 0;

  const formListHtml = hasForms
    ? formLabels.map(label => `<li style="margin:4px 0;font-size:14px;">${escHtml(label)}</li>`).join("\n")
    : "";

  const contactLine = companyDetails?.phone
    ? `please contact us on <strong>${escHtml(companyDetails.phone)}</strong>${companyDetails.email ? ` or email <a href="mailto:${escHtml(companyDetails.email)}" style="color:#1d4ed8;">${escHtml(companyDetails.email)}</a>` : ""}.`
    : "please contact your service provider directly.";

  const headingParts: string[] = [];
  if (hasForms) headingParts.push("Forms");
  if (hasPhotos) headingParts.push("Photos");
  const heading = `Job ${headingParts.join(" &amp; ")} &mdash; ${escHtml(jobRef)}`;

  const introParts: string[] = [];
  if (hasForms) introParts.push("completed service form(s)");
  if (hasPhotos) introParts.push(`${photosAttached} photo(s)`);
  const introText = `Please find attached the ${introParts.join(" and ")} for your recent job carried out by <strong>${escHtml(companyName)}</strong>.`;

  const formsSection = hasForms ? `
    <div class="info-box">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Attached Forms:</p>
      <ul style="margin:0;padding-left:20px;">
        ${formListHtml}
      </ul>
    </div>` : "";

  const photosSection = hasPhotos ? `
    <div class="info-box">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Attached Photos: ${photosAttached}</p>
    </div>` : "";

  const customerMessageSection = customerMessage && customerMessage.trim().length > 0 ? `
    <div class="info-box" style="border-color:#bfdbfe;background:#eff6ff;">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Message from your engineer:</p>
      <p style="margin:0;white-space:pre-wrap;">${escHtml(customerMessage.trim())}</p>
    </div>` : "";

  const html = baseHtml(escHtml(subject), `
    <h2>${heading}</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>${introText}</p>
    ${formsSection}
    ${photosSection}
    ${customerMessageSection}
    <p>These documents contain the full details of the work completed at your property. Please retain them for your records.</p>
    <p>If you have any questions about the work carried out, ${contactLine}</p>
    ${renderDocumentLinks(companyDetails)}
    <hr class="divider"/>
    <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
  `, companyDetails);
  if (!resend) {
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "job_forms",
      to,
      subject,
      from: FROM,
      replyTo: companyDetails?.email ?? undefined,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
      metadata: { jobRef },
    });
    throw new Error(getTenantEmailFailureMessage());
  }
  const recipients: string[] = [to];
  const sendOptions: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    cc?: string[];
    replyTo?: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  } = { from: FROM, to: recipients, subject, html };
  if (cc) sendOptions.cc = [cc];
  if (companyDetails?.email) sendOptions.replyTo = companyDetails.email;
  if (attachments.length > 0) sendOptions.attachments = attachments;
  try {
    const sendResult = await sendResendEmailWithRetry(sendOptions as any);
    await writeTenantEmailAudit({
      status: "accepted",
      emailType: "job_forms",
      to,
      subject,
      from: FROM,
      replyTo: companyDetails?.email ?? undefined,
      providerMessageId: sendResult.messageId,
      retryCount: Math.max(0, sendResult.attempts - 1),
      metadata: { jobRef },
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send "${subject}" to ${to}:`, reason);
    await notifyEmailDeliveryFailure({
      to,
      subject,
      reason,
      from: FROM,
      replyTo: companyDetails?.email ?? undefined,
    });
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "job_forms",
      to,
      subject,
      from: FROM,
      replyTo: companyDetails?.email ?? undefined,
      errorMessage: reason,
      metadata: { jobRef },
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}

export interface JobConfirmationDetails {
  jobRef: string;
  jobType: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  jobDurationMinutes?: number | null;
  propertyAddress: string;
  technicianName?: string | null;
  description?: string | null;
}

export interface JobConfirmationResponseLinks {
  confirmUrl: string;
  requestChangeUrl: string;
}

export interface EnquiryAcknowledgementDetails {
  enquiryId: string;
  source?: string | null;
  description?: string | null;
  priority?: string | null;
}

function formatJobDurationLabel(minutesLike: unknown): string | null {
  const minutes = Number(minutesLike);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes / 60 === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) return `${minutes} minutes`;
  return `${hours}h ${remainder}m`;
}

export function renderJobConfirmationHtml(
  customerName: string,
  companyName: string,
  jobDetails: JobConfirmationDetails,
  companyDetails?: EmailCompanyDetails,
  responseLinks?: JobConfirmationResponseLinks,
): string {
  const dateStr = new Date(jobDetails.scheduledDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  let timeStr = "";
  if (jobDetails.scheduledTime) {
    const [hh, mm] = jobDetails.scheduledTime.split(":");
    const h = parseInt(hh, 10);
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    timeStr = ` at ${h12}:${mm}${ampm}`;
  }
  const durationLabel = formatJobDurationLabel(jobDetails.jobDurationMinutes);

  const contactLine = companyDetails?.phone
    ? `please contact us on <strong>${escHtml(companyDetails.phone)}</strong>${companyDetails.email ? ` or email <a href="mailto:${escHtml(companyDetails.email)}" style="color:#1d4ed8;">${escHtml(companyDetails.email)}</a>` : ""}.`
    : `please contact <strong>${escHtml(companyName)}</strong> directly.`;

  const subject = `Appointment Confirmation — ${escHtml(jobDetails.jobRef)}`;

  const contactDetails: string[] = [];
  if (companyDetails?.phone) contactDetails.push(`<span>📞 <a href="tel:${escHtml(companyDetails.phone)}" style="color:#1d4ed8;text-decoration:none;">${escHtml(companyDetails.phone)}</a></span>`);
  if (companyDetails?.email) contactDetails.push(`<span>✉️ <a href="mailto:${escHtml(companyDetails.email)}" style="color:#1d4ed8;text-decoration:none;">${escHtml(companyDetails.email)}</a></span>`);
  if (companyDetails?.website) contactDetails.push(`<span>🌐 <a href="${escHtml(companyDetails.website.startsWith("http") ? companyDetails.website : `https://${companyDetails.website}`)}" style="color:#1d4ed8;text-decoration:none;" target="_blank">${escHtml(companyDetails.website)}</a></span>`);

  const contactAddressParts = [companyDetails?.address_line1, companyDetails?.address_line2, companyDetails?.city, companyDetails?.county, companyDetails?.postcode].filter(Boolean);

  const contactSection = (contactDetails.length > 0 || contactAddressParts.length > 0) ? `
    <div class="info-box" style="margin-top:20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e293b;">${escHtml(companyName)} — Contact Details</p>
      ${contactDetails.length > 0 ? `<p style="margin:4px 0;font-size:14px;">${contactDetails.join(" &nbsp;&bull;&nbsp; ")}</p>` : ""}
      ${contactAddressParts.length > 0 ? `<p style="margin:4px 0;font-size:13px;color:#64748b;">📍 ${escHtml(contactAddressParts.join(", "))}</p>` : ""}
    </div>` : "";

  const responseActions = responseLinks ? `
    <div class="info-box" style="margin-top:16px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1e293b;">Please confirm this appointment</p>
      <p style="margin:0 0 14px;font-size:13px;color:#475569;">Use one of the options below so the office can plan your visit accurately.</p>
      <p style="margin:0 0 10px;">
        <a href="${escHtml(responseLinks.confirmUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;border-radius:8px;padding:10px 16px;font-weight:600;font-size:13px;">Confirm appointment</a>
      </p>
      <p style="margin:0;">
        <a href="${escHtml(responseLinks.requestChangeUrl)}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;border-radius:8px;padding:10px 16px;font-weight:600;font-size:13px;">Request date change</a>
      </p>
    </div>
  ` : "";

  return baseHtml(subject, `
    <h2>Appointment Confirmation</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>We're writing to confirm your upcoming appointment with <strong>${escHtml(companyName)}</strong>.</p>
    <div class="info-box">
      <p><strong>Job Reference:</strong> ${escHtml(jobDetails.jobRef)}</p>
      <p><strong>Type of Work:</strong> ${escHtml(jobDetails.jobType)}</p>
      <p><strong>Date:</strong> ${escHtml(dateStr)}${escHtml(timeStr)}</p>
      ${durationLabel ? `<p><strong>Job Duration:</strong> ${escHtml(durationLabel)}</p>` : ""}
      <p><strong>Property:</strong> ${escHtml(jobDetails.propertyAddress)}</p>
      ${jobDetails.technicianName ? `<p><strong>Engineer:</strong> ${escHtml(jobDetails.technicianName)}</p>` : ""}
    </div>
    ${responseActions}
    ${jobDetails.description ? `<p><strong>Notes:</strong> ${escHtml(jobDetails.description)}</p>` : ""}
    <p>Please ensure there is access to the property at the scheduled time. If you need to reschedule or have any questions, ${contactLine}</p>
    ${renderDocumentLinks(companyDetails)}
    ${contactSection}
    <hr class="divider"/>
    <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
  `, companyDetails);
}

export async function sendJobConfirmationEmail(
  to: string,
  customerName: string,
  companyName: string,
  jobDetails: JobConfirmationDetails,
  companyDetails?: EmailCompanyDetails,
  responseLinks?: JobConfirmationResponseLinks,
): Promise<void> {
  const html = renderJobConfirmationHtml(customerName, companyName, jobDetails, companyDetails, responseLinks);

  if (!resend) {
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "job_confirmation",
      to,
      subject: `Appointment Confirmation — ${escHtml(jobDetails.jobRef)}`,
      from: buildTenantFrom(companyDetails),
      replyTo: companyDetails?.email ?? undefined,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
      metadata: { jobRef: jobDetails.jobRef },
    });
    throw new Error(getTenantEmailFailureMessage());
  }

  const subject = `Appointment Confirmation — ${escHtml(jobDetails.jobRef)}`;
  const replyTo = companyDetails?.email ?? undefined;
  const from = buildTenantFrom(companyDetails);
  const cc = normalizeAdditionalRecipients(companyDetails?.notification_emails, to, replyTo);
  try {
    const sendResult = await sendResendEmailWithRetry({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(cc.length > 0 ? { cc } : {}),
    } as any);
    await writeTenantEmailAudit({
      status: "accepted",
      emailType: "job_confirmation",
      to,
      subject,
      from,
      replyTo,
      providerMessageId: sendResult.messageId,
      retryCount: Math.max(0, sendResult.attempts - 1),
      metadata: { jobRef: jobDetails.jobRef },
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send "${subject}" to ${to}:`, reason);
    await notifyEmailDeliveryFailure({
      to,
      subject,
      reason,
      from,
      replyTo,
    });
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "job_confirmation",
      to,
      subject,
      from,
      replyTo,
      errorMessage: reason,
      metadata: { jobRef: jobDetails.jobRef },
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}

export async function sendEnquiryAcknowledgementEmail(
  to: string,
  customerName: string,
  companyName: string,
  enquiryDetails: EnquiryAcknowledgementDetails,
  companyDetails?: EmailCompanyDetails,
): Promise<void> {
  const subject = `We have logged your enquiry — ${escHtml(companyName)}`;
  const sourceLabel = enquiryDetails.source
    ? String(enquiryDetails.source).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const contactLine = companyDetails?.phone
    ? `please contact us on <strong>${escHtml(companyDetails.phone)}</strong>${companyDetails.email ? ` or email <a href="mailto:${escHtml(companyDetails.email)}" style="color:#1d4ed8;">${escHtml(companyDetails.email)}</a>` : ""}.`
    : `please contact <strong>${escHtml(companyName)}</strong> directly.`;
  const html = baseHtml(subject, `
    <h2>Enquiry received</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>Thank you for getting in touch with <strong>${escHtml(companyName)}</strong>. We have logged your enquiry and a member of our team will review it as soon as possible.</p>
    <div class="info-box">
      <p><strong>Enquiry reference:</strong> ${escHtml(enquiryDetails.enquiryId)}</p>
      ${sourceLabel ? `<p><strong>Source:</strong> ${escHtml(sourceLabel)}</p>` : ""}
      ${enquiryDetails.priority ? `<p><strong>Priority:</strong> ${escHtml(String(enquiryDetails.priority))}</p>` : ""}
    </div>
    ${enquiryDetails.description ? `<p><strong>What you told us:</strong><br/>${escHtml(enquiryDetails.description).replace(/\n/g, "<br/>")}</p>` : ""}
    <p>If you need to add anything to your enquiry, ${contactLine}</p>
    ${renderDocumentLinks(companyDetails)}
    <hr class="divider"/>
    <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
  `, companyDetails);

  if (!resend) {
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "enquiry_acknowledgement",
      to,
      subject,
      from: buildTenantFrom(companyDetails),
      replyTo: companyDetails?.email ?? undefined,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
      metadata: { enquiryId: enquiryDetails.enquiryId },
    });
    throw new Error(getTenantEmailFailureMessage());
  }

  const replyTo = companyDetails?.email ?? undefined;
  const from = buildTenantFrom(companyDetails);
  try {
    const sendResult = await sendResendEmailWithRetry({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    } as any);
    await writeTenantEmailAudit({
      status: "accepted",
      emailType: "enquiry_acknowledgement",
      to,
      subject,
      from,
      replyTo,
      providerMessageId: sendResult.messageId,
      retryCount: Math.max(0, sendResult.attempts - 1),
      metadata: { enquiryId: enquiryDetails.enquiryId },
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send "${subject}" to ${to}:`, reason);
    await notifyEmailDeliveryFailure({
      to,
      subject,
      reason,
      from,
      replyTo,
    });
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "enquiry_acknowledgement",
      to,
      subject,
      from,
      replyTo,
      errorMessage: reason,
      metadata: { enquiryId: enquiryDetails.enquiryId },
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}

export async function sendBookingPendingApprovalEmail(
  to: string,
  customerName: string,
  companyName: string,
  jobDetails: JobConfirmationDetails,
  companyDetails?: EmailCompanyDetails,
): Promise<void> {
  const dateStr = new Date(jobDetails.scheduledDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  let timeStr = "";
  if (jobDetails.scheduledTime) {
    const [hh, mm] = jobDetails.scheduledTime.split(":");
    const h = parseInt(hh, 10);
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    timeStr = ` at ${h12}:${mm}${ampm}`;
  }
  const durationLabel = formatJobDurationLabel(jobDetails.jobDurationMinutes);

  const contactLine = companyDetails?.phone
    ? `please contact us on <strong>${escHtml(companyDetails.phone)}</strong>${companyDetails.email ? ` or email <a href="mailto:${escHtml(companyDetails.email)}" style="color:#1d4ed8;">${escHtml(companyDetails.email)}</a>` : ""}.`
    : `please contact <strong>${escHtml(companyName)}</strong> directly.`;

  const subject = `Booking Request Received — Pending Approval (${escHtml(jobDetails.jobRef)})`;
  const html = baseHtml(subject, `
    <h2>Booking Request Received</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>Thank you for your booking request with <strong>${escHtml(companyName)}</strong>. Your request is currently <strong>pending approval</strong>.</p>
    <div class="warning-box">
      <p style="margin:0;"><strong>This is not yet a confirmed appointment.</strong> Our team will review your request and contact you to confirm.</p>
    </div>
    <div class="info-box">
      <p><strong>Reference:</strong> ${escHtml(jobDetails.jobRef)}</p>
      <p><strong>Type of Work:</strong> ${escHtml(jobDetails.jobType)}</p>
      <p><strong>Requested Date:</strong> ${escHtml(dateStr)}${escHtml(timeStr)}</p>
      ${durationLabel ? `<p><strong>Job Duration:</strong> ${escHtml(durationLabel)}</p>` : ""}
      <p><strong>Property:</strong> ${escHtml(jobDetails.propertyAddress)}</p>
    </div>
    ${jobDetails.description ? `<p><strong>Notes:</strong> ${escHtml(jobDetails.description)}</p>` : ""}
    <p>If you need to update anything about this request, ${contactLine}</p>
    ${renderDocumentLinks(companyDetails)}
    <hr class="divider"/>
    <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
  `, companyDetails);

  if (!resend) {
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "booking_pending_approval",
      to,
      subject,
      from: buildTenantFrom(companyDetails),
      replyTo: companyDetails?.email ?? undefined,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
      metadata: { jobRef: jobDetails.jobRef },
    });
    throw new Error(getTenantEmailFailureMessage());
  }

  const replyTo = companyDetails?.email ?? undefined;
  const from = buildTenantFrom(companyDetails);
  const cc = normalizeAdditionalRecipients(companyDetails?.notification_emails, to, replyTo);
  try {
    const sendResult = await sendResendEmailWithRetry({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(cc.length > 0 ? { cc } : {}),
    } as any);
    await writeTenantEmailAudit({
      status: "accepted",
      emailType: "booking_pending_approval",
      to,
      subject,
      from,
      replyTo,
      providerMessageId: sendResult.messageId,
      retryCount: Math.max(0, sendResult.attempts - 1),
      metadata: { jobRef: jobDetails.jobRef },
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send "${subject}" to ${to}:`, reason);
    await notifyEmailDeliveryFailure({
      to,
      subject,
      reason,
      from,
      replyTo,
    });
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "booking_pending_approval",
      to,
      subject,
      from,
      replyTo,
      errorMessage: reason,
      metadata: { jobRef: jobDetails.jobRef },
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}

export async function sendNewRegistrationNotification(
  to: string,
  newCompanyName: string,
  contactName: string,
  contactEmail: string,
  companyType: string,
): Promise<void> {
  const typeLabel = companyType === "sole_trader" ? "Sole Trader" : "Company";
  const html = baseHtml("New Registration", `
    <h2>New Company Registered</h2>
    <p>A new account has just been created on TradeWorkDesk.</p>
    <div class="info-box">
      <p><strong>Company:</strong> ${escHtml(newCompanyName)}</p>
      <p><strong>Type:</strong> ${typeLabel}</p>
      <p><strong>Contact:</strong> ${escHtml(contactName)}</p>
      <p><strong>Email:</strong> ${escHtml(contactEmail)}</p>
    </div>
    <p>They are now on a 30-day free trial. You can view their account in the platform admin panel.</p>
    <p style="margin-top:24px;">
      <a href="https://www.tradeworkdesk.co.uk/platform" style="display:inline-block;background:#1d4ed8;color:#ffffff !important;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:600;font-size:14px;line-height:1;-webkit-text-size-adjust:none;mso-line-height-rule:exactly;">Open Platform Admin</a>
    </p>
  `);
  await send(to, `TradeWorkDesk — New registration: ${newCompanyName}`, html, { emailType: "new_registration_notification" });
}

export async function sendPortalInviteEmail(to: string, customerName: string, companyName: string, registerUrl: string, companyDetails?: EmailCompanyDetails): Promise<void> {
  const html = baseHtml(`${companyName} — Customer Portal Invitation`, `
    <h2>You've been invited to the Customer Portal</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p><strong>${escHtml(companyName)}</strong> has invited you to access your service records, certificates, invoices, quotes, and property details through our secure customer portal.</p>
    <div class="info-box">
      <p><strong>What you can do:</strong></p>
      <ul style="margin:8px 0 0;padding-left:20px;">
        <li>View your property details and appliance information</li>
        <li>Access service history and job records</li>
        <li>View, download and pay invoices online</li>
        <li>Review and respond to quotes</li>
        <li>Download certificates and reports as PDFs</li>
        <li>See upcoming appointments</li>
      </ul>
    </div>
    <p style="margin-top:24px;">
      <a href="${escHtml(registerUrl)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:600;font-size:14px;">Create Your Account</a>
    </p>
    <hr class="divider"/>
    <p style="font-size:13px; color:#64748b;">This invitation link expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
  `, companyDetails);
  if (!resend) {
    console.error("[email] Resend not configured for portal invite");
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "portal_invite",
      to,
      subject: `${companyName} — You're invited to the Customer Portal`,
      from: buildTenantFrom(companyDetails),
      replyTo: companyDetails?.email ?? undefined,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
      metadata: { registerUrl },
    });
    throw new Error(getTenantEmailFailureMessage());
  }
  const from = buildTenantFrom(companyDetails);
  const replyTo = companyDetails?.email ?? undefined;
  const cc = normalizeAdditionalRecipients(companyDetails?.notification_emails, to, replyTo);
  try {
    const sendResult = await sendResendEmailWithRetry({
    from,
    to,
    subject: `${companyName} — You're invited to the Customer Portal`,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(cc.length > 0 ? { cc } : {}),
    } as any);
    await writeTenantEmailAudit({
      status: "accepted",
      emailType: "portal_invite",
      to,
      subject: `${companyName} — You're invited to the Customer Portal`,
      from,
      replyTo,
      providerMessageId: sendResult.messageId,
      retryCount: Math.max(0, sendResult.attempts - 1),
      metadata: { registerUrl },
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send portal invite to ${to}:`, reason);
    await notifyEmailDeliveryFailure({
      to,
      subject: `${companyName} — You're invited to the Customer Portal`,
      reason,
      from,
      replyTo,
    });
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "portal_invite",
      to,
      subject: `${companyName} — You're invited to the Customer Portal`,
      from,
      replyTo,
      errorMessage: reason,
      metadata: { registerUrl },
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}

export async function sendPaymentFailedEmail(to: string, companyName: string, amount: number, currency: string, billingUrl: string): Promise<void> {
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  const html = baseHtml("Payment failed", `
    <h2>We couldn't process your payment</h2>
    <p>Hi ${companyName},</p>
    <div class="danger-box">
      <p><strong>Payment of ${formatted} failed.</strong></p>
      <p>Please update your payment method to avoid service interruption.</p>
    </div>
    <p>You can update your payment details in the billing portal:</p>
    <p style="margin-top:24px;">
      <a href="${billingUrl}" class="btn">Update Payment Method</a>
    </p>
    <p style="font-size:13px; color:#64748b;">If you believe this is an error, please contact your bank or reply to this email for assistance.</p>
  `);
  await send(to, "TradeWorkDesk — Action required: payment failed", html, { emailType: "payment_failed" });
}

export async function sendServiceDueReminderEmail(
  to: string,
  customerName: string,
  companyName: string,
  applianceDescription: string,
  dueDateStr: string,
  bookingUrl: string,
  companyDetails?: EmailCompanyDetails,
  options?: { tenantId?: string },
): Promise<void> {
  const dueDate = new Date(dueDateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const companyDisplay = companyDetails?.name || companyDetails?.trading_name || companyName;

  const html = baseHtml(
    `Service Due Reminder — ${applianceDescription}`,
    `
    <h2>Your service is due soon</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>This is a friendly reminder that the service for your <strong>${escHtml(applianceDescription)}</strong> is due on <strong>${dueDate}</strong>.</p>
    <div class="info-box">
      <p><strong>Appliance:</strong> ${escHtml(applianceDescription)}</p>
      <p><strong>Service due:</strong> ${dueDate}</p>
    </div>
    <p>Regular servicing keeps your appliance running safely and efficiently. To book your service, please get in touch.</p>
    ${bookingUrl ? `<p style="margin-top:24px;"><a href="${escHtml(bookingUrl)}" class="btn">Book Your Service</a></p>` : ""}
    <hr class="divider"/>
    <p style="font-size:13px; color:#64748b;">This reminder has been sent by <strong>${escHtml(companyDisplay)}</strong>. If you have already booked, please ignore this email.</p>
    ${renderDocumentLinks(companyDetails)}
  `,
    companyDetails,
  );

  if (!resend) {
    const subject = `${escHtml(companyDisplay)} — Service Due Reminder for ${escHtml(applianceDescription)}`;
    await writeTenantEmailAudit({
      tenantId: options?.tenantId,
      status: "failed",
      emailType: "service_due_reminder",
      to,
      subject,
      from: buildTenantFrom(companyDetails),
      replyTo: companyDetails?.email ?? undefined,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
      metadata: { applianceDescription, dueDateStr },
    });
    throw new Error(getTenantEmailFailureMessage());
  }
  const subject = `${escHtml(companyDisplay)} — Service Due Reminder for ${escHtml(applianceDescription)}`;
  const replyTo = companyDetails?.email ?? undefined;
  const from = buildTenantFrom(companyDetails);
  const cc = normalizeAdditionalRecipients(companyDetails?.notification_emails, to, replyTo);
  try {
    const sendResult = await sendResendEmailWithRetry({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(cc.length > 0 ? { cc } : {}),
    } as any);
    await writeTenantEmailAudit({
      tenantId: options?.tenantId,
      status: "accepted",
      emailType: "service_due_reminder",
      to,
      subject,
      from,
      replyTo,
      providerMessageId: sendResult.messageId,
      retryCount: Math.max(0, sendResult.attempts - 1),
      metadata: { applianceDescription, dueDateStr },
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send service reminder to ${to}:`, reason);
    await notifyEmailDeliveryFailure({
      to,
      subject,
      reason,
      from,
      replyTo,
    });
    await writeTenantEmailAudit({
      tenantId: options?.tenantId,
      status: "failed",
      emailType: "service_due_reminder",
      to,
      subject,
      from,
      replyTo,
      errorMessage: reason,
      metadata: { applianceDescription, dueDateStr },
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}

export async function sendSimpleNotification(
  to: string,
  subject: string,
  bodyText: string,
): Promise<void> {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedTo = String(to || "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedTo)) {
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "simple_notification",
      to: normalizedTo || String(to || ""),
      subject,
      from: FROM,
      errorMessage: "invalid recipient email format",
      failureCategory: "recipient",
    });
    throw new Error(getTenantEmailFailureMessage("invalid recipient email format"));
  }
  if (!resend) {
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "simple_notification",
      to: normalizedTo,
      subject,
      from: FROM,
      errorMessage: "Email service is not configured (RESEND_API_KEY missing)",
      failureCategory: "platform",
    });
    throw new Error(getTenantEmailFailureMessage());
  }
  const normalized = bodyText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2");
  const escaped = escHtml(normalized);
  const linked = escaped.replace(/\bhttps?:\/\/[^\s<]+/g, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;word-break:break-all;">${url}</a>`;
  });
  const html = `<div style="font-family:sans-serif;font-size:14px;color:#1e293b;max-width:600px;margin:0 auto;padding:24px">
    <p style="margin:0 0 16px;">${linked.replace(/\n/g, "<br>")}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="font-size:12px;color:#94a3b8;">Sent from TradeWorkDesk</p>
  </div>`;
  try {
    const sendResult = await sendResendEmailWithRetry({ from: FROM, to: normalizedTo, subject, html } as any);
    await writeTenantEmailAudit({
      status: "accepted",
      emailType: "simple_notification",
      to: normalizedTo,
      subject,
      from: FROM,
      providerMessageId: sendResult.messageId,
      retryCount: Math.max(0, sendResult.attempts - 1),
    });
  } catch (sendErr) {
    const reason = sanitizeErrorForEmail(sendErr);
    console.error(`[email] Failed to send "${subject}" to ${normalizedTo}:`, reason);
    await notifyEmailDeliveryFailure({
      to: normalizedTo,
      subject,
      reason,
      from: FROM,
    });
    await writeTenantEmailAudit({
      status: "failed",
      emailType: "simple_notification",
      to: normalizedTo,
      subject,
      from: FROM,
      errorMessage: reason,
    });
    throw new Error(getTenantEmailFailureMessage(reason));
  }
}
