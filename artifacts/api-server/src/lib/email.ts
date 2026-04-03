import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn("RESEND_API_KEY is not set — email features will be unavailable");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM = "TradeWorkDesk <noreply@tradeworkdesk.co.uk>";

export interface EmailCompanyDetails {
  name?: string | null;
  trading_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  gas_safe_number?: string | null;
  oftec_number?: string | null;
  vat_number?: string | null;
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
  const addressParts = [company.address_line1, company.address_line2, company.city, company.county, company.postcode].filter(Boolean);
  const addressLine = addressParts.join(", ");

  const detailItems: string[] = [];
  if (company.phone) detailItems.push(`<span style="white-space:nowrap;">📞 ${company.phone}</span>`);
  if (company.email) detailItems.push(`<span style="white-space:nowrap;">✉️ ${company.email}</span>`);
  if (company.website) detailItems.push(`<span style="white-space:nowrap;">🌐 ${company.website}</span>`);

  const regItems: string[] = [];
  if (company.gas_safe_number) regItems.push(`Gas Safe: ${company.gas_safe_number}`);
  if (company.oftec_number) regItems.push(`OFTEC: ${company.oftec_number}`);
  if (company.vat_number) regItems.push(`VAT: ${company.vat_number}`);

  return `
    <div class="header" style="background:#1d4ed8;padding:28px 32px 20px;color:#fff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size:24px;font-weight:800;letter-spacing:-.5px;margin:0 0 4px;">${companyName}</div>
            ${addressLine ? `<div style="font-size:13px;opacity:.85;margin:2px 0;">${addressLine}</div>` : ""}
            ${detailItems.length > 0 ? `<div style="font-size:13px;opacity:.85;margin:6px 0 0;">${detailItems.join(" &nbsp;&bull;&nbsp; ")}</div>` : ""}
            ${regItems.length > 0 ? `<div style="font-size:12px;opacity:.7;margin:8px 0 0;border-top:1px solid rgba(255,255,255,.2);padding-top:8px;">${regItems.join(" &nbsp;|&nbsp; ")}</div>` : ""}
          </td>
        </tr>
      </table>
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

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.warn(`[email] Resend not configured — would have sent "${subject}" to ${to}`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
  }
}

export async function sendConfirmationEmail(to: string, contactName: string, companyName: string, confirmUrl: string): Promise<void> {
  const html = baseHtml("Confirm your TradeWorkDesk account", `
    <h2>Welcome to TradeWorkDesk, ${contactName}!</h2>
    <p>Your company account for <strong>${companyName}</strong> has been created. Please confirm your email address to activate your account and start your free trial.</p>
    <p style="margin-top:24px;">
      <a href="${confirmUrl}" class="btn">Confirm Email Address</a>
    </p>
    <hr class="divider"/>
    <p style="font-size:13px; color:#64748b;">This link expires in 24 hours. If you didn't create a TradeWorkDesk account, you can safely ignore this email.</p>
  `);
  await send(to, "TradeWorkDesk — Please confirm your email address", html);
}

export async function sendWelcomeEmail(to: string, companyName: string, trialEndsAt: string): Promise<void> {
  const trialDate = new Date(trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const html = baseHtml("Welcome to TradeWorkDesk", `
    <h2>Welcome to TradeWorkDesk, ${companyName}!</h2>
    <p>Your account is set up and ready to go. You're on a free trial until <strong>${trialDate}</strong>.</p>
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
  await send(to, "Welcome to TradeWorkDesk — your trial has started", html);
}

export async function sendInvoiceEmail(to: string, companyName: string, amount: number, currency: string, periodEnd: string, invoiceUrl: string): Promise<void> {
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
  await send(to, `TradeWorkDesk — Payment received (${formatted})`, html);
}

export async function sendTrialExpiryReminder(to: string, companyName: string, daysLeft: number, billingUrl: string): Promise<void> {
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
  await send(to, `TradeWorkDesk — Your trial expires ${urgency}`, html);
}

export async function sendRenewalReminder(to: string, companyName: string, renewalDate: string, amount: number, currency: string, billingUrl: string): Promise<void> {
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
  await send(to, `TradeWorkDesk — Subscription renews on ${date}`, html);
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
): Promise<void> {
  const formListHtml = formLabels
    .map(label => `<li style="margin:4px 0;font-size:14px;">${escHtml(label)}</li>`)
    .join("\n");

  const contactLine = companyDetails?.phone
    ? `please contact us on <strong>${escHtml(companyDetails.phone)}</strong>${companyDetails.email ? ` or email <a href="mailto:${escHtml(companyDetails.email)}" style="color:#1d4ed8;">${escHtml(companyDetails.email)}</a>` : ""}.`
    : "please contact your service provider directly.";

  const html = baseHtml(escHtml(subject), `
    <h2>Job Forms &mdash; ${escHtml(jobRef)}</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>Please find attached the completed service form(s) for your recent job carried out by <strong>${escHtml(companyName)}</strong>.</p>
    <div class="info-box">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Attached Forms:</p>
      <ul style="margin:0;padding-left:20px;">
        ${formListHtml}
      </ul>
    </div>
    <p>These documents contain the full details of the work completed at your property. Please retain them for your records.</p>
    <p>If you have any questions about the work carried out, ${contactLine}</p>
    <hr class="divider"/>
    <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
  `, companyDetails);
  if (!resend) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing)");
  }
  const recipients: string[] = [to];
  const sendOptions: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    cc?: string[];
    attachments?: Array<{ filename: string; content: Buffer }>;
  } = { from: FROM, to: recipients, subject, html };
  if (cc) sendOptions.cc = [cc];
  if (attachments.length > 0) sendOptions.attachments = attachments;
  const { error } = await resend.emails.send(sendOptions);
  if (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export interface JobConfirmationDetails {
  jobRef: string;
  jobType: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  propertyAddress: string;
  technicianName?: string | null;
  description?: string | null;
}

export async function sendJobConfirmationEmail(
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

  const contactLine = companyDetails?.phone
    ? `please contact us on <strong>${escHtml(companyDetails.phone)}</strong>${companyDetails.email ? ` or email <a href="mailto:${escHtml(companyDetails.email)}" style="color:#1d4ed8;">${escHtml(companyDetails.email)}</a>` : ""}.`
    : "please contact your service provider directly.";

  const subject = `Appointment Confirmation — ${escHtml(jobDetails.jobRef)}`;

  const html = baseHtml(subject, `
    <h2>Appointment Confirmation</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>We're writing to confirm your upcoming appointment with <strong>${escHtml(companyName)}</strong>.</p>
    <div class="info-box">
      <p><strong>Job Reference:</strong> ${escHtml(jobDetails.jobRef)}</p>
      <p><strong>Type of Work:</strong> ${escHtml(jobDetails.jobType)}</p>
      <p><strong>Date:</strong> ${escHtml(dateStr)}${escHtml(timeStr)}</p>
      <p><strong>Property:</strong> ${escHtml(jobDetails.propertyAddress)}</p>
      ${jobDetails.technicianName ? `<p><strong>Engineer:</strong> ${escHtml(jobDetails.technicianName)}</p>` : ""}
    </div>
    ${jobDetails.description ? `<p><strong>Notes:</strong> ${escHtml(jobDetails.description)}</p>` : ""}
    <p>Please ensure there is access to the property at the scheduled time. If you need to reschedule or have any questions, ${contactLine}</p>
    <hr class="divider"/>
    <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
  `, companyDetails);

  if (!resend) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing)");
  }

  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
    throw new Error(`Email send failed: ${error.message}`);
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
  await send(to, "TradeWorkDesk — Action required: payment failed", html);
}
