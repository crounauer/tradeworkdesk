import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Receipt, Upload, Plus, Trash2, Loader2, Download, Paperclip, Eye, ChevronLeft, ChevronRight, Pencil, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useListExpenses, useExpenseCategories, useExpenseDateRange, useCreateExpense, useUpdateExpense,
  useDeleteExpense, useImportExpensesCsv, usePreviewExpensesCsv, type Expense, type ExpenseCsvColumnMapping,
} from "@/hooks/use-expenses";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/use-company-settings";
import { customFetch } from "@workspace/api-client-react";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MAPPING_FIELD_DEFS: { key: keyof ExpenseCsvColumnMapping; label: string; required?: boolean }[] = [
  { key: "date", label: "Date", required: true },
  { key: "description", label: "Description", required: true },
  { key: "amount", label: "Amount (single signed column)" },
  { key: "debit", label: "Debit / Money out" },
  { key: "credit", label: "Credit / Money in" },
  { key: "balance", label: "Running balance" },
  { key: "reference", label: "Reference / Transaction ID" },
  { key: "name", label: "Counterparty / Payee name" },
  { key: "category", label: "Category" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Which financial year (identified by its start calendar year) a date falls into.
function fyStartYearForDate(date: Date, month: number, day: number): number {
  const y = date.getFullYear();
  const fyStart = new Date(y, month - 1, day);
  return date >= fyStart ? y : y - 1;
}

function financialYearRange(startYear: number, month: number, day: number): { from: string; to: string; label: string } {
  const from = new Date(startYear, month - 1, day);
  const to = new Date(startYear + 1, month - 1, day);
  to.setDate(to.getDate() - 1);
  return { from: isoDate(from), to: isoDate(to), label: `${startYear}/${String(startYear + 1).slice(2)}` };
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default function Expenses() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptTargetId, setReceiptTargetId] = useState<string | null>(null);

  const { data: settings } = useCompanySettings();
  const updateSettingsMut = useUpdateCompanySettings();
  const { data: dateRangeData } = useExpenseDateRange();
  const fyMonth = settings?.financial_year_start_month ?? 4;
  const fyDay = settings?.financial_year_start_day ?? 6;

  const currentFY = useMemo(() => {
    const startYear = fyStartYearForDate(new Date(), fyMonth, fyDay);
    return financialYearRange(startYear, fyMonth, fyDay);
  }, [fyMonth, fyDay]);

  const fyOptions = useMemo(() => {
    const now = new Date();
    const latestRelevantDate = dateRangeData?.latest ? new Date(dateRangeData.latest) : now;
    const earliestRelevantDate = dateRangeData?.earliest ? new Date(dateRangeData.earliest) : now;
    const latestStartYear = Math.max(fyStartYearForDate(now, fyMonth, fyDay), fyStartYearForDate(latestRelevantDate, fyMonth, fyDay));
    const earliestStartYear = fyStartYearForDate(earliestRelevantDate, fyMonth, fyDay);
    const years: number[] = [];
    for (let y = latestStartYear; y >= earliestStartYear; y--) years.push(y);
    return years.map((y) => financialYearRange(y, fyMonth, fyDay));
  }, [dateRangeData, fyMonth, fyDay]);

  const [dateFrom, setDateFrom] = useState(currentFY.from);
  const [dateTo, setDateTo] = useState(currentFY.to);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [fySettingsOpen, setFySettingsOpen] = useState(false);
  const [fySettingsMonth, setFySettingsMonth] = useState(fyMonth);
  const [fySettingsDay, setFySettingsDay] = useState(fyDay);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null);
  const [csvMappingOpen, setCsvMappingOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvSampleRows, setCsvSampleRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<ExpenseCsvColumnMapping | null>(null);

  const filters = { from: dateFrom, to: dateTo, category: category || undefined, q: search || undefined, page };
  const { data, isLoading } = useListExpenses(filters);
  const { data: categoriesData } = useExpenseCategories();
  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const deleteMut = useDeleteExpense();
  const importMut = useImportExpensesCsv();
  const previewMut = usePreviewExpensesCsv();

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    description: "", amount: "", category: "", vat_reclaimable: false, vat_amount: "", notes: "",
  });

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|pdf)$/i.test(file.name)) {
      toast({
        title: "Unsupported file",
        description: "Please upload a CSV or PDF bank statement.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (/\.pdf$/i.test(file.name)) {
      try {
        const result = await importMut.mutateAsync({ file });
        toast({
          title: "Import complete",
          description: `Imported ${result.imported} expense${result.imported === 1 ? "" : "s"}. Skipped ${result.skipped_duplicates} duplicate(s), ${result.skipped_credits} incoming payment(s).`,
        });
      } catch (err) {
        toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }

    // CSV: preview the columns first so the user can confirm/correct the mapping
    // before anything is imported — bank export formats vary too much to trust blindly.
    try {
      const preview = await previewMut.mutateAsync(file);
      setPendingCsvFile(file);
      setCsvHeaders(preview.headers);
      setCsvSampleRows(preview.sampleRows);
      setCsvMapping(preview.guessedMapping);
      setCsvMappingOpen(true);
    } catch (err) {
      toast({ title: "Could not read file", description: (err as Error).message, variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleConfirmCsvImport() {
    if (!pendingCsvFile || !csvMapping) return;
    if (csvMapping.date === -1 || csvMapping.description === -1 || (csvMapping.amount === -1 && csvMapping.debit === -1)) {
      toast({ title: "Mapping incomplete", description: "Please map Date, Description, and either Amount or Debit.", variant: "destructive" });
      return;
    }
    try {
      const result = await importMut.mutateAsync({ file: pendingCsvFile, mapping: csvMapping });
      toast({
        title: "Import complete",
        description: `Imported ${result.imported} expense${result.imported === 1 ? "" : "s"}. Skipped ${result.skipped_duplicates} duplicate(s), ${result.skipped_credits} incoming payment(s).`,
      });
      setCsvMappingOpen(false);
      setPendingCsvFile(null);
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveFySettings() {
    try {
      await updateSettingsMut.mutateAsync({
        financial_year_start_month: fySettingsMonth,
        financial_year_start_day: fySettingsDay,
      });
      const startYear = fyStartYearForDate(new Date(), fySettingsMonth, fySettingsDay);
      const newRange = financialYearRange(startYear, fySettingsMonth, fySettingsDay);
      setDateFrom(newRange.from);
      setDateTo(newRange.to);
      setPage(1);
      setFySettingsOpen(false);
      toast({ title: "Financial year updated" });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function handleAddExpense() {
    if (!form.description.trim() || !form.amount) {
      toast({ title: "Missing details", description: "Description and amount are required", variant: "destructive" });
      return;
    }
    try {
      await createMut.mutateAsync({
        expense_date: form.expense_date,
        description: form.description.trim(),
        amount: Number(form.amount),
        category: form.category || null,
        vat_reclaimable: form.vat_reclaimable,
        vat_amount: form.vat_amount ? Number(form.vat_amount) : null,
        notes: form.notes || null,
      });
      toast({ title: "Expense added" });
      setAddOpen(false);
      setForm({ expense_date: new Date().toISOString().slice(0, 10), description: "", amount: "", category: "", vat_reclaimable: false, vat_amount: "", notes: "" });
    } catch (err) {
      toast({ title: "Failed to add expense", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: "Expense deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  function startEditDescription(expense: Expense) {
    setEditingDescriptionId(expense.id);
    setDescriptionDraft(expense.description);
  }

  function saveDescription(expense: Expense) {
    const trimmed = descriptionDraft.trim();
    setEditingDescriptionId(null);
    if (!trimmed || trimmed === expense.description) return;
    updateMut.mutate(
      { id: expense.id, patch: { description: trimmed } },
      { onError: (err) => toast({ title: "Failed to update description", description: (err as Error).message, variant: "destructive" }) },
    );
  }

  function openReceiptPicker(expenseId: string) {
    setReceiptTargetId(expenseId);
    receiptInputRef.current?.click();
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const expenseId = receiptTargetId;
    if (!file || !expenseId) return;
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity_type", "expense");
      formData.append("entity_id", expenseId);
      const uploaded = await customFetch(`${import.meta.env.BASE_URL}api/files/upload`, { method: "POST", body: formData }) as { id: string };
      await updateMut.mutateAsync({ id: expenseId, patch: { receipt_file_id: uploaded.id } });
      toast({ title: "Receipt attached" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploadingReceipt(false);
      setReceiptTargetId(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  }

  function handleExport() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    window.open(`${import.meta.env.BASE_URL}api/expenses/export?${params}`, "_blank");
  }

  async function handleViewReceipt(fileId: string) {
    setViewingReceiptId(fileId);
    try {
      const result = await customFetch(`${import.meta.env.BASE_URL}api/files/${fileId}/url`) as { url: string };
      window.open(result.url, "_blank");
    } catch (err) {
      toast({ title: "Could not open receipt", description: (err as Error).message, variant: "destructive" });
    } finally {
      setViewingReceiptId(null);
    }
  }

  const items = data?.items ?? [];
  const categories = categoriesData?.categories ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1;

  return (
    <div className="space-y-6 animate-in fade-in p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6" /> Expenses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track outgoings and import bank statements ready for end-of-year accounting.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.pdf" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="icon" onClick={() => { setFySettingsMonth(fyMonth); setFySettingsDay(fyDay); setFySettingsOpen(true); }} title="Financial year settings">
            <Settings2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMut.isPending || previewMut.isPending}>
            {(importMut.isPending || previewMut.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import Bank Statement
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {fyOptions.map((opt) => {
          const isActive = dateFrom === opt.from && dateTo === opt.to;
          return (
            <Button
              key={opt.from}
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={() => { setDateFrom(opt.from); setDateTo(opt.to); setPage(1); }}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>

      <input ref={receiptInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleReceiptUpload} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 border border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total expenses ({currentFY.label})</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data?.totals.amount ?? 0)}</p>
        </Card>
        <Card className="p-4 border border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Reclaimable VAT</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data?.totals.vat_amount ?? 0)}</p>
        </Card>
      </div>

      <Card className="p-4 border border-border/50 flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[160px]">
          <Label className="text-xs">Search</Label>
          <Input placeholder="Search description..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button variant="ghost" onClick={() => { setDateFrom(currentFY.from); setDateTo(currentFY.to); setCategory(""); setSearch(""); setPage(1); }}>
          Reset to {currentFY.label}
        </Button>
      </Card>

      {isLoading ? (
        <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No expenses found for this period.</Card>
      ) : (
        <div className="space-y-2">
          {items.map((expense) => (
            <Card key={expense.id} className="p-4 border border-border/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingDescriptionId === expense.id ? (
                      <Input
                        autoFocus
                        className="h-7 text-sm max-w-xs"
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        onBlur={() => saveDescription(expense)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDescription(expense);
                          if (e.key === "Escape") setEditingDescriptionId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="font-medium text-sm inline-flex items-center gap-1 hover:underline"
                        onClick={() => startEditDescription(expense)}
                      >
                        {expense.description}
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                    {expense.source === "import" && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Imported</span>
                    )}
                    {expense.receipt_file_id && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> Receipt
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{new Date(expense.expense_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {expense.vat_reclaimable && <span>VAT: {formatCurrency(expense.vat_amount || 0)}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={expense.category || "none"}
                    onValueChange={(v) => updateMut.mutate({ id: expense.id, patch: { category: v === "none" ? null : v } })}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorised</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <span className="font-semibold text-sm w-24 text-right">{formatCurrency(expense.amount, expense.currency)}</span>

                  {expense.receipt_file_id && (
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleViewReceipt(expense.receipt_file_id!)} disabled={viewingReceiptId === expense.receipt_file_id}>
                      {viewingReceiptId === expense.receipt_file_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openReceiptPicker(expense.id)} disabled={uploadingReceipt}>
                    <Paperclip className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => handleDelete(expense.id)} disabled={deleteMut.isPending}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Amount (£)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Screwfix - fittings" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category || "none"} onValueChange={(v) => setForm((f) => ({ ...f, category: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.vat_reclaimable} onCheckedChange={(v) => setForm((f) => ({ ...f, vat_reclaimable: !!v }))} />
              <Label className="!mt-0">VAT reclaimable</Label>
              {form.vat_reclaimable && (
                <Input type="number" step="0.01" className="w-32 ml-2" placeholder="VAT amount" value={form.vat_amount} onChange={(e) => setForm((f) => ({ ...f, vat_amount: e.target.value }))} />
              )}
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddExpense} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fySettingsOpen} onOpenChange={setFySettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Financial Year Settings</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Set when your financial year starts. This controls the year presets and totals shown above.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start month</Label>
                <Select value={String(fySettingsMonth)} onValueChange={(v) => setFySettingsMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Start day</Label>
                <Input type="number" min={1} max={31} value={fySettingsDay} onChange={(e) => setFySettingsDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Default is 6 April, matching the UK tax year. Change this if your business uses a different financial year (e.g. 1 January).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFySettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFySettings} disabled={updateSettingsMut.isPending}>
              {updateSettingsMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={csvMappingOpen} onOpenChange={(open) => { setCsvMappingOpen(open); if (!open) { setPendingCsvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Confirm Column Mapping</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We've guessed which columns to use from your file's headers. Bank export formats vary, so please check these are correct before importing.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {MAPPING_FIELD_DEFS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{field.label}{field.required && " *"}</Label>
                  <Select
                    value={String(csvMapping?.[field.key] ?? -1)}
                    onValueChange={(v) => setCsvMapping((prev) => prev ? { ...prev, [field.key]: Number(v) } : prev)}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">Not in file</SelectItem>
                      {csvHeaders.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {csvSampleRows.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Preview (first {csvSampleRows.length} rows)</Label>
                <div className="overflow-x-auto border border-border/50 rounded-md">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-muted/40">
                        {csvHeaders.map((h, i) => <th key={i} className="px-2 py-1 text-left font-medium whitespace-nowrap">{h || `Column ${i + 1}`}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {csvSampleRows.map((row, ri) => (
                        <tr key={ri} className="border-t border-border/30">
                          {row.map((cell, ci) => <td key={ci} className="px-2 py-1 whitespace-nowrap max-w-[160px] truncate">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvMappingOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmCsvImport} disabled={importMut.isPending}>
              {importMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
