import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { parseExpenseCsv, parseExpensePdfText, previewExpenseCsv, buildDedupeHash, type ExpenseCsvColumnMapping } from "../lib/expenses-import";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const canManage = [requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin")] as const;

// Suggested categories shown in the UI; category is free text so tenants aren't locked in.
export const SUGGESTED_EXPENSE_CATEGORIES = [
  "Materials & Parts", "Fuel & Travel", "Tools & Equipment", "Insurance",
  "Subscriptions & Software", "Vehicle", "Office & Admin", "Marketing",
  "Professional Fees", "Rent & Utilities", "Other",
] as const;

// ─── LIST ───────────────────────────────────────────────────────────────────
router.get("/expenses", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const search = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1), 500);
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);

  let q = supabaseAdmin
    .from("expenses")
    .select("*, creator:profiles!created_by(full_name)", { count: "exact" })
    .eq("tenant_id", req.tenantId!)
    .order("expense_date", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (from) q = q.gte("expense_date", from);
  if (to) q = q.lte("expense_date", to);
  if (category) q = q.eq("category", category);
  if (search) q = q.ilike("description", `%${search}%`);

  const { data, error, count } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const totalsRows: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 1000) {
    let totalsQuery = supabaseAdmin
      .from("expenses")
      .select("amount, vat_amount")
      .eq("tenant_id", req.tenantId!)
      .range(offset, offset + 999);
    if (from) totalsQuery = totalsQuery.gte("expense_date", from);
    if (to) totalsQuery = totalsQuery.lte("expense_date", to);

    const { data: page, error: totalsError } = await totalsQuery;
    if (totalsError) { res.status(500).json({ error: totalsError.message }); return; }
    totalsRows.push(...((page || []) as Array<Record<string, unknown>>));
    if (!page || page.length < 1000) break;
  }
  const totalAmount = totalsRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalVat = totalsRows.reduce((sum, r) => sum + Number(r.vat_amount || 0), 0);

  res.json({
    items: data || [],
    pagination: { page, limit, total: count || 0 },
    totals: { amount: Math.round(totalAmount * 100) / 100, vat_amount: Math.round(totalVat * 100) / 100 },
  });
});

// ─── CATEGORIES (suggested list) ────────────────────────────────────────────
router.get("/expenses/categories", requireAuth, requireTenant, async (_req: AuthenticatedRequest, res): Promise<void> => {
  res.json({ categories: SUGGESTED_EXPENSE_CATEGORIES });
});

// ─── DATE RANGE (drives financial-year quick-filter buttons in the UI) ─────
router.get("/expenses/date-range", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [{ data: earliestRow }, { data: latestRow }] = await Promise.all([
    supabaseAdmin.from("expenses").select("expense_date").eq("tenant_id", req.tenantId!).order("expense_date", { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from("expenses").select("expense_date").eq("tenant_id", req.tenantId!).order("expense_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  res.json({
    earliest: (earliestRow as { expense_date?: string } | null)?.expense_date || null,
    latest: (latestRow as { expense_date?: string } | null)?.expense_date || null,
  });
});

// ─── CREATE (manual entry) ──────────────────────────────────────────────────
router.post("/expenses", ...canManage, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { expense_date, description, amount, category, vat_reclaimable, vat_amount, notes, receipt_file_id } = req.body || {};
  if (!expense_date || !description || amount == null) {
    res.status(400).json({ error: "expense_date, description and amount are required" });
    return;
  }

  const numericAmount = Math.abs(Number(amount));
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const dedupeHash = buildDedupeHash(req.tenantId!, String(expense_date), String(description), numericAmount);

  const { data, error } = await supabaseAdmin
    .from("expenses")
    .insert({
      tenant_id: req.tenantId,
      expense_date,
      description: String(description).trim(),
      amount: numericAmount,
      category: category || null,
      vat_reclaimable: !!vat_reclaimable,
      vat_amount: vat_amount != null ? Math.abs(Number(vat_amount)) : null,
      notes: notes || null,
      receipt_file_id: receipt_file_id || null,
      source: "manual",
      dedupe_hash: dedupeHash,
      created_by: req.userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { res.status(409).json({ error: "An identical expense already exists (same date, description and amount)." }); return; }
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
});

// ─── BULK CATEGORIZE (match by description text, e.g. "Screwfix") ─────────
router.post("/expenses/bulk-categorize", ...canManage, async (req: AuthenticatedRequest, res): Promise<void> => {
  const q = typeof req.body?.q === "string" ? req.body.q.trim() : "";
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
  const from = typeof req.body?.from === "string" ? req.body.from : undefined;
  const to = typeof req.body?.to === "string" ? req.body.to : undefined;
  const dryRun = !!req.body?.dry_run;

  if (!q) { res.status(400).json({ error: "A search term is required to bulk categorize (to avoid accidentally recategorizing everything)." }); return; }
  if (!dryRun && !category) { res.status(400).json({ error: "category is required" }); return; }

  if (dryRun) {
    let countQuery = supabaseAdmin
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", req.tenantId!)
      .ilike("description", `%${q}%`);
    if (from) countQuery = countQuery.gte("expense_date", from);
    if (to) countQuery = countQuery.lte("expense_date", to);
    const { count, error } = await countQuery;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ matched: count || 0 });
    return;
  }

  let updateQuery = supabaseAdmin
    .from("expenses")
    .update({ category, updated_at: new Date().toISOString() })
    .eq("tenant_id", req.tenantId!)
    .ilike("description", `%${q}%`);
  if (from) updateQuery = updateQuery.gte("expense_date", from);
  if (to) updateQuery = updateQuery.lte("expense_date", to);

  const { data, error } = await updateQuery.select("id");
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ updated: (data || []).length });
});

