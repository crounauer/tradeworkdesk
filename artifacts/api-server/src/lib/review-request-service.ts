import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";
import { hasActiveAddon, deductAddonCredit, getAddonCredits } from "./tenant-limits";

const APP_URL = process.env.APP_URL || "https://tradeworkdesk.co.uk";
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

type ReviewRequestRow = {
  id: string;
  tenant_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  trigger_type: "job_completed" | "invoice_paid" | "manual";
  job_id: string | null;
  invoice_id: string | null;
  status: "pending" | "sent" | "opened" | "clicked" | "failed" | "suppressed";
  scheduled_for: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  channel: "email" | "sms";
  tracking_token: string;
  error_message: string | null;
};

type ReviewSettingsRow = {
  is_enabled?: boolean;
  trigger_on?: "job_completed" | "invoice_paid" | "manual";
  delay_hours?: number;
  google_review_url?: string | null;
  trustpilot_url?: string | null;
  checkatrade_url?: string | null;
  which_trusted_url?: string | null;
  custom_review_url?: string | null;
  custom_review_label?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  sms_enabled?: boolean;
  sms_body?: string | null;
  max_per_customer_days?: number;
};

type TriggerReviewRequestInput = {
  tenantId: string;
  event: string;
  entityId: string;
  entityType: string;
  metadata?: Record<string, unknown>;
};

type TriggerReviewRequestResult = Array<{ action: string; review_request_id?: string }>;

export class ReviewRequestError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function firstReviewUrl(settings: ReviewSettingsRow | null): string | null {
  return settings?.google_review_url
    || settings?.trustpilot_url
    || settings?.checkatrade_url
    || settings?.which_trusted_url
    || settings?.custom_review_url
    || null;
}

function template(text: string | null | undefined, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    text || "",
  );
}

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

async function getSmsWorksCredentials(): Promise<{ key: string; secret: string } | null> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["sms_works_api_key", "sms_works_secret"]);

  if (!data || data.length < 2) return null;

  const map: Record<string, string> = {};
  for (const row of data as { key: string; value: string }[]) {
    map[row.key] = row.value;
  }

  if (!map["sms_works_api_key"] || !map["sms_works_secret"]) return null;
  return { key: map["sms_works_api_key"], secret: map["sms_works_secret"] };
}

async function getSmsWorksJwt(key: string, secret: string): Promise<string> {
  const res = await fetch("https://api.thesmsworks.co.uk/v1/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SMS Works auth failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { token: string };
  if (!data.token) throw new Error("SMS Works returned no token");
  return data.token;
}

async function sendSmsReviewRequest(rr: ReviewRequestRow, settings: ReviewSettingsRow, companyName: string): Promise<void> {
  if (!rr.customer_phone) {
    throw new ReviewRequestError("Customer phone number is required for SMS review requests", 400);
  }

  const tenantHasAddon = await hasActiveAddon(rr.tenant_id, "sms_messaging");
  if (!tenantHasAddon) {
    throw new ReviewRequestError("SMS Messaging add-on required for SMS review requests", 402);
  }

  const creditInfo = await getAddonCredits(rr.tenant_id, "sms_messaging");
  if (creditInfo !== null && creditInfo.credits_remaining <= 0) {
    throw new ReviewRequestError("No SMS credits remaining for review requests", 402);
  }

  const creds = await getSmsWorksCredentials();
  if (!creds) {
    throw new ReviewRequestError("SMS Works is not configured", 503);
  }

  const senderName = companyName.replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "TradeWork";
  const reviewLink = `${APP_URL}/api/public/review/${rr.tracking_token}/click`;
  const body = template(
    settings.sms_body || "Hi {{customer_name}}, we'd love your feedback. Leave a review here: {{review_link}} - {{company_name}}",
    {
      customer_name: rr.customer_name,
      company_name: companyName,
      review_link: reviewLink,
    },
  );

  const token = await getSmsWorksJwt(creds.key, creds.secret);
  const smsRes = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
    },
    body: JSON.stringify({
      sender: senderName,
      destination: rr.customer_phone.replace(/\s/g, ""),
      content: body.trim(),
    }),
  });

  if (!smsRes.ok) {
    const message = await smsRes.text();
    throw new ReviewRequestError(message || `SMS send failed (${smsRes.status})`, 502);
  }

  await deductAddonCredit(rr.tenant_id, "sms_messaging");
}

