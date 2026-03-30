import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn("RESEND_API_KEY is not set — email features will be unavailable");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM = "TradeWorkDesk <noreply@tradeworkdesk.co.uk>";

function baseHtml(title: string, body: string): string {
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
    <div class="header">
      <div class="header-brand">
        <div class="header-logo">🔥</div>
        <div>
          <h1>TradeWorkDesk</h1>
          <p>Professional Boiler Service Management</p>
        </div>
      </div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} TradeWorkDesk Ltd. All rights reserved.<br/>
      You received this email because you have an active account with TradeWorkDesk.<br/>
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
