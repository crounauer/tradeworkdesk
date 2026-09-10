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
import { Receipt, Upload, Plus, Trash2, Loader2, Download, Paperclip, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useListExpenses, useExpenseCategories, useCreateExpense, useUpdateExpense,
  useDeleteExpense, useImportExpensesCsv, type Expense,
} from "@/hooks/use-expenses";
import { customFetch } from "@workspace/api-client-react";

// UK tax year runs 6 Apr → 5 Apr.
function currentTaxYearRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getMonth() > 2 || (now.getMonth() === 2 && now.getDate() >= 6) ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-04-06`, to: `${year + 1}-04-05`, label: `${year}/${String(year + 1).slice(2)} tax year` };
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default function Expenses() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptTargetId, setReceiptTargetId] = useState<string | null>(null);

  const taxYear = useMemo(() => currentTaxYearRange(), []);
  const [dateFrom, setDateFrom] = useState(taxYear.from);
  const [dateTo, setDateTo] = useState(taxYear.to);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);

  const filters = { from: dateFrom, to: dateTo, category: category || undefined, q: search || undefined, page };
  const { data, isLoading } = useListExpenses(filters);
  const { data: categoriesData } = useExpenseCategories();
  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const deleteMut = useDeleteExpense();
  const importMut = useImportExpensesCsv();

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    description: "", amount: "", category: "", vat_reclaimable: false, vat_amount: "", notes: "",
  });

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importMut.mutateAsync(file);
      toast({
        title: "Import complete",
        description: `Imported ${result.imported} expense${result.imported === 1 ? "" : "s"}. Skipped ${result.skipped_duplicates} duplicate(s), ${result.skipped_credits} incoming payment(s).`,
      });
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMut.isPending}>
            {importMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
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

      <input ref={receiptInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleReceiptUpload} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 border border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total expenses ({taxYear.label})</p>
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
        <Button variant="ghost" onClick={() => { setDateFrom(taxYear.from); setDateTo(taxYear.to); setCategory(""); setSearch(""); setPage(1); }}>
          Reset to {taxYear.label}
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
                    <span className="font-medium text-sm">{expense.description}</span>
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
    </div>
  );
}
