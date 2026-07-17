import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const SUPPORT_FROM = process.env.SUPPORT_FROM_EMAIL || "TradeWorkDesk Support <support@tradeworkdesk.co.uk>";

type TicketEmailPayload = {
  subject: string;
  text: string;
  html: string;
};

type TicketTenantContext = {
  companyName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notificationEmails?: string[] | null;
};

type TicketRequesterContext = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

function dedupe(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => (value || "").trim()).filter(Boolean))];
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

async function sendSms(destinations: string[], content: string): Promise<void> {
  if (destinations.length === 0) return;
  const creds = await getSmsWorksCredentials();
  if (!creds) return;
  const token = await getSmsWorksJwt(creds.key, creds.secret);

  await Promise.allSettled(destinations.map(async (destination) => {
    const smsRes = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        sender: "TradeWork",
        destination: destination.replace(/\s/g, ""),
        content,
      }),
    });

    if (!smsRes.ok) {
      const body = await smsRes.text();
      throw new Error(body || `SMS failed (${smsRes.status})`);
    }
  }));
}

async function sendEmail(recipients: string[], payload: TicketEmailPayload): Promise<void> {
  if (!resend || recipients.length === 0) return;
  const { error } = await resend.emails.send({
    from: SUPPORT_FROM,
    to: recipients,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
}

export async function notifySuperAdminsTicketRaised(opts: {
  ticketId: string;
  tenantId: string;
  companyName: string | null;
  subject: string;
  category: string;
  priority: string;
  requesterName: string | null;
  requesterEmail: string | null;
}): Promise<void> {
  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("email, phone")
    .eq("role", "super_admin")
    .eq("is_active", true);

  const emails = dedupe((admins || []).map((admin) => (admin as { email?: string | null }).email));
  const phones = dedupe((admins || []).map((admin) => (admin as { phone?: string | null }).phone));

  const title = `New support ticket from ${opts.companyName || "tenant"}`;
  const appUrl = process.env.APP_URL || "https://tradeworkdesk.co.uk";
  const ticketUrl = `${appUrl}/platform/support-tickets?ticketId=${encodeURIComponent(opts.ticketId)}`;
  const text = `${title}\nSubject: ${opts.subject}\nCategory: ${opts.category}\nPriority: ${opts.priority}\nRequester: ${opts.requesterName || "Unknown"} (${opts.requesterEmail || "no email"})\nOpen ticket: ${ticketUrl}`;
  const html = `<p>${title}</p><p><strong>Subject:</strong> ${opts.subject}</p><p><strong>Category:</strong> ${opts.category}</p><p><strong>Priority:</strong> ${opts.priority}</p><p><strong>Requester:</strong> ${opts.requesterName || "Unknown"} (${opts.requesterEmail || "no email"})</p><p><a href="${ticketUrl}" target="_blank" rel="noreferrer">Open support ticket</a></p>`;

  await Promise.allSettled([
    sendEmail(emails, { subject: title, text, html }),
    sendSms(phones, `${title}. ${opts.subject}`),
  ]);
}

export async function notifyTenantTicketUpdated(opts: {
  ticketId: string;
  ticketSubject: string;
  company: TicketTenantContext;
  requester: TicketRequesterContext;
  status: string;
  actorName: string | null;
  messageBody: string | null;
}): Promise<void> {
  const emails = dedupe([
    opts.requester.email,
    opts.company.contactEmail,
    ...(opts.company.notificationEmails || []),
  ]);
  const phones = dedupe([opts.requester.phone, opts.company.contactPhone]);

  const subject = `Support ticket updated: ${opts.ticketSubject}`;
  const statusLabel = opts.status.replace(/_/g, " ");
  const appUrl = process.env.APP_URL || "https://tradeworkdesk.co.uk";
  const ticketUrl = `${appUrl}/support?ticketId=${encodeURIComponent(opts.ticketId)}`;
  const text = `Your support ticket has been updated.\nSubject: ${opts.ticketSubject}\nStatus: ${statusLabel}\nUpdated by: ${opts.actorName || "TradeWorkDesk"}\nOpen ticket: ${ticketUrl}${opts.messageBody ? `\n\nMessage:\n${opts.messageBody}` : ""}`;
  const html = `<p>Your support ticket has been updated.</p><p><strong>Subject:</strong> ${opts.ticketSubject}<br/><strong>Status:</strong> ${statusLabel}<br/><strong>Updated by:</strong> ${opts.actorName || "TradeWorkDesk"}</p><p><a href="${ticketUrl}" target="_blank" rel="noreferrer">Open support ticket</a></p>${opts.messageBody ? `<p><strong>Message:</strong><br/>${opts.messageBody.replace(/\n/g, "<br/>")}</p>` : ""}`;

  await Promise.allSettled([
    sendEmail(emails, { subject, text, html }),
    sendSms(phones, `Support ticket updated: ${opts.ticketSubject} (${statusLabel}).`),
  ]);
}

export async function notifySuperAdminsPlatformIncident(opts: {
  overallStatus: "healthy" | "degraded" | "down";
  checkedAt: string;
  issues: Array<{ service: string; check: string; error: string; status_code?: number }>;
  notifyEmail?: boolean;
  notifySms?: boolean;
}): Promise<void> {
  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("email, phone")
    .eq("role", "super_admin")
    .eq("is_active", true);

  const emails = dedupe((admins || []).map((admin) => (admin as { email?: string | null }).email));
  const phones = dedupe((admins || []).map((admin) => (admin as { phone?: string | null }).phone));
  if (emails.length === 0 && phones.length === 0) return;

  const appUrl = process.env.APP_URL || "https://tradeworkdesk.co.uk";
  const dashboardUrl = `${appUrl}/platform/dashboard`;
  const headline =
    opts.overallStatus === "down"
      ? "Platform health alert: major outage detected"
      : "Platform health alert: degraded services detected";
  const topIssues = opts.issues.slice(0, 5);
  const issueText = topIssues
    .map((issue) => `- ${issue.service}/${issue.check}: ${issue.error}${issue.status_code ? ` (HTTP ${issue.status_code})` : ""}`)
    .join("\n");
  const issueHtml = topIssues
    .map((issue) => `<li><strong>${issue.service}/${issue.check}</strong>: ${issue.error}${issue.status_code ? ` (HTTP ${issue.status_code})` : ""}</li>`)
    .join("");

  const subject = opts.overallStatus === "down"
    ? "TradeWorkDesk Alert: Platform outage"
    : "TradeWorkDesk Alert: Platform degradation";

  const text = `${headline}\nStatus: ${opts.overallStatus}\nChecked: ${opts.checkedAt}\n\nIssues:\n${issueText || "- None listed"}\n\nOpen dashboard: ${dashboardUrl}`;
  const html = `<p>${headline}</p><p><strong>Status:</strong> ${opts.overallStatus}<br/><strong>Checked:</strong> ${opts.checkedAt}</p><p><strong>Issues:</strong></p><ul>${issueHtml || "<li>None listed</li>"}</ul><p><a href="${dashboardUrl}" target="_blank" rel="noreferrer">Open platform dashboard</a></p>`;

  const shouldEmail = opts.notifyEmail !== false;
  const shouldSms = opts.notifySms !== false;

  const tasks: Array<Promise<void>> = [];
  if (shouldEmail) tasks.push(sendEmail(emails, { subject, text, html }));
  if (shouldSms) tasks.push(sendSms(phones, `Platform ${opts.overallStatus}: ${opts.issues.length} issue(s). Check dashboard.`));
  if (tasks.length === 0) return;

  await Promise.allSettled(tasks);
}