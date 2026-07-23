import jsPDFModule from "jspdf";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;

export interface InvoicePdfLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type?: string;
}

export interface InvoicePdfData {
  type: "invoice" | "quote";
  invoice_number: string;
  issue_date: string;
  due_date?: string | null;
  expiry_date?: string | null;
  payment_terms_days?: number | null;
  quote_validity_days?: number | null;
  currency: string;
  // Company
  company_name?: string | null;
  company_trading_name?: string | null;
  company_address_line1?: string | null;
  company_address_line2?: string | null;
  company_city?: string | null;
  company_county?: string | null;
  company_postcode?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_website?: string | null;
  company_vat_number?: string | null;
  company_gas_safe_number?: string | null;
  company_oftec_number?: string | null;
  company_logo_url?: string | null;
  company_footer_text?: string | null;
  company_bank_details?: string | null;
  company_additional_text?: string | null;
  company_rates_url?: string | null;
  company_trading_terms_url?: string | null;
  // Customer
  customer_name: string;
  customer_address_line1?: string | null;
  customer_address_line2?: string | null;
  customer_city?: string | null;
  customer_county?: string | null;
  customer_postcode?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  // Job
  job_reference?: string | null;
  job_description?: string | null;
  // Line items
  line_items: InvoicePdfLineItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  amount_paid?: number | null;
  balance_due?: number | null;
  // Notes
  works_order?: string | null;
  customer_notes?: string | null;
}

