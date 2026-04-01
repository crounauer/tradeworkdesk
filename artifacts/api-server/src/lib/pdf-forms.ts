import jsPDFModule from "jspdf";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;

export interface PdfCompanySettings {
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

function renderPdfHeader(
  doc: jsPDF,
  company: PdfCompanySettings | undefined,
  title: string,
  subtitle?: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  const companyName = company?.name || company?.trading_name || "";

  if (companyName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const addrParts: string[] = [];
    if (company?.address_line1) addrParts.push(company.address_line1);
    if (company?.address_line2) addrParts.push(company.address_line2);
    if (company?.city) addrParts.push(company.city);
    if (company?.postcode) addrParts.push(company.postcode);
    const addrLine = addrParts.join(", ");

    const contactParts: string[] = [];
    if (company?.phone) contactParts.push(company.phone);
    if (company?.email) contactParts.push(company.email);
    if (company?.website) contactParts.push(company.website);
    const contactLine = contactParts.join("  |  ");

    const regParts: string[] = [];
    if (company?.gas_safe_number) regParts.push(`Gas Safe: ${company.gas_safe_number}`);
    if (company?.oftec_number) regParts.push(`OFTEC: ${company.oftec_number}`);
    if (company?.vat_number) regParts.push(`VAT: ${company.vat_number}`);
    const regLine = regParts.join("  |  ");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, margin, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    if (addrLine) { doc.text(addrLine, margin, y); y += 4.5; }
    if (contactLine) { doc.text(contactLine, margin, y); y += 4.5; }
    if (regLine) { doc.text(regLine, margin, y); y += 4.5; }

    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 6;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  doc.setTextColor(0, 0, 0);
  return y;
}

function pdfFooterText(company: PdfCompanySettings | undefined, docType: string): string {
  const name = company?.name || company?.trading_name;
  return name ? `${docType} - ${name}` : `${docType}`;
}

function createPdfHelpers(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const checkPageBreak = (currentY: number, needed: number): number => {
    if (currentY + needed > pageHeight - 20) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  const addSection = (y: number, title: string, rows: [string, string][], titleColor: [number, number, number] = [59, 130, 246]) => {
    y = checkPageBreak(y, 10 + rows.length * 6);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...titleColor);
    doc.text(title, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const [label, value] of rows) {
      y = checkPageBreak(y, 6);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, margin + 2, y);
      doc.setFont("helvetica", "normal");
      const text = value || "N/A";
      const maxWidth = pageWidth - 95;
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, 80, y);
      y += Math.max(lines.length, 1) * 5;
    }
    y += 4;
    return y;
  };

  const bool = (v?: boolean | string | null) => {
    if (typeof v === "string") return v === "true" || v === "Yes" ? "Yes" : "No";
    return v ? "Yes" : "No";
  };

  return { pageWidth, pageHeight, margin, checkPageBreak, addSection, bool };
}

function addSignatureBlock(doc: jsPDF, helpers: ReturnType<typeof createPdfHelpers>, y: number, company: PdfCompanySettings | undefined, docType: string): void {
  const { pageWidth, pageHeight, margin, checkPageBreak } = helpers;
  y = checkPageBreak(y, 30);
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, 80, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Customer Signature", margin, y + 5);
  doc.line(pageWidth - 80, y, pageWidth - margin, y);
  doc.text("Technician Signature", pageWidth - 80, y + 5);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(pdfFooterText(company, docType), pageWidth / 2, pageHeight - 10, { align: "center" });
}

interface FormContext {
  jobRef: string;
  customerName: string;
  propertyAddress: string;
  technicianName: string;
  scheduledDate: string;
}

function str(v: unknown): string {
  if (v == null || v === "null" || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function generateFormPdf(
  formType: string,
  formLabel: string,
  record: Record<string, unknown>,
  fieldMap: Record<string, string>,
  ctx: FormContext,
  company?: PdfCompanySettings,
): Buffer {
  const doc = new jsPDF();
  const helpers = createPdfHelpers(doc);
  const { margin, addSection, bool } = helpers;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = renderPdfHeader(doc, company, formLabel);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Job Ref: ${ctx.jobRef}`, margin, y);
  doc.text(`Date: ${ctx.scheduledDate}`, pageWidth - margin, y, { align: "right" });
  y += 4;

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  y = addSection(y, "Job Details", [
    ["Customer", ctx.customerName],
    ["Property", ctx.propertyAddress],
    ["Technician", ctx.technicianName],
    ["Date", ctx.scheduledDate],
  ]);

  const fieldRows: [string, string][] = [];
  for (const [col, label] of Object.entries(fieldMap)) {
    const val = record[col];
    if (val != null && val !== "" && val !== "null") {
      fieldRows.push([label, str(val)]);
    }
  }

  if (fieldRows.length > 0) {
    const chunkSize = 12;
    for (let i = 0; i < fieldRows.length; i += chunkSize) {
      const chunk = fieldRows.slice(i, i + chunkSize);
      const sectionTitle = i === 0 ? `${formLabel} Details` : `${formLabel} Details (cont.)`;
      y = addSection(y, sectionTitle, chunk);
    }
  }

  addSignatureBlock(doc, helpers, y, company, formLabel);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
