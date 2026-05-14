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
  bankDetails?: string | null;
  pdfBuffer: Buffer;
  company?: EmailCompanyDetails;
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

  const worksOrderHtml = opts.worksOrder
    ? `<div style="background:#f0fdf4;border-left:4px solid #4b9464;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#4b9464;">Works Order</p>
        <p style="margin:0;font-size:14px;color:#1e293b;">${escHtml(opts.worksOrder).replace(/\n/g, "<br/>")}</p>
       </div>`
    : "";

  const bankDetailsHtml = (!isQuote && opts.bankDetails)
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;">Payment Details</p>
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
      <p>Please find your ${isQuote ? "quotation" : "invoice"} attached. ${isQuote ? "We hope this quote meets your requirements." : "Payment is due as shown on the attached document."}</p>
      <div class="info-box">
        <p style="margin:0 0 4px;"><strong>${label} number:</strong> ${escHtml(invoiceNumber)}</p>
        <p style="margin:0 0 4px;"><strong>Amount:</strong> ${escHtml(formattedTotal)}</p>
        ${dateInfo}
      </div>
      ${worksOrderHtml}
      ${customerNotesHtml}
      ${bankDetailsHtml}
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

  const sendOpts: Parameters<typeof resend.emails.send>[0] = {
    from: FROM,
    to: [opts.to],
    subject,
    html,
    attachments: [{ filename, content: opts.pdfBuffer }],
  };
  if (replyTo) (sendOpts as any).reply_to = replyTo;

  const { error } = await resend.emails.send(sendOpts);
  if (error) {
    throw new Error(`Failed to send ${label.toLowerCase()} email: ${error.message ?? JSON.stringify(error)}`);
  }
}
