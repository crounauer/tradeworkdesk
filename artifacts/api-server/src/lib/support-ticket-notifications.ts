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