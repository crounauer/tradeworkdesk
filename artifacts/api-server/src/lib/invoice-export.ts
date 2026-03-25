export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  company_vat_number: string;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  job_id: string;
  job_type: string;
  job_description: string;
  lines: InvoiceLineItem[];
  parts_total: number;
  labour_total: number;
  call_out_fee: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
}

function escapeCSV(val: string | number | null | undefined): string {
  let s = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateUniversalCSV(invoices: InvoiceData[]): string {
  const headers = [
    "Invoice Number", "Invoice Date", "Due Date", "Currency",
    "Company Name", "Company Address", "Company VAT Number",
    "Customer Name", "Customer Email", "Customer Address",
    "Job Reference", "Job Type", "Description",
    "Line Description", "Quantity", "Unit Price", "Line Total",
    "Subtotal", "VAT Rate %", "VAT Amount", "Total"
  ];

  const rows: string[] = [headers.map(escapeCSV).join(",")];

  for (const inv of invoices) {
    for (let i = 0; i < inv.lines.length; i++) {
      const line = inv.lines[i];
      const isFirst = i === 0;
      const isLast = i === inv.lines.length - 1;
      rows.push([
        escapeCSV(inv.invoice_number),
        escapeCSV(inv.invoice_date),
        escapeCSV(inv.due_date),
        escapeCSV(inv.currency),
        escapeCSV(isFirst ? inv.company_name : ""),
        escapeCSV(isFirst ? inv.company_address : ""),
        escapeCSV(isFirst ? inv.company_vat_number : ""),
        escapeCSV(isFirst ? inv.customer_name : ""),
        escapeCSV(isFirst ? inv.customer_email : ""),
        escapeCSV(isFirst ? inv.customer_address : ""),
        escapeCSV(isFirst ? inv.job_id : ""),
        escapeCSV(isFirst ? inv.job_type : ""),
        escapeCSV(isFirst ? inv.job_description : ""),
        escapeCSV(line.description),
        escapeCSV(line.quantity),
        escapeCSV(line.unit_price.toFixed(2)),
        escapeCSV(line.total.toFixed(2)),
        escapeCSV(isLast ? inv.subtotal.toFixed(2) : ""),
        escapeCSV(isLast ? inv.vat_rate.toFixed(2) : ""),
        escapeCSV(isLast ? inv.vat_amount.toFixed(2) : ""),
        escapeCSV(isLast ? inv.total.toFixed(2) : ""),
      ].join(","));
    }
    if (inv.lines.length === 0) {
      rows.push([
        escapeCSV(inv.invoice_number),
        escapeCSV(inv.invoice_date),
        escapeCSV(inv.due_date),
        escapeCSV(inv.currency),
        escapeCSV(inv.company_name),
        escapeCSV(inv.company_address),
        escapeCSV(inv.company_vat_number),
        escapeCSV(inv.customer_name),
        escapeCSV(inv.customer_email),
        escapeCSV(inv.customer_address),
        escapeCSV(inv.job_id),
        escapeCSV(inv.job_type),
        escapeCSV(inv.job_description),
        "", "", "", "",
        escapeCSV(inv.subtotal.toFixed(2)),
        escapeCSV(inv.vat_rate.toFixed(2)),
        escapeCSV(inv.vat_amount.toFixed(2)),
        escapeCSV(inv.total.toFixed(2)),
      ].join(","));
    }
  }

  return rows.join("\r\n");
}

function sanitizeIIF(val: string): string {
  return String(val).replace(/[\t\r\n]/g, " ").trim();
}

export function generateQuickBooksIIF(invoices: InvoiceData[]): string {
  const lines: string[] = [];
  lines.push("!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO");
  lines.push("!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\tQNTY\tPRICE");
  lines.push("!ENDTRNS");

  for (const inv of invoices) {
    lines.push(`TRNS\tINVOICE\t${formatIIFDate(inv.invoice_date)}\tAccounts Receivable\t${sanitizeIIF(inv.customer_name)}\t${inv.total.toFixed(2)}\t${sanitizeIIF(inv.invoice_number)}\t${sanitizeIIF(inv.job_description)}`);

    for (const line of inv.lines) {
      lines.push(`SPL\tINVOICE\t${formatIIFDate(inv.invoice_date)}\tSales Income\t${sanitizeIIF(inv.customer_name)}\t${(-line.total).toFixed(2)}\t${sanitizeIIF(inv.invoice_number)}\t${sanitizeIIF(line.description)}\t${line.quantity}\t${line.unit_price.toFixed(2)}`);
    }

    if (inv.vat_amount > 0) {
      lines.push(`SPL\tINVOICE\t${formatIIFDate(inv.invoice_date)}\tVAT Liability\t${sanitizeIIF(inv.customer_name)}\t${(-inv.vat_amount).toFixed(2)}\t${sanitizeIIF(inv.invoice_number)}\tVAT @ ${inv.vat_rate}%\t\t`);
    }

    lines.push("ENDTRNS");
  }

  return lines.join("\r\n");
}

function formatIIFDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function generateXeroCSV(invoices: InvoiceData[]): string {
  const headers = [
    "*ContactName", "EmailAddress", "*InvoiceNumber", "*InvoiceDate",
    "*DueDate", "Total", "InventoryItemCode", "*Description",
    "*Quantity", "*UnitAmount", "*AccountCode", "*TaxType", "TaxAmount", "Currency"
  ];

  const rows: string[] = [headers.map(escapeCSV).join(",")];

  for (const inv of invoices) {
    for (let i = 0; i < inv.lines.length; i++) {
      const line = inv.lines[i];
      const isFirst = i === 0;
      rows.push([
        escapeCSV(inv.customer_name),
        escapeCSV(isFirst ? inv.customer_email : ""),
        escapeCSV(inv.invoice_number),
        escapeCSV(inv.invoice_date),
        escapeCSV(inv.due_date),
        escapeCSV(isFirst ? inv.total.toFixed(2) : ""),
        "",
        escapeCSV(line.description),
        escapeCSV(line.quantity),
        escapeCSV(line.unit_price.toFixed(2)),
        escapeCSV("200"),
        escapeCSV(inv.vat_rate > 0 ? `${inv.vat_rate}% (VAT on Income)` : "No VAT"),
        escapeCSV(isFirst ? inv.vat_amount.toFixed(2) : ""),
        escapeCSV(inv.currency),
      ].join(","));
    }
    if (inv.lines.length === 0) {
      rows.push([
        escapeCSV(inv.customer_name),
        escapeCSV(inv.customer_email),
        escapeCSV(inv.invoice_number),
        escapeCSV(inv.invoice_date),
        escapeCSV(inv.due_date),
        escapeCSV(inv.total.toFixed(2)),
        "", "", "", "",
        escapeCSV("200"),
        escapeCSV("No VAT"),
        escapeCSV("0.00"),
        escapeCSV(inv.currency),
      ].join(","));
    }
  }

  return rows.join("\r\n");
}

export function generateSageCSV(invoices: InvoiceData[]): string {
  const headers = [
    "Type", "Account Reference", "Nominal A/C Ref", "Department Code",
    "Date", "Reference", "Details", "Net Amount", "Tax Code", "Tax Amount",
    "Exchange Rate", "Extra Reference", "User Name", "Project Ref",
    "Cost Code Ref", "Department Ref"
  ];

  const rows: string[] = [headers.map(escapeCSV).join(",")];

  for (const inv of invoices) {
    for (const line of inv.lines) {
      rows.push([
        escapeCSV("SI"),
        escapeCSV(inv.customer_name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8).toUpperCase()),
        escapeCSV("4000"),
        escapeCSV(""),
        escapeCSV(formatSageDate(inv.invoice_date)),
        escapeCSV(inv.invoice_number),
        escapeCSV(line.description),
        escapeCSV(line.total.toFixed(2)),
        escapeCSV(inv.vat_rate > 0 ? "T1" : "T0"),
        escapeCSV((line.total * inv.vat_rate / 100).toFixed(2)),
        escapeCSV("1.00"),
        escapeCSV(inv.job_id.substring(0, 8)),
        "", "", "", "",
      ].join(","));
    }
  }

  return rows.join("\r\n");
}

function formatSageDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function generateInvoiceNumber(jobCreatedAt: string, jobIdShort: string): string {
  const d = new Date(jobCreatedAt);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `INV-${yy}${mm}-${jobIdShort.toUpperCase()}`;
}