async function sendEmailReviewRequest(rr: ReviewRequestRow, settings: ReviewSettingsRow, companyName: string): Promise<void> {
  if (!rr.customer_email) {
    throw new ReviewRequestError("Customer email is required for email review requests", 400);
  }
  if (!resend) {
    throw new ReviewRequestError("Email service is not configured (RESEND_API_KEY missing)", 503);
  }

  const reviewLink = `${APP_URL}/api/public/review/${rr.tracking_token}/click`;
  const openPixel = `${APP_URL}/api/public/review/${rr.tracking_token}`;
  const subject = template(settings.email_subject || "How did we do? Leave us a review", {
    customer_name: rr.customer_name,
    company_name: companyName,
    review_link: reviewLink,
  });
  const body = template(
    settings.email_body || "Hi {{customer_name}},\n\nWe'd love your feedback. Please leave us a review here:\n{{review_link}}\n\nThanks,\n{{company_name}}",
    {
      customer_name: rr.customer_name,
      company_name: companyName,
      review_link: reviewLink,
    },
  );

  const html = `<div style="font-family:sans-serif;font-size:14px;color:#1e293b;max-width:600px;margin:0 auto;padding:24px">
    <p style="margin:0 0 16px">${textToHtml(body)}</p>
    <p style="margin:24px 0">
      <a href="${reviewLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Leave a Review</a>
    </p>
    <img src="${openPixel}" alt="" width="1" height="1" style="display:block;border:0;opacity:0" />
  </div>`;

  const { error } = await resend.emails.send({
    from: "TradeWorkDesk <noreply@tradeworkdesk.co.uk>",
    to: rr.customer_email,
    subject,
    html,
  } as Parameters<typeof resend.emails.send>[0]);

  if (error) {
    throw new ReviewRequestError(`Email send failed: ${error.message}`, 502);
  }
}