// ─── UPDATE ─────────────────────────────────────────────────────────────────
router.patch("/expenses/:id", ...canManage, async (req: AuthenticatedRequest, res): Promise<void> => {
  const patch: Record<string, unknown> = {};
  for (const key of ["expense_date", "description", "category", "notes", "receipt_file_id"] as const) {
    if (key in (req.body || {})) patch[key] = req.body[key];
  }
  if ("amount" in (req.body || {})) patch.amount = Math.abs(Number(req.body.amount));
  if ("vat_reclaimable" in (req.body || {})) patch.vat_reclaimable = !!req.body.vat_reclaimable;
  if ("vat_amount" in (req.body || {})) patch.vat_amount = req.body.vat_amount != null ? Math.abs(Number(req.body.vat_amount)) : null;
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("expenses")
    .update(patch)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) { res.status(error.code === "PGRST116" ? 404 : 500).json({ error: error.message }); return; }
  res.json(data);
});

// ─── DELETE ─────────────────────────────────────────────────────────────────
router.delete("/expenses/:id", ...canManage, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("expenses")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId!);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

// ─── IMPORT PREVIEW (CSV column mapping step) ───────────────────────────────
router.post("/expenses/import-preview", ...canManage, upload.single("file"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const isCsv = /\.csv$/i.test(file.originalname) || file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";
  if (!isCsv) {
    res.status(400).json({ error: "Column mapping is only available for CSV files." });
    return;
  }

  try {
    const preview = previewExpenseCsv(file.buffer.toString("utf-8"));
    res.json(preview);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// ─── IMPORT (bank statement CSV or PDF) ─────────────────────────────────────
router.post("/expenses/import", ...canManage, upload.single("file"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const isCsv = /\.csv$/i.test(file.originalname) || file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";
  const isPdf = /\.pdf$/i.test(file.originalname) || file.mimetype === "application/pdf";

  if (!isCsv && !isPdf) {
    res.status(400).json({
      error: "Unsupported file type. Please upload a CSV or PDF bank statement.",
    });
    return;
  }

  let mapping: ExpenseCsvColumnMapping | undefined;
  if (isCsv && typeof req.body?.mapping === "string") {
    try {
      mapping = JSON.parse(req.body.mapping) as ExpenseCsvColumnMapping;
    } catch {
      res.status(400).json({ error: "Invalid column mapping." });
      return;
    }
  }

  let parsed;
  try {
    if (isCsv) {
      parsed = parseExpenseCsv(file.buffer.toString("utf-8"), req.tenantId!, mapping);
    } else {
      const pdf = new PDFParse({ data: file.buffer });
      const { text } = await pdf.getText();
      await pdf.destroy();
      parsed = parseExpensePdfText(text, req.tenantId!);
    }
  } catch (e) {
    res.status(400).json({ error: isPdf ? `Could not read this PDF: ${(e as Error).message}` : (e as Error).message });
    return;
  }

  if (parsed.rows.length === 0) {
    res.status(400).json({
      error: isPdf
        ? "No expense (money-out) transactions were found in this PDF. Statement layouts vary between banks — if this keeps happening, let us know so we can improve detection for your bank's format."
        : "No expense (money-out) rows were found in this file.",
      skipped_credits: parsed.skippedCredits,
      skipped_unparseable: parsed.skippedUnparseable,
    });
    return;
  }

  const importBatchId = randomUUID();
  const insertRows = parsed.rows.map((r) => ({
    tenant_id: req.tenantId,
    expense_date: r.date,
    description: r.description,
    amount: r.amount,
    category: r.category,
    source: "import",
    import_batch_id: importBatchId,
    import_filename: file.originalname,
    dedupe_hash: r.dedupeHash,
    created_by: req.userId,
  }));

  // Dedupe against rows already imported/entered for this tenant, and upsert
  // ignoring conflicts so re-uploading an overlapping statement is a no-op.
  const { data: inserted, error } = await supabaseAdmin
    .from("expenses")
    .upsert(insertRows, { onConflict: "tenant_id,dedupe_hash", ignoreDuplicates: true })
    .select("id");

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    imported: (inserted || []).length,
    skipped_duplicates: insertRows.length - (inserted || []).length,
    skipped_credits: parsed.skippedCredits,
    skipped_unparseable: parsed.skippedUnparseable,
    import_batch_id: importBatchId,
  });
});

// ─── EXPORT (CSV, for accountant / tax year) ────────────────────────────────
router.get("/expenses/export", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  let q = supabaseAdmin
    .from("expenses")
    .select("expense_date, description, amount, currency, category, vat_reclaimable, vat_amount, notes, source")
    .eq("tenant_id", req.tenantId!)
    .order("expense_date", { ascending: true });
  if (from) q = q.gte("expense_date", from);
  if (to) q = q.lte("expense_date", to);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const escapeCsv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Date", "Description", "Amount", "Currency", "Category", "VAT Reclaimable", "VAT Amount", "Notes", "Source"];
  const lines = [header.join(",")];
  for (const row of (data || []) as Array<Record<string, unknown>>) {
    lines.push([
      row.expense_date, row.description, row.amount, row.currency, row.category || "",
      row.vat_reclaimable ? "Yes" : "No", row.vat_amount ?? "", row.notes || "", row.source,
    ].map(escapeCsv).join(","));
  }

  const filename = `expenses${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
});

export default router;
