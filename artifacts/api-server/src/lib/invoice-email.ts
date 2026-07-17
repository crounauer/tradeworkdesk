/**
 * invoice-email.ts
 * Send invoice / quote PDFs to customers via email, following the same
 * pattern used by sendJobFormsEmail() in email.ts.
 */
import { Resend } from "resend";
import type { EmailCompanyDetails } from "./email";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const DEFAULT_FROM_NAME = "TradeWorkDesk";
const FROM_EMAIL = "noreply@tradeworkdesk.co.uk";

function escHtml(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(currency: string, amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function normalizeAdditionalRecipients(
  extra: string[] | null | undefined,
  to: string,
  replyTo?: string,
): string[] {
  const blacklist = new Set([to.toLowerCase(), (replyTo || "").toLowerCase()]);
  return Array.from(
    new Set(
      (extra || [])
        .map((email) => String(email).trim().toLowerCase())
        .filter((email) => email && !blacklist.has(email)),
    ),
  );
}

export async function sendInvoiceDocumentEmail(opts: {
  to: string;
  type: "invoice" | "quote";
  invoiceNumber: string;
  customerName: string;
  total: number;
  currency: string;
  dueDate?: string | null;
  paymentTermsDays?: number | null;
  expiryDate?: string | null;
  worksOrder?: string | null;
  customerNotes?: string | null;
  additionalText?: string | null;
  bankDetails?: string | null;
  pdfBuffer: Buffer;
  company?: EmailCompanyDetails;
  portalUrl?: string | null;
  hasPaymentProvider?: boolean;
}): Promise<void> {
  if (!resend) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing)");
  }

  const { type, invoiceNumber, customerName, total, currency } = opts;
  const isQuote = type === "quote";
  const label = isQuote ? "Quotation" : "Invoice";
  const companyName = opts.company?.name || opts.company?.trading_name || "Your Service Provider";
  const fromName = opts.company?.name || opts.company?.trading_name || DEFAULT_FROM_NAME;
  const FROM = `${fromName} <${FROM_EMAIL}>`;
  const formattedTotal = formatCurrency(currency, total);

  let dateInfo = "";
  if (!isQuote) {
    if (opts.dueDate) {
      const d = new Date(opts.dueDate);
      if (!isNaN(d.getTime())) {
        dateInfo = `<p><strong>Payment due:</strong> ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>`;
      }
    } else if (opts.paymentTermsDays != null && opts.paymentTermsDays > 0) {
      dateInfo = `<p><strong>Payment terms:</strong> Net ${opts.paymentTermsDays} days</p>`;
    } else {
      dateInfo = `<p><strong>Payment terms:</strong> Due on Receipt</p>`;
    }
  } else if (opts.expiryDate) {
    const d = new Date(opts.expiryDate);
    if (!isNaN(d.getTime())) {
      dateInfo = `<p><strong>Valid until:</strong> ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>`;
    }
  }

  const customerNotesHtml = opts.customerNotes
    ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#334155;">${escHtml(opts.customerNotes).replace(/\n/g, "<br/>")}</p>
       </div>`
    : "";

  const additionalTextHtml = opts.additionalText
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9a3412;">Additional Terms</p>
        <p style="margin:0;font-size:14px;color:#7c2d12;">${escHtml(opts.additionalText).replace(/\n/g, "<br/>")}</p>
       </div>`
    : "";

  const worksOrderHtml = opts.worksOrder
    ? `<div style="background:#f0fdf4;border-left:4px solid #4b9464;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#4b9464;">Works Order</p>
        <p style="margin:0;font-size:14px;color:#1e293b;">${escHtml(opts.worksOrder).replace(/\n/g, "<br/>")}</p>
       </div>`
    : "";

  const bankDetailsHtml = opts.bankDetails
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;">${isQuote ? "Deposit Payment Details" : "Payment Details"}</p>
        <p style="margin:0;font-size:13px;color:#166534;white-space:pre-line;">${escHtml(opts.bankDetails)}</p>
       </div>`
    : "";

  const footerLinksHtml = (() => {
    const links: string[] = [];
    if (opts.company?.rates_url) {
      links.push(`<a href="${escHtml(opts.company.rates_url)}" style="color:#1d4ed8;text-decoration:none;" target="_blank">Pricing &amp; Rates</a>`);
    }
    if (opts.company?.trading_terms_url) {
      links.push(`<a href="${escHtml(opts.company.trading_terms_url)}" style="color:#1d4ed8;text-decoration:none;" target="_blank">Trading Terms</a>`);
    }
    return links.length ? `<p style="margin:0 0 8px;">${links.join('<span style="margin:0 8px;color:#cbd5e1;">|</span>')}</p>` : "";
  })();

  const subject = `${label} ${invoiceNumber} from ${companyName} — ${formattedTotal}`;

  const logoHtml = opts.company?.logo_url
    ? `<div style="background:#fff;display:inline-block;padding:8px 14px;border-radius:6px;margin-bottom:12px;">
        <img src="${escHtml(opts.company.logo_url)}" alt="${escHtml(companyName)}" style="max-height:48px;max-width:160px;display:block;" />
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .header { background: #1d4ed8; padding: 24px 32px; color: #fff; }
    .body { padding: 32px; color: #1e293b; line-height: 1.6; }
    .footer { padding: 20px 32px; background: #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      ${logoHtml}
      <div style="font-size:22px;font-weight:800;letter-spacing:-.4px;">${escHtml(companyName)}</div>
    </div>
    <div class="body">
      <h2 style="margin-top:0;">${escHtml(label)} ${escHtml(invoiceNumber)}</h2>
      <p>Dear ${escHtml(customerName)},</p>
      <p>Please find your ${isQuote ? "quotation" : "invoice"} attached. ${isQuote ? "We hope this quote meets your requirements." : opts.hasPaymentProvider ? "You can pay online or by bank transfer — whichever is easiest for you." : "Please review the attached invoice and use the bank transfer details below to make payment."}</p>
      <div class="info-box">
        <p style="margin:0 0 4px;"><strong>${label} number:</strong> ${escHtml(invoiceNumber)}</p>
        <p style="margin:0 0 4px;"><strong>Amount:</strong> ${escHtml(formattedTotal)}</p>
        ${dateInfo}
      </div>
      ${worksOrderHtml}
      ${additionalTextHtml}
      ${customerNotesHtml}
      ${!isQuote && opts.portalUrl ? opts.hasPaymentProvider ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1e40af;">Pay Online (quickest)</p>
        <p style="margin:0 0 16px;font-size:13px;color:#334155;">Log in to your customer portal to pay by card or bank transfer.</p>
        <a href="${escHtml(opts.portalUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:7px;">Pay Online Now</a>
      </div>` : `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#334155;">View Invoice Online</p>
        <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Log in to your customer portal to view your invoice and service history.</p>
        <a href="${escHtml(opts.portalUrl)}" style="display:inline-block;background:#475569;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:7px;">View Invoice</a>
      </div>` : ""}
      ${bankDetailsHtml ? `<p style="margin:16px 0 8px;font-size:14px;color:#475569;"><strong>${isQuote ? "Pay your deposit" : (opts.hasPaymentProvider ? "Or pay" : "Pay")} by bank transfer</strong> using the details below:</p>${bankDetailsHtml}` : ""}
      <p>If you have any questions, please don't hesitate to get in touch.</p>
      <hr class="divider"/>
      <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
    </div>
    <div class="footer">
      ${footerLinksHtml}
      <a href="https://www.tradeworkdesk.co.uk" style="color:#1d4ed8;font-weight:600;font-size:13px;text-decoration:none;" target="_blank">Powered by TradeWorkDesk</a>
    </div>
  </div>
</body>
</html>`;

  const filename = `${label.toLowerCase()}-${invoiceNumber}.pdf`;
  const replyTo = opts.company?.email ?? undefined;
  const cc = normalizeAdditionalRecipients(opts.company?.notification_emails, opts.to, replyTo);

  const sendOpts: Parameters<typeof resend.emails.send>[0] = {
    from: FROM,
    to: [opts.to],
    ...(cc.length > 0 ? { cc } : {}),
    subject,
    html,
    attachments: [{ filename, content: opts.pdfBuffer }],
  };
  if (replyTo) (sendOpts as any).replyTo = replyTo;

  const { error } = await resend.emails.send(sendOpts);
  if (error) {
    throw new Error(`Failed to send ${label.toLowerCase()} email: ${error.message ?? JSON.stringify(error)}`);
  }
}

export async function sendPaymentReceiptEmail(opts: {
  to: string;
  invoiceNumber: string;
  customerName: string;
  paidAmount: number;
  currency: string;
  paymentMethod?: string | null;
  pdfBuffer: Buffer;
  company?: EmailCompanyDetails;
}): Promise<void> {
  if (!resend) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing)");
  }

  const companyName = opts.company?.name || opts.company?.trading_name || "Your Service Provider";
  const fromName = opts.company?.name || opts.company?.trading_name || DEFAULT_FROM_NAME;
  const FROM = `${fromName} <${FROM_EMAIL}>`;
  const formattedAmount = formatCurrency(opts.currency, opts.paidAmount);
  const subject = `Payment received — Invoice ${opts.invoiceNumber} (${formattedAmount})`;

  const methodLabel = (() => {
    switch ((opts.paymentMethod || "").toLowerCase()) {
      case "paypal": return "PayPal";
      case "bank_transfer": return "Open Banking";
      case "card": return "card";
      case "gocardless": return "GoCardless";
      default: return opts.paymentMethod || "online";
    }
  })();

  const logoHtml = opts.company?.logo_url
    ? `<div style="background:#fff;display:inline-block;padding:8px 14px;border-radius:6px;margin-bottom:12px;">
        <img src="${escHtml(opts.company.logo_url)}" alt="${escHtml(companyName)}" style="max-height:48px;max-width:160px;display:block;" />
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .header { background: #166534; padding: 24px 32px; color: #fff; }
    .body { padding: 32px; color: #1e293b; line-height: 1.6; }
    .footer { padding: 20px 32px; background: #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      ${logoHtml}
      <div style="font-size:22px;font-weight:800;letter-spacing:-.4px;">${escHtml(companyName)}</div>
    </div>
    <div class="body">
      <h2 style="margin-top:0;color:#166534;">&#10003; Payment Received</h2>
      <p>Dear ${escHtml(opts.customerName)},</p>
      <p>Thank you — we've received your payment. A copy of your invoice is attached for your records.</p>
      <div class="info-box">
        <p style="margin:0 0 4px;"><strong>Invoice number:</strong> ${escHtml(opts.invoiceNumber)}</p>
        <p style="margin:0 0 4px;"><strong>Amount paid:</strong> ${escHtml(formattedAmount)}</p>
        <p style="margin:0;"><strong>Payment method:</strong> ${escHtml(methodLabel)}</p>
      </div>
      <p>If you have any questions about this payment, please don't hesitate to get in touch.</p>
      <hr class="divider"/>
      <p style="font-size:13px;color:#64748b;">Kind regards,<br/><strong>${escHtml(companyName)}</strong><br/><em>Sent via TradeWorkDesk</em></p>
    </div>
    <div class="footer">
      <a href="https://www.tradeworkdesk.co.uk" style="color:#1d4ed8;font-weight:600;font-size:13px;text-decoration:none;" target="_blank">Powered by TradeWorkDesk</a>
    </div>
  </div>
</body>
</html>`;

  const sendOpts: Parameters<typeof resend.emails.send>[0] = {
    from: FROM,
    to: [opts.to],
    ...(normalizeAdditionalRecipients(opts.company?.notification_emails, opts.to, opts.company?.email ?? undefined).length > 0
      ? { cc: normalizeAdditionalRecipients(opts.company?.notification_emails, opts.to, opts.company?.email ?? undefined) }
      : {}),
    subject,
    html,
    attachments: [{ filename: `invoice-${opts.invoiceNumber}.pdf`, content: opts.pdfBuffer }],
  };
  if (opts.company?.email) (sendOpts as any).replyTo = opts.company.email;

  const { error } = await resend.emails.send(sendOpts);
  if (error) {
    throw new Error(`Failed to send receipt email: ${error.message ?? JSON.stringify(error)}`);
  }
}