function fmt(currency: string, amount: number): string {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return symbol + amount.toFixed(2);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function diffDays(fromDate: string | null | undefined, toDate: string | null | undefined): number | null {
  if (!fromDate || !toDate) return null;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

/**
 * Generate a jsPDF invoice or quote PDF and return as a Buffer.
 * Layout matches the Zoho Invoice style: company info top-left with green
 * accent, large document title + number + balance top-right, coloured-label
 * meta table, numbered line-item rows with item-type sub-labels, job notes
 * below the table, and bank / payment notes on a second page when present.
 */
export function generateInvoicePdf(data: InvoicePdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin      = 14;
  const rightMargin = pageWidth - margin;

  // Colour palette
  const clrDark:   [number, number, number] = [30,  30,  30];
  const clrMid:    [number, number, number] = [110, 110, 110];
  const clrLight:  [number, number, number] = [210, 210, 210];
  const clrAccent: [number, number, number] = [70,  148, 100]; // green

  const displayName = data.company_trading_name || data.company_name || "";
  const docTitle    = data.type === "quote" ? "QUOTATION" : "INVOICE";
  const hasPaidToDate = data.type === "invoice" && Number(data.amount_paid ?? 0) > 0;

  let y = 14;

  // ── SECTION 1: Header — company info left, document title right ─────────────

  // Right column: large title, invoice number, balance due
  doc.setFontSize(30);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text(docTitle, rightMargin, y + 4, { align: "right" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...clrDark);
  doc.text(data.invoice_number, rightMargin, y + 13, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...clrMid);
  doc.text(data.type === "quote" ? "Quote Total" : "Outstanding Balance", rightMargin, y + 20, { align: "right" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...clrDark);
  const balanceDue = data.type === "invoice"
    ? Math.max(0, Number(data.balance_due ?? data.total))
    : Number(data.total);
  doc.text(fmt(data.currency, balanceDue), rightMargin, y + 28, { align: "right" });

  if (hasPaidToDate) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrMid);
    doc.text("Paid to Date", rightMargin, y + 35, { align: "right" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...clrDark);
    doc.text(fmt(data.currency, Number(data.amount_paid ?? 0)), rightMargin, y + 41, { align: "right" });
  }

  // Left column: company name + address details in accent colour
  let leftY = y;
  if (displayName) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...clrDark);
    doc.text(displayName, margin, leftY);
    leftY += 5.5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrAccent);
    if (data.company_address_line1) { doc.text(data.company_address_line1, margin, leftY); leftY += 4; }
    if (data.company_address_line2) { doc.text(data.company_address_line2, margin, leftY); leftY += 4; }
    const cityLine = [data.company_city, data.company_county, data.company_postcode].filter(Boolean).join(" ");
    if (cityLine)                     { doc.text(cityLine,                  margin, leftY); leftY += 4; }
    if (data.company_phone)           { doc.text(data.company_phone,        margin, leftY); leftY += 4; }
    if (data.company_email)           { doc.text(data.company_email,        margin, leftY); leftY += 4; }
    if (data.company_website)         { doc.text(data.company_website,      margin, leftY); leftY += 4; }
    if (data.company_vat_number)      { doc.text(`VAT Reg: ${data.company_vat_number}`,       margin, leftY); leftY += 4; }
    if (data.company_gas_safe_number) { doc.text(`Gas Safe: ${data.company_gas_safe_number}`, margin, leftY); leftY += 4; }
    if (data.company_oftec_number)    { doc.text(`OFTEC: ${data.company_oftec_number}`,        margin, leftY); leftY += 4; }
  }

  y = Math.max(leftY, hasPaidToDate ? y + 48 : y + 32) + 4;

  // Full-width separator
  doc.setDrawColor(...clrLight);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightMargin, y);
  y += 7;

  // ── SECTION 2: Meta block (right) + Bill To (left) ──────────────────────────

  const metaStartY = y;
  const metaColonX = pageWidth - 68; // right-edge of green label column (wide enough for long values like "Due on Receipt")
  const metaValueX = rightMargin;
  const metaLineH  = 5.5;

  const configuredPaymentTerms = data.payment_terms_days != null && Number(data.payment_terms_days) > 0
    ? Number(data.payment_terms_days)
    : null;
  const invoiceTermsFromDates = data.type === "invoice"
    ? diffDays(data.issue_date, data.due_date)
    : null;
  const quoteValidityFromDates = data.type === "quote"
    ? diffDays(data.issue_date, data.expiry_date)
    : null;

  const termsLabel = data.type === "invoice"
    ? (configuredPaymentTerms != null
        ? `Net ${configuredPaymentTerms} days`
        : (invoiceTermsFromDates != null && invoiceTermsFromDates > 0)
          ? `Net ${invoiceTermsFromDates} days`
          : "Due on Receipt")
    : (configuredPaymentTerms != null
        ? `Net ${configuredPaymentTerms} days`
        : "Due on Acceptance");

  const metaRows: [string, string][] = [
    [data.type === "quote" ? "Quote Date" : "Invoice Date", formatDate(data.issue_date)],
    ["Terms", termsLabel],
  ];
  if (data.type === "invoice" && data.due_date)       metaRows.push(["Due Date",    formatDate(data.due_date)]);
  else if (data.type === "quote" && data.expiry_date) metaRows.push(["Valid Until", formatDate(data.expiry_date)]);
  if (data.type === "quote") {
    const validityDays = data.quote_validity_days != null && Number(data.quote_validity_days) > 0
      ? Number(data.quote_validity_days)
      : quoteValidityFromDates;
    if (validityDays != null && validityDays > 0) {
      metaRows.push(["Validity", `${validityDays} days`]);
    }
  }
  if (data.job_reference) metaRows.push(["P.O.#", data.job_reference]);

  let metaCurY = metaStartY;
  for (const [label, value] of metaRows) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrAccent);
    doc.text(label + " :", metaColonX, metaCurY, { align: "right" });
    doc.setTextColor(...clrDark);
    doc.text(value, metaValueX, metaCurY, { align: "right" });
    metaCurY += metaLineH;
  }

  // Bill To — customer name + address on the left
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...clrDark);
  doc.text(data.customer_name, margin, metaStartY);

  let billY = metaStartY + 5.5;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...clrMid);
  if (data.customer_address_line1) { doc.text(data.customer_address_line1, margin, billY); billY += 4.5; }
  if (data.customer_address_line2) { doc.text(data.customer_address_line2, margin, billY); billY += 4.5; }
  const custCityLine = [data.customer_city, data.customer_county, data.customer_postcode].filter(Boolean).join(", ");
  if (custCityLine)        { doc.text(custCityLine,        margin, billY); billY += 4.5; }
  if (data.customer_email) { doc.text(data.customer_email, margin, billY); billY += 4.5; }
  if (data.customer_phone) { doc.text(data.customer_phone, margin, billY); billY += 4.5; }

  y = Math.max(metaCurY, billY) + 6;

  // ── SECTION 2b: Works Order block ───────────────────────────────────────────

  if (data.works_order) {
    if (y + 16 > pageHeight - 30) { doc.addPage(); y = 20; }
    doc.setDrawColor(...clrLight);
    doc.setLineWidth(0.3);
    doc.line(margin, y, rightMargin, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...clrAccent);
    doc.text("WORKS ORDER", margin, y);
    y += 4.5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrDark);
    const woLines = doc.splitTextToSize(data.works_order, rightMargin - margin) as string[];
    doc.text(woLines, margin, y);
    y += woLines.length * 4.5 + 4;
  }

  // ── SECTION 3: Line-items table ─────────────────────────────────────────────

  const colNumCx = margin + 4;   // # column centre x
  const colDesc  = margin + 11;  // description left x
  const colQty   = pageWidth - 56;
  const colRate  = pageWidth - 34;
  const colAmt   = rightMargin;
  const tableW   = rightMargin - margin;

  // Header row
  doc.setFillColor(75, 75, 75);
  doc.rect(margin, y - 1, tableW, 7, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("#",           colNumCx, y + 3.5, { align: "center" });
  doc.text("Description", colDesc,  y + 3.5);
  doc.text("Qty",         colQty,   y + 3.5, { align: "right" });
  doc.text("Rate",        colRate,  y + 3.5, { align: "right" });
  doc.text("Amount",      colAmt,   y + 3.5, { align: "right" });
  y += 8;

  for (let i = 0; i < data.line_items.length; i++) {
    const item      = data.line_items[i];
    const typeLabel = item.item_type ? capitalizeFirst(item.item_type) : null;
    const descLines = doc.splitTextToSize(item.description, colQty - colDesc - 3) as string[];
    const rowH      = (typeLabel ? 4 : 0) + Math.max(descLines.length, 1) * 4.5 + 3;

    if (y + rowH > pageHeight - 40) { doc.addPage(); y = 20; }

    // item_type sub-label (small bold grey, above description)
    let textY = y + 3.5;
    if (typeLabel) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...clrMid);
      doc.text(typeLabel, colDesc, textY);
      textY += 4;
    }

    // description text
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrDark);
    doc.text(descLines, colDesc, textY);

    // row number and numerics vertically centred in the row
    const midY = y + rowH / 2;
    doc.setFontSize(8);
    doc.setTextColor(...clrMid);
    doc.text(String(i + 1), colNumCx, midY, { align: "center" });

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrDark);
    doc.text(item.quantity.toFixed(2),   colQty,  midY, { align: "right" });
    doc.text(item.unit_price.toFixed(2), colRate, midY, { align: "right" });
    doc.text(item.total.toFixed(2),      colAmt,  midY, { align: "right" });

    y += rowH;

    // thin divider between rows
    doc.setDrawColor(...clrLight);
    doc.setLineWidth(0.2);
    doc.line(margin, y, rightMargin, y);
  }

  y += 5;

  // ── SECTION 4: Totals ────────────────────────────────────────────────────────

  const totLabelX = pageWidth - 50;
  const totValueX = rightMargin;

  const addTotRow = (label: string, value: string, bold = false, size = 9) => {
    if (y + 7 > pageHeight - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? clrDark : clrMid));
    doc.text(label, totLabelX, y, { align: "right" });
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...clrDark);
    doc.text(value, totValueX, y, { align: "right" });
    y += 5.5;
  };

  // Only show Sub Total row when there's VAT (otherwise it's identical to the final total)
  const hasVatBreakdown = data.vat_rate > 0;
  if (hasVatBreakdown) {
    addTotRow("Sub Total", fmt(data.currency, data.subtotal));
    addTotRow(`VAT (${data.vat_rate}%)`, fmt(data.currency, data.vat_amount));
  }

  if (hasVatBreakdown) {
    doc.setDrawColor(...clrLight);
    doc.setLineWidth(0.3);
    doc.line(totLabelX - 38, y - 1, totValueX, y - 1);
    y += 2;
  }

  addTotRow(
    data.type === "quote" ? "Quote Total" : "Balance Due",
    fmt(data.currency, data.total),
    true,
    11,
  );
  doc.setDrawColor(...clrLight);
  doc.line(totLabelX - 38, y - 1, totValueX, y - 1);

  y += 5;

  // ── SECTION 5: Job reference + description below table ──────────────────────

  if (data.job_reference || data.job_description) {
    if (y + 14 > pageHeight - 30) { doc.addPage(); y = 20; }
    doc.setDrawColor(...clrLight);
    doc.setLineWidth(0.3);
    doc.line(margin, y, rightMargin, y);
    y += 5;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrMid);

    if (data.job_reference) {
      doc.text(`Job Ref: ${data.job_reference}`, margin, y);
      y += 5;
    }
    if (data.job_description) {
      const jdLines = doc.splitTextToSize(data.job_description, rightMargin - margin) as string[];
      doc.text(jdLines, margin, y);
      y += jdLines.length * 4.5 + 3;
    }
  }

  // ── SECTION 6: Additional content — payment / customer notes + bank details + links
  // Continues on same page if space permits, otherwise starts a new page.

  const hasExtra = !!(data.company_additional_text || data.customer_notes || data.company_bank_details || data.company_rates_url || data.company_trading_terms_url);
  if (hasExtra) {
    // Estimate how many mm the extra content needs — set font to 8.5pt first so
    // splitTextToSize uses the same size that will be used when rendering.
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const additionalTextLineCount = data.company_additional_text ? (doc.splitTextToSize(data.company_additional_text, rightMargin - margin) as string[]).length : 0;
    const noteLineCount  = data.customer_notes ? (doc.splitTextToSize(data.customer_notes, rightMargin - margin) as string[]).length : 0;
    const bankLineCount  = data.company_bank_details ? (doc.splitTextToSize(data.company_bank_details, rightMargin - margin) as string[]).length : 0;
    const linkCount      = (data.company_rates_url ? 1 : 0) + (data.company_trading_terms_url ? 1 : 0);
    const estimatedH     = (additionalTextLineCount * 4.5) + (additionalTextLineCount > 0 ? 8 : 0)
               + (noteLineCount * 4.5) + (noteLineCount > 0 ? 8 : 0)
                         + (bankLineCount * 4.5) + (bankLineCount > 0 ? 8 : 0)
                         + (linkCount > 0 ? 6 + linkCount * 5.5 : 0)
                         + 10; // separator + padding

    const footerBuffer = 16; // footer line is at pageHeight-14; leave a 2mm gap
    const spaceLeft = pageHeight - footerBuffer - y;

    if (spaceLeft < estimatedH) {
      doc.addPage();
      y = 20;
    } else {
      // Add a small separator before continuing on same page
      y += 4;
      doc.setDrawColor(...clrLight);
      doc.setLineWidth(0.3);
      doc.line(margin, y, rightMargin, y);
      y += 6;
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrMid);

    if (data.company_additional_text) {
      const additionalLines = doc.splitTextToSize(data.company_additional_text, rightMargin - margin) as string[];
      doc.text(additionalLines, margin, y);
      y += additionalLines.length * 4.5 + 8;
    }

    if (data.customer_notes) {
      const noteLines = doc.splitTextToSize(data.customer_notes, rightMargin - margin) as string[];
      doc.text(noteLines, margin, y);
      y += noteLines.length * 4.5 + 8;
    }

    if (data.company_bank_details) {
      const bankLines = doc.splitTextToSize(data.company_bank_details, rightMargin - margin) as string[];
      doc.text(bankLines, margin, y);
      y += bankLines.length * 4.5 + 8;
    }

    // Rates / trading terms links
    if (data.company_rates_url || data.company_trading_terms_url) {
      doc.setDrawColor(...clrLight);
      doc.setLineWidth(0.3);
      doc.line(margin, y, rightMargin, y);
      y += 6;

      if (data.company_rates_url) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...clrMid);
        doc.text("Rates: ", margin, y);
        const labelW = doc.getTextWidth("Rates: ");
        doc.setTextColor(41, 98, 168);
        doc.text(data.company_rates_url, margin + labelW, y);
        const linkW = doc.getTextWidth(data.company_rates_url);
        doc.link(margin + labelW, y - 3, linkW, 4.5, { url: data.company_rates_url });
        y += 5.5;
      }

      if (data.company_trading_terms_url) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...clrMid);
        doc.text("Trading Terms: ", margin, y);
        const labelW = doc.getTextWidth("Trading Terms: ");
        doc.setTextColor(41, 98, 168);
        doc.text(data.company_trading_terms_url, margin + labelW, y);
        const linkW = doc.getTextWidth(data.company_trading_terms_url);
        doc.link(margin + labelW, y - 3, linkW, 4.5, { url: data.company_trading_terms_url });
        y += 5.5;
      }
    }
  }

  // ── FOOTER: separator + optional text + page number on every page ────────────

  const totalPages = doc.getNumberOfPages();
  const footerText = data.company_footer_text || "";

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...clrLight);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, rightMargin, pageHeight - 14);

    if (footerText) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...clrMid);
      doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: "center" });
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...clrLight);
    doc.text(String(p), rightMargin, pageHeight - 8, { align: "right" });
  }

  const buf = doc.output("arraybuffer");
  return Buffer.from(buf);
}
