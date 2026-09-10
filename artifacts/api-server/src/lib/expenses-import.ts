import { createHash } from "node:crypto";

export interface ParsedExpenseRow {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // always positive; only money-out rows are returned
  category: string | null;
  dedupeHash: string;
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "transactiondate", "postingdate", "postdate"],
  description: ["description", "details", "narrative", "memo"],
  amount: ["amount", "value"],
  debit: ["debit", "moneyout", "paidout", "withdrawal", "outflow"],
  credit: ["credit", "moneyin", "paidin", "deposit", "inflow"],
  balance: ["balance", "runningbalance", "closingbalance", "balanceafter"],
  reference: ["reference", "transactionid", "transactionreference", "refnumber", "chequenumber", "id"],
  // Counterparty name — often a richer identifier than the raw description/reference (e.g. "British Gas" vs "000000000073068923").
  name: ["name", "counterparty", "payee", "merchant", "payeename", "merchantname"],
  category: ["category"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Exact match first (e.g. "Date" == "date"), then fall back to substring
// matching so compound headers like "Transaction description" or "Category
// name" — common on real bank exports — still match "description"/"category".
function detectColumn(headers: string[], field: keyof typeof HEADER_ALIASES): number {
  const aliases = HEADER_ALIASES[field];
  const normalized = headers.map(normalizeHeader);
  const exactIndex = normalized.findIndex((h) => aliases.includes(h));
  if (exactIndex !== -1) return exactIndex;
  return normalized.findIndex((h) => aliases.some((alias) => h.includes(alias)));
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

export function buildDedupeHash(
  tenantId: string,
  date: string,
  description: string,
  amount: number,
  extra?: { balance?: number | null; reference?: string | null; occurrence?: number },
): string {
  const parts = [tenantId, date, description.trim().toLowerCase(), amount.toFixed(2)];
  if (extra?.balance != null) parts.push(`bal:${extra.balance.toFixed(2)}`);
  if (extra?.reference) parts.push(`ref:${extra.reference.trim().toLowerCase()}`);
  if (extra?.occurrence) parts.push(`occ:${extra.occurrence}`);
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

// Tracks how many times an identical (date, description, amount) signature has
// been seen so far *within one file*, so genuinely repeated transactions (e.g.
// several identical bank fees on the same day) get distinct dedupe hashes from
// each other, while re-uploading the same file still produces the same hash
// sequence and is correctly recognised as duplicates.
class OccurrenceTracker {
  private seen = new Map<string, number>();

  next(date: string, description: string, amount: number): number {
    const key = `${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`;
    const count = (this.seen.get(key) ?? 0) + 1;
    this.seen.set(key, count);
    return count - 1; // 0 for the first occurrence, so its hash matches the old (pre-occurrence) format
  }
}

export interface CsvParseResult {
  rows: ParsedExpenseRow[];
  skippedCredits: number;
  skippedUnparseable: number;
}

export interface ExpenseCsvColumnMapping {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  balance: number;
  reference: number;
  name: number;
  category: number;
}

export function detectExpenseCsvMapping(headers: string[]): ExpenseCsvColumnMapping {
  return {
    date: detectColumn(headers, "date"),
    description: detectColumn(headers, "description"),
    amount: detectColumn(headers, "amount"),
    debit: detectColumn(headers, "debit"),
    credit: detectColumn(headers, "credit"),
    balance: detectColumn(headers, "balance"),
    reference: detectColumn(headers, "reference"),
    name: detectColumn(headers, "name"),
    category: detectColumn(headers, "category"),
  };
}

export interface ExpenseCsvPreview {
  headers: string[];
  sampleRows: string[][];
  guessedMapping: ExpenseCsvColumnMapping;
}

// Reads just the header row + a few sample rows, for a column-mapping confirmation
// step before committing — bank CSV layouts vary too much to trust auto-detection blindly.
export function previewExpenseCsv(content: string): ExpenseCsvPreview {
  const lines = parseCsvLines(content);
  if (lines.length === 0) throw new Error("This file appears to be empty.");
  const headers = lines[0];
  return {
    headers,
    sampleRows: lines.slice(1, 6),
    guessedMapping: detectExpenseCsvMapping(headers),
  };
}

function buildImportDescription(rawDesc: string, rawName: string | null): string {
  const desc = rawDesc.trim();
  const name = (rawName || "").trim();
  if (!name) return desc;
  if (!desc || desc.toLowerCase() === name.toLowerCase()) return name;
  // Combine counterparty name with the raw description/reference so cryptic
  // reference-only descriptions (e.g. "000000000073068923") still show who it was to/from.
  return desc.toLowerCase().includes(name.toLowerCase()) ? desc : `${name} — ${desc}`;
}

// Parses a bank statement CSV and returns only money-out (expense) rows.
// If `mapping` is omitted, columns are auto-detected from the header row.
export function parseExpenseCsv(content: string, tenantId: string, mapping?: ExpenseCsvColumnMapping): CsvParseResult {
  const lines = parseCsvLines(content);
  if (lines.length < 2) return { rows: [], skippedCredits: 0, skippedUnparseable: 0 };

  const headers = lines[0];
  const cols = mapping ?? detectExpenseCsvMapping(headers);
  const { date: dateCol, description: descCol, amount: amountCol, debit: debitCol, credit: creditCol, balance: balanceCol, reference: referenceCol, name: nameCol, category: categoryCol } = cols;

  if (dateCol === -1 || descCol === -1 || (amountCol === -1 && debitCol === -1)) {
    throw new Error("Could not detect Date, Description and Amount/Debit columns in this CSV. Please check the file has a header row, or map the columns manually.");
  }

  const rows: ParsedExpenseRow[] = [];
  let skippedCredits = 0;
  let skippedUnparseable = 0;
  const occurrences = new OccurrenceTracker();

  for (const line of lines.slice(1)) {
    const rawDate = line[dateCol] ?? "";
    const rawDesc = line[descCol] ?? "";
    const date = parseDate(rawDate);
    const rawName = nameCol !== -1 ? (line[nameCol] ?? "") : null;
    const description = buildImportDescription(rawDesc, rawName);

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

    const balance = balanceCol !== -1 ? parseAmount(line[balanceCol] ?? "") : null;
    const reference = referenceCol !== -1 ? (line[referenceCol] ?? "").trim() : null;
    const category = categoryCol !== -1 ? (line[categoryCol] ?? "").trim() || null : null;
    const occurrence = occurrences.next(date, description, amount);

    rows.push({
      date,
      description,
      amount,
      category,
      dedupeHash: buildDedupeHash(tenantId, date, description, amount, { balance, reference, occurrence }),
    });
  }

  return { rows, skippedCredits, skippedUnparseable };
}

// ── PDF bank statement parsing ──────────────────────────────────────────────
// Banks that don't offer a CSV export (e.g. Tide) still show a running balance
// per transaction line in their PDF statements. Rather than relying on fragile
// column-position parsing (which breaks whenever text extraction reflows a
// table), we detect money-out rows from the balance *decreasing* between
// consecutive transaction lines — this is layout-independent and works across
// most UK bank statement formats.
const MONTH_INDEX: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const PDF_DATE_LINE_RE = /^((?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})|(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(?:\d{4}-\d{2}-\d{2}))\s+(.*)$/;
const MONEY_TOKEN_RE = /-?£?\d{1,3}(?:,\d{3})*\.\d{2}/g;

function parsePdfDateToken(token: string): string | null {
  const monthMatch = token.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthMatch) {
    const [, d, mon, y] = monthMatch;
    const mm = MONTH_INDEX[mon.slice(0, 3).toLowerCase()];
    if (mm) return `${y}-${mm}-${d.padStart(2, "0")}`;
  }
  const slashMatch = token.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const [, d, m, yRaw] = slashMatch;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  return null;
}

function parseMoneyToken(token: string): number {
  return Number(token.replace(/[£,]/g, ""));
}

export function parseExpensePdfText(text: string, tenantId: string): CsvParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedExpenseRow[] = [];
  let skippedCredits = 0;
  let skippedUnparseable = 0;
  let previousBalance: number | null = null;
  const occurrences = new OccurrenceTracker();

  for (const line of lines) {
    const dateMatch = line.match(PDF_DATE_LINE_RE);
    if (!dateMatch) continue; // headers, totals, page footers etc. — not a transaction line

    const date = parsePdfDateToken(dateMatch[1]);
    const rest = dateMatch[2];
    const moneyTokens = rest.match(MONEY_TOKEN_RE);

    if (!date || !moneyTokens || moneyTokens.length === 0) { skippedUnparseable++; continue; }

    const balance = parseMoneyToken(moneyTokens[moneyTokens.length - 1]);
    const firstMoneyIndex = rest.indexOf(moneyTokens[0]);
    const description = (firstMoneyIndex > 0 ? rest.slice(0, firstMoneyIndex) : rest).trim();

    if (moneyTokens.length < 2) { skippedUnparseable++; continue; } // no running balance to diff against — can't safely tell direction

    if (previousBalance == null) {
      // First transaction line only establishes the balance baseline; its own
      // direction can't be determined without an earlier balance to compare to.
      previousBalance = balance;
      continue;
    }

    const delta = Math.round((balance - previousBalance) * 100) / 100;
    previousBalance = balance;
    if (delta >= 0) { skippedCredits++; continue; }
    if (!description) { skippedUnparseable++; continue; }

    const amount = Math.abs(delta);
    const occurrence = occurrences.next(date, description, amount);
    rows.push({
      date,
      description,
      amount,
      category: null,
      dedupeHash: buildDedupeHash(tenantId, date, description, amount, { balance, occurrence }),
    });
  }

  return { rows, skippedCredits, skippedUnparseable };
}

