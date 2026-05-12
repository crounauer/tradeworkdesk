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
  // Notes
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

/**
 * Generate a jsPDF invoice or quote PDF and return as a Buffer.
 */
export function generateInvoicePdf(data: InvoicePdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const rightMargin = pageWidth - margin;
  let y = 14;

  // ── Header ──────────────────────────────────────────────────────────────────
  const displayName = data.company_trading_name || data.company_name || "";

  if (displayName) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(displayName, margin, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const addrParts: string[] = [];
    if (data.company_address_line1) addrParts.push(data.company_address_line1);
    if (data.company_address_line2) addrParts.push(data.company_address_line2);
    if (data.company_city) addrParts.push(data.company_city);
    if (data.company_county) addrParts.push(data.company_county);
    if (data.company_postcode) addrParts.push(data.company_postcode);
    if (addrParts.length) { doc.text(addrParts.join(", "), margin, y); y += 4.5; }

    const contactParts: string[] = [];
    if (data.company_phone) contactParts.push(data.company_phone);
    if (data.company_email) contactParts.push(data.company_email);
    if (data.company_website) contactParts.push(data.company_website);
    if (contactParts.length) { doc.text(contactParts.join("  |  "), margin, y); y += 4.5; }

    const regParts: string[] = [];
    if (data.company_vat_number) regParts.push(`VAT: ${data.company_vat_number}`);
    if (data.company_gas_safe_number) regParts.push(`Gas Safe: ${data.company_gas_safe_number}`);
    if (data.company_oftec_number) regParts.push(`OFTEC: ${data.company_oftec_number}`);
    if (regParts.length) { doc.text(regParts.join("  |  "), margin, y); y += 4.5; }

    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, rightMargin, y);
    y += 5;
  }

  // ── Document title ───────────────────────────────────────────────────────────
  const docTitle = data.type === "quote" ? "QUOTATION" : "INVOICE";
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text(docTitle, rightMargin, y, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // ── Invoice meta (right-aligned block) ───────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const metaY = y - 4;
  const labelX = pageWidth - 60;
  const valueX = rightMargin;
  const metaLineH = 5;

  const metaRows: [string, string][] = [
    [data.type === "quote" ? "Quote Number" : "Invoice Number", data.invoice_number],
    ["Issue Date", formatDate(data.issue_date)],
  ];
  if (data.type === "invoice" && data.due_date) {
    metaRows.push(["Due Date", formatDate(data.due_date)]);
  } else if (data.type === "quote" && data.expiry_date) {
    metaRows.push(["Valid Until", formatDate(data.expiry_date)]);
  }
  if (data.job_reference) metaRows.push(["Job Reference", data.job_reference]);

  let metaCurY = metaY + 8;
  for (const [label, value] of metaRows) {
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", labelX, metaCurY);
    doc.setFont("helvetica", "normal");
    doc.text(value, valueX, metaCurY, { align: "right" });
    metaCurY += metaLineH;
  }

  y = Math.max(y, metaCurY) + 4;

  // ── Bill To ──────────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("BILL TO", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.customer_name, margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const custParts: string[] = [];
  if (data.customer_address_line1) custParts.push(data.customer_address_line1);
  if (data.customer_address_line2) custParts.push(data.customer_address_line2);
  if (data.customer_city) custParts.push(data.customer_city);
  if (data.customer_county) custParts.push(data.customer_county);
  if (data.customer_postcode) custParts.push(data.customer_postcode);
  for (const p of custParts) { doc.text(p, margin, y); y += 4.5; }
  if (data.customer_email) { doc.text(data.customer_email, margin, y); y += 4.5; }
  if (data.customer_phone) { doc.text(data.customer_phone, margin, y); y += 4.5; }

  y += 4;

  // ── Job description ──────────────────────────────────────────────────────────
  if (data.job_description) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("DESCRIPTION OF WORK", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(data.job_description, rightMargin - margin);
    doc.text(descLines, margin, y);
    y += descLines.length * 4.5 + 4;
  }

  // ── Line items table ─────────────────────────────────────────────────────────
  const colDesc = margin;
  const colQty  = pageWidth - 80;
  const colPrice = pageWidth - 55;
  const colTotal = rightMargin;

  // Table header
  doc.setFillColor(30, 64, 175);
  doc.rect(margin, y - 1, rightMargin - margin, 7, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Description", colDesc + 2, y + 4);
  doc.text("Qty", colQty, y + 4, { align: "right" });
  doc.text("Unit Price", colPrice, y + 4, { align: "right" });
  doc.text("Total", colTotal, y + 4, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 9;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let rowAlt = false;
  for (const item of data.line_items) {
    const descLines = doc.splitTextToSize(item.description, colQty - margin - 4);
    const rowH = Math.max(descLines.length * 4.5, 6) + 2;

    // Check page break
    if (y + rowH > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    if (rowAlt) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, rightMargin - margin, rowH, "F");
    }
    rowAlt = !rowAlt;

    doc.setTextColor(0, 0, 0);
    doc.text(descLines, colDesc + 2, y + 3.5);
    doc.text(String(item.quantity), colQty, y + 3.5, { align: "right" });
    doc.text(fmt(data.currency, item.unit_price), colPrice, y + 3.5, { align: "right" });
    doc.text(fmt(data.currency, item.total), colTotal, y + 3.5, { align: "right" });

    y += rowH;
  }

  // Bottom separator
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightMargin, y);
  y += 4;

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totalsLabelX = pageWidth - 65;
  const totalsValueX = rightMargin;

  const addTotalRow = (label: string, value: string, bold = false) => {
    if (y + 6 > pageHeight - 30) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 9);
    doc.text(label, totalsLabelX, y);
    doc.text(value, totalsValueX, y, { align: "right" });
    y += 5.5;
  };

  addTotalRow("Subtotal", fmt(data.currency, data.subtotal));
  addTotalRow(`VAT (${data.vat_rate}%)`, fmt(data.currency, data.vat_amount));

  doc.setDrawColor(200, 200, 200);
  doc.line(totalsLabelX, y - 1, totalsValueX, y - 1);
  y += 1;

  addTotalRow(data.type === "quote" ? "Quote Total" : "Amount Due", fmt(data.currency, data.total), true);

  y += 5;

  // ── Customer notes / terms ───────────────────────────────────────────────────
  if (data.customer_notes) {
    if (y + 20 > pageHeight - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(data.type === "quote" ? "NOTES" : "PAYMENT DETAILS", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.customer_notes, rightMargin - margin);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5 + 4;
  }

  // ── Bank details ─────────────────────────────────────────────────────────────
  if (data.company_bank_details && data.type === "invoice") {
    if (y + 20 > pageHeight - 25) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BANK DETAILS", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
    doc.setFont("helvetica", "normal");
    const bankLines = doc.splitTextToSize(data.company_bank_details, rightMargin - margin);
    doc.text(bankLines, margin, y);
    y += bankLines.length * 4.5 + 4;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerText = data.company_footer_text || (displayName ? `Thank you for choosing ${displayName}.` : "");
  if (footerText) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(140, 140, 140);
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });
  }

  const buf = doc.output("arraybuffer");
  return Buffer.from(buf);
}
