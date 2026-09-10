import { createHash } from "node:crypto";

export interface ParsedExpenseRow {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // always positive; only money-out rows are returned
  dedupeHash: string;
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "transactiondate", "postingdate", "postdate"],
  description: ["description", "details", "narrative", "memo", "transaction", "reference", "payee"],
  amount: ["amount", "value"],
  debit: ["debit", "moneyout", "paidout", "withdrawal", "outflow"],
  credit: ["credit", "moneyin", "paidin", "deposit", "inflow"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function detectColumn(headers: string[], field: keyof typeof HEADER_ALIASES): number {
  const aliases = HEADER_ALIASES[field];
  return headers.findIndex((h) => aliases.includes(normalizeHeader(h)));
}

// Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes, and CRLF/LF.
export function parseCsvLines(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[£$,\s]/g, "").trim();
  if (!cleaned) return null;
  const negative = /^\(.*\)$/.test(cleaned);
  const numeric = Number(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return negative ? -Math.abs(numeric) : numeric;
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  // DD/MM/YYYY or DD-MM-YYYY (UK bank export convention)
  const ukMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ukMatch) {
    const [, d, m, y] = ukMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export function buildDedupeHash(tenantId: string, date: string, description: string, amount: number): string {
  return createHash("sha256")
    .update(`${tenantId}|${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`)
    .digest("hex");
}

export interface CsvParseResult {
  rows: ParsedExpenseRow[];
  skippedCredits: number;
  skippedUnparseable: number;
}

// Parses a bank statement CSV and returns only money-out (expense) rows.
export function parseExpenseCsv(content: string, tenantId: string): CsvParseResult {
  const lines = parseCsvLines(content);
  if (lines.length < 2) return { rows: [], skippedCredits: 0, skippedUnparseable: 0 };

  const headers = lines[0];
  const dateCol = detectColumn(headers, "date");
  const descCol = detectColumn(headers, "description");
  const amountCol = detectColumn(headers, "amount");
  const debitCol = detectColumn(headers, "debit");
  const creditCol = detectColumn(headers, "credit");

  if (dateCol === -1 || descCol === -1 || (amountCol === -1 && debitCol === -1)) {
    throw new Error("Could not detect Date, Description and Amount/Debit columns in this CSV. Please check the file has a header row.");
  }

  const rows: ParsedExpenseRow[] = [];
  let skippedCredits = 0;
  let skippedUnparseable = 0;

  for (const line of lines.slice(1)) {
    const rawDate = line[dateCol] ?? "";
    const rawDesc = line[descCol] ?? "";
    const date = parseDate(rawDate);
    const description = rawDesc.trim();

    let amount: number | null = null;
    if (debitCol !== -1) {
      const debitVal = parseAmount(line[debitCol] ?? "");
      if (debitVal != null && debitVal !== 0) amount = Math.abs(debitVal);
      else if (creditCol !== -1) { skippedCredits++; continue; }
    } else if (amountCol !== -1) {
      const amountVal = parseAmount(line[amountCol] ?? "");
      if (amountVal == null) { skippedUnparseable++; continue; }
      if (amountVal >= 0) { skippedCredits++; continue; } // positive = money in, not an expense
      amount = Math.abs(amountVal);
    }

    if (!date || !description || amount == null) { skippedUnparseable++; continue; }

    rows.push({ date, description, amount, dedupeHash: buildDedupeHash(tenantId, date, description, amount) });
  }

  return { rows, skippedCredits, skippedUnparseable };
}
