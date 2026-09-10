import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { parseExpenseCsv, buildDedupeHash } from "../lib/expenses-import";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

  let totalsQuery = supabaseAdmin.from("expenses").select("amount, vat_amount").eq("tenant_id", req.tenantId!);
  if (from) totalsQuery = totalsQuery.gte("expense_date", from);
  if (to) totalsQuery = totalsQuery.lte("expense_date", to);
  const { data: totalsRows } = await totalsQuery;
  const totalAmount = (totalsRows || []).reduce((sum, r: Record<string, unknown>) => sum + Number(r.amount || 0), 0);
  const totalVat = (totalsRows || []).reduce((sum, r: Record<string, unknown>) => sum + Number(r.vat_amount || 0), 0);

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

// ─── IMPORT (bank statement CSV) ────────────────────────────────────────────
router.post("/expenses/import", ...canManage, upload.single("file"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No CSV file uploaded" }); return; }

  let parsed;
  try {
    parsed = parseExpenseCsv(file.buffer.toString("utf-8"), req.tenantId!);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  if (parsed.rows.length === 0) {
    res.status(400).json({ error: "No expense (money-out) rows were found in this file.", skipped_credits: parsed.skippedCredits, skipped_unparseable: parsed.skippedUnparseable });
    return;
  }

  const importBatchId = randomUUID();
  const insertRows = parsed.rows.map((r) => ({
    tenant_id: req.tenantId,
    expense_date: r.date,
    description: r.description,
    amount: r.amount,
    category: null,
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
