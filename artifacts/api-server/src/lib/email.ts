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
  logo_url?: string | null;
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
  rates_url?: string | null;
  trading_terms_url?: string | null;
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
  photosAttached?: number,
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

  const html = baseHtml(escHtml(subject), `
    <h2>${heading}</h2>
    <p>Dear ${escHtml(customerName)},</p>
    <p>${introText}</p>
    ${formsSection}
    ${photosSection}
    <p>These documents contain the full details of the work completed at your property. Please retain them for your records.</p>
    <p>If you have any questions about the work carried out, ${contactLine}</p>
    ${renderDocumentLinks(companyDetails)}
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

export function renderJobConfirmationHtml(
  customerName: string,
  companyName: string,
  jobDetails: JobConfirmationDetails,
  companyDetails?: EmailCompanyDetails,
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

  return baseHtml(subject, `
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
): Promise<void> {
  const html = renderJobConfirmationHtml(customerName, companyName, jobDetails, companyDetails);

  if (!resend) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing)");
  }

  const subject = `Appointment Confirmation — ${escHtml(jobDetails.jobRef)}`;
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
    throw new Error(`Email send failed: ${error.message}`);
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
    <p>They are now on a 14-day free trial. You can view their account in the platform admin panel.</p>
    <p style="margin-top:24px;">
      <a href="https://www.tradeworkdesk.co.uk/platform" class="btn">Open Platform Admin</a>
    </p>
  `);
  await send(to, `TradeWorkDesk — New registration: ${newCompanyName}`, html);
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