export async function sendReviewRequestNow(reviewRequestId: string, tenantId: string): Promise<ReviewRequestRow> {
  const { data: rr, error: rrError } = await supabaseAdmin
    .from("review_requests")
    .select("*")
    .eq("id", reviewRequestId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (rrError) throw new ReviewRequestError(rrError.message, 500);
  if (!rr) throw new ReviewRequestError("Review request not found", 404);
  if (rr.status === "sent" || rr.status === "opened" || rr.status === "clicked") {
    throw new ReviewRequestError("Review request has already been sent", 409);
  }

  const [{ data: settings, error: settingsError }, { data: companySettings }, { data: tenant }] = await Promise.all([
    supabaseAdmin.from("review_request_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    supabaseAdmin.from("company_settings").select("name, trading_name").eq("tenant_id", tenantId).eq("singleton_id", "default").maybeSingle(),
    supabaseAdmin.from("tenants").select("company_name").eq("id", tenantId).maybeSingle(),
  ]);

  if (settingsError) throw new ReviewRequestError(settingsError.message, 500);
  if (!firstReviewUrl(settings as ReviewSettingsRow | null)) {
    throw new ReviewRequestError("Set at least one review platform URL before sending review requests", 400);
  }

  const companyName = companySettings?.trading_name || companySettings?.name || tenant?.company_name || "Your Service Provider";

  try {
    if (rr.channel === "sms") {
      await sendSmsReviewRequest(rr as ReviewRequestRow, (settings || {}) as ReviewSettingsRow, companyName);
    } else {
      await sendEmailReviewRequest(rr as ReviewRequestRow, (settings || {}) as ReviewSettingsRow, companyName);
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("review_requests")
      .update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
      .eq("id", reviewRequestId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (updateErr) throw new ReviewRequestError(updateErr.message, 500);
    return updated as ReviewRequestRow;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send review request";
    await supabaseAdmin
      .from("review_requests")
      .update({ status: "failed", error_message: message })
      .eq("id", reviewRequestId)
      .eq("tenant_id", tenantId);
    if (err instanceof ReviewRequestError) throw err;
    throw new ReviewRequestError(message, 500);
  }
}

export async function triggerReviewRequestAutomation(input: TriggerReviewRequestInput): Promise<TriggerReviewRequestResult> {
  const { tenantId, event, entityId, entityType, metadata } = input;
  const logs: TriggerReviewRequestResult = [];

  if (event === "job.completed" || event === "invoice.paid") {
    const { data: settings } = await supabaseAdmin
      .from("review_request_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (settings?.is_enabled) {
      const triggerOn = settings.trigger_on;
      const matches =
        (triggerOn === "job_completed" && event === "job.completed") ||
        (triggerOn === "invoice_paid" && event === "invoice.paid");

      if (matches && metadata?.customer_email) {
        if (settings?.max_per_customer_days) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - settings.max_per_customer_days);
          const { data: recent } = await supabaseAdmin.from("review_requests")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("customer_email", String(metadata.customer_email))
            .in("status", ["sent", "opened", "clicked"])
            .gte("sent_at", cutoff.toISOString())
            .limit(1);
          if (recent?.length) {
            logs.push({ action: "review_request_suppressed_recent_duplicate" });
          } else {
            const scheduledFor = new Date();
            scheduledFor.setHours(scheduledFor.getHours() + (settings.delay_hours || 24));
            const { data: rr, error: rrErr } = await supabaseAdmin.from("review_requests").insert({
              tenant_id: tenantId,
              customer_name: String(metadata.customer_name || "Customer"),
              customer_email: String(metadata.customer_email),
              customer_phone: metadata.customer_phone ? String(metadata.customer_phone) : null,
              job_id: entityType === "job" ? entityId : null,
              invoice_id: entityType === "invoice" ? entityId : null,
              trigger_type: triggerOn,
              channel: settings.sms_enabled && metadata.customer_phone ? "sms" : "email",
              status: "pending",
              scheduled_for: scheduledFor.toISOString(),
            }).select().maybeSingle();
            if (!rrErr) logs.push({ action: "review_request_scheduled", review_request_id: rr?.id });
          }
        } else {
          const scheduledFor = new Date();
          scheduledFor.setHours(scheduledFor.getHours() + (settings.delay_hours || 24));
          const { data: rr, error: rrErr } = await supabaseAdmin.from("review_requests").insert({
            tenant_id: tenantId,
            customer_name: String(metadata.customer_name || "Customer"),
            customer_email: String(metadata.customer_email),
            customer_phone: metadata.customer_phone ? String(metadata.customer_phone) : null,
            job_id: entityType === "job" ? entityId : null,
            invoice_id: entityType === "invoice" ? entityId : null,
            trigger_type: triggerOn,
            channel: settings.sms_enabled && metadata.customer_phone ? "sms" : "email",
            status: "pending",
            scheduled_for: scheduledFor.toISOString(),
          }).select().maybeSingle();
          if (!rrErr) logs.push({ action: "review_request_scheduled", review_request_id: rr?.id });
        }
      }
    }
  }

  await supabaseAdmin.from("automation_logs").insert({
    tenant_id: tenantId,
    trigger_event: event,
    entity_type: entityType,
    entity_id: entityId,
    status: "success",
    action_type: "automation_trigger",
    message: `Processed ${event} for ${entityType} ${entityId}`,
  });

  return logs;
}