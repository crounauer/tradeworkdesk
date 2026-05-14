import { useState, useEffect, useRef, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useParams, useLocation, useSearch } from "wouter";
import {
  ArrowLeft, Send, CheckCircle2, XCircle, RefreshCcw, Download, Trash2,
  Loader2, Plus, Minus, Receipt, AlertTriangle, FileText, CreditCard,
  Edit3, Save, X, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  useGetInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useSendInvoice,
  useMarkInvoiceSent,
  useUnsendInvoice,
  useMarkInvoicePaid,
  useAcceptQuote,
  useDeclineQuote,
  useConvertToInvoice,
  type InvoiceLineItem,
  type InvoiceStatus,
} from "@/hooks/use-invoices";

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-700" },
  sent:      { label: "Sent",      className: "bg-blue-100 text-blue-700" },
  paid:      { label: "Paid",      className: "bg-green-100 text-green-700" },
  overdue:   { label: "Overdue",   className: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", className: "bg-gray-50 text-gray-400" },
  accepted:  { label: "Accepted",  className: "bg-teal-100 text-teal-700" },
  declined:  { label: "Declined",  className: "bg-red-50 text-red-500" },
  converted: { label: "Converted", className: "bg-purple-100 text-purple-700" },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-sm font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function formatCurrency(amount: number | string | null | undefined, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount) || 0);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Empty line item ──────────────────────────────────────────────────────

function emptyLine(): InvoiceLineItem {
  return { description: "", quantity: 1, unit_price: 0, item_type: "other" };
}

// ─── Main component ───────────────────────────────────────────────────────

export default function InvoiceDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { data: settings } = useCompanySettings();

  const isNew = params.id === "new";
  const searchParams = new URLSearchParams(searchString);
  const newType = (searchParams.get("type") || "invoice") as "invoice" | "quote";
  const prefillJobId = searchParams.get("job_id") || "";

  const { data: invoice, isLoading } = useGetInvoice(isNew ? "" : params.id);

  // ── "New" mode: redirect to jobs to pick a job first ──────────────────
  if (isNew) {
    return <NewInvoiceRedirect type={newType} prefillJobId={prefillJobId} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p>Invoice not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <InvoiceDetailContent
      invoice={invoice}
      currency={invoice.currency || settings?.currency || "GBP"}
      navigate={navigate}
      toast={toast}
      settings={settings}
    />
  );
}

// ─── New invoice redirect page ─────────────────────────────────────────────

function NewInvoiceRedirect({ type, prefillJobId }: { type: string; prefillJobId: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: settings } = useCompanySettings();

  const [jobId, setJobId] = useState(prefillJobId);
  const [submitting, setSubmitting] = useState(false);

  // If we have a job_id already, create immediately
  useEffect(() => {
    if (prefillJobId) {
      handleCreate(prefillJobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(jid: string) {
    if (!jid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jid, type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create");
      }
      const inv = await res.json();
      navigate(`/invoices/${inv.id}`, { replace: true });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setSubmitting(false);
    }
  }

  if (prefillJobId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/invoices")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">
          New {type === "quote" ? "Quote" : "Invoice"}
        </h1>
      </div>
      <Card className="p-6 space-y-4">
        <div>
          <Label htmlFor="job_id">Job ID</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Every {type} must be linked to a job. Enter the job ID or go to the job and click
            "Create {type === "quote" ? "Quote" : "Invoice"}" there.
          </p>
          <Input
            id="job_id"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Paste a job ID..."
          />
        </div>
        <Button
          className="w-full"
          disabled={!jobId || submitting}
          onClick={() => handleCreate(jobId)}
        >
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create {type === "quote" ? "Quote" : "Invoice"}
        </Button>
      </Card>
    </div>
  );
}

// ─── Detail / Edit ─────────────────────────────────────────────────────────

interface DetailProps {
  invoice: ReturnType<typeof useGetInvoice>["data"] & {};
  currency: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  toast: ReturnType<typeof useToast>["toast"];
  settings?: ReturnType<typeof useCompanySettings>["data"];
}

function InvoiceDetailContent({ invoice, currency, navigate, toast, settings }: DetailProps) {
  const id = invoice.id;
  const isDraft = invoice.status === "draft";
  const isInvoice = invoice.type === "invoice";

  const [editing, setEditing] = useState(isDraft);
  const [lines, setLines] = useState<InvoiceLineItem[]>(
    invoice.line_items && invoice.line_items.length > 0
      ? invoice.line_items.map((l) => ({ ...l }))
      : [emptyLine()]
  );
  const [worksOrder, setWorksOrder] = useState(invoice.works_order || "");
  const [vatRate, setVatRate] = useState(String(invoice.vat_rate ?? 0));
  const [issueDate, setIssueDate] = useState(invoice.issue_date || "");
  const [dueDate, setDueDate] = useState(invoice.due_date || "");

  // Apply company setting defaults to draft invoices when settings load
  useEffect(() => {
    if (!isDraft || !settings) return;
    if (!invoice.vat_rate && settings.default_vat_rate != null) {
      setVatRate(String(settings.default_vat_rate));
    }
    if (!invoice.due_date && isInvoice && settings.default_payment_terms_days) {
      const base = invoice.issue_date ? new Date(invoice.issue_date) : new Date();
      base.setDate(base.getDate() + settings.default_payment_terms_days);
      setDueDate(base.toISOString().slice(0, 10));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);
  const [expiryDate, setExpiryDate] = useState(invoice.expiry_date || "");
  const [notes, setNotes] = useState(invoice.notes || "");
  const [customerNotes, setCustomerNotes] = useState(invoice.customer_notes || "");

  // Dialogs
  const [sendOpen, setSendOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(invoice.customer?.email || "");

  // Catalogue search state
  type CatalogueItem = { id: string; name: string; default_price: number | null; type: "service" | "product" };
  const [catalogueSuggestions, setCatalogueSuggestions] = useState<CatalogueItem[]>([]);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const catSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catAbortRef = useRef<AbortController | null>(null);
  const catSeqRef = useRef(0);

  // Add-to-catalogue dialog state
  const [catAddOpen, setCatAddOpen] = useState(false);
  const [catAddType, setCatAddType] = useState<"product" | "service">("service");
  const [catAddLineIdx, setCatAddLineIdx] = useState<number | null>(null);
  const [catAddName, setCatAddName] = useState("");
  const [catAddPrice, setCatAddPrice] = useState("");
  const [catAddSaving, setCatAddSaving] = useState(false);

  // Callout rates (for labour charge dialog)
  type CalloutRate = { id: string; name: string; amount: number; hourly_rate: number | null; is_default?: boolean };
  const [calloutRates, setCalloutRates] = useState<CalloutRate[]>([]);
  useEffect(() => {
    customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`)
      .then(d => {
        if (Array.isArray(d)) {
          const rates = d as CalloutRate[];
          setCalloutRates(rates);
          const def = rates.find(r => r.is_default) || rates[0];
          if (def) setLabourRateId(def.id);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Labour charge dialog state
  const [labourOpen, setLabourOpen] = useState(false);
  const [labourRateId, setLabourRateId] = useState<string>("");
  const [labourHours, setLabourHours] = useState("1");
  const [labourMins, setLabourMins] = useState("0");
  const [labourIncludeCallout, setLabourIncludeCallout] = useState(true);

  function addLabourCharge() {
    const rate = calloutRates.find(r => r.id === labourRateId);
    if (!rate) return;
    const totalHrs = (parseInt(labourHours) || 0) + (parseInt(labourMins) || 0) / 60;
    if (totalHrs <= 0) return;
    const newItems: InvoiceLineItem[] = [];
    if (labourIncludeCallout && rate.amount > 0) {
      newItems.push({
        description: `${rate.name} – Call-out (first hour)`,
        quantity: 1,
        unit_price: rate.amount,
        item_type: "callout",
      });
      const afterHrs = Math.max(0, totalHrs - 1);
      if (afterHrs > 0 && rate.hourly_rate != null && rate.hourly_rate > 0) {
        newItems.push({
          description: `${rate.name} – Labour (after first hour)`,
          quantity: Math.round(afterHrs * 100) / 100,
          unit_price: rate.hourly_rate,
          item_type: "labour",
        });
      }
    } else if (rate.hourly_rate != null && rate.hourly_rate > 0) {
      newItems.push({
        description: `${rate.name} – Labour`,
        quantity: Math.round(totalHrs * 100) / 100,
        unit_price: rate.hourly_rate,
        item_type: "labour",
      });
    }
    if (newItems.length > 0) {
      setLines(prev => {
        // Remove trailing blank empty line if present, then append new items
        const trimmed = prev.filter(l => l.description.trim() || Number(l.unit_price) !== 0);
        return [...trimmed, ...newItems, emptyLine()];
      });
    }
    setLabourOpen(false);
  }

  const searchCatalogue = useCallback((query: string, idx: number) => {
    if (catSearchTimeout.current) clearTimeout(catSearchTimeout.current);
    if (catAbortRef.current) catAbortRef.current.abort();
    if (!query.trim()) { setCatalogueSuggestions([]); setActiveLineIdx(null); return; }
    catSearchTimeout.current = setTimeout(async () => {
      const seq = ++catSeqRef.current;
      const ctrl = new AbortController();
      catAbortRef.current = ctrl;
      try {
        const [svcs, prods] = await Promise.all([
          customFetch(`${import.meta.env.BASE_URL}api/services/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
            .then(d => (Array.isArray(d) ? d : []).map((s: { id: string; name: string; default_price: number | null }) => ({ ...s, type: "service" as const }))),
          customFetch(`${import.meta.env.BASE_URL}api/admin/products`, { signal: ctrl.signal })
            .then(d => (Array.isArray(d) ? d : [])
              .filter((p: { name: string }) => p.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 10)
              .map((p: { id: string; name: string; default_price: number | null }) => ({ ...p, type: "product" as const }))
            ).catch(() => [] as CatalogueItem[]),
        ]);
        if (seq !== catSeqRef.current) return;
        setCatalogueSuggestions([...svcs, ...prods].slice(0, 12));
        setActiveLineIdx(idx);
      } catch {
        if (seq !== catSeqRef.current) return;
        setCatalogueSuggestions([]);
      }
    }, 200);
  }, []);

  const selectCatalogueItem = (item: CatalogueItem, idx: number) => {
    updateLine(idx, "description", item.name);
    if (item.default_price != null) updateLine(idx, "unit_price", item.default_price);
    updateLine(idx, "item_type", item.type === "product" ? "product" : "service");
    setCatalogueSuggestions([]);
    setActiveLineIdx(null);
  };

  function openAddToCatalogue(type: "product" | "service", idx: number) {
    setCatAddType(type);
    setCatAddLineIdx(idx);
    setCatAddName(lines[idx].description.trim());
    setCatAddPrice(lines[idx].unit_price ? String(lines[idx].unit_price) : "");
    setCatAddOpen(true);
    setCatalogueSuggestions([]);
    setActiveLineIdx(null);
  }

  async function handleConfirmAddToCatalogue() {
    if (!catAddName.trim()) return;
    setCatAddSaving(true);
    try {
      const endpoint = catAddType === "service"
        ? `${import.meta.env.BASE_URL}api/admin/service-catalogue`
        : `${import.meta.env.BASE_URL}api/admin/products`;
      const result = await customFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catAddName.trim(),
          default_price: catAddPrice ? Number(catAddPrice) : undefined,
        }),
      }) as { id: string; name: string; default_price: number | null };
      if (catAddLineIdx !== null) {
        updateLine(catAddLineIdx, "description", result.name);
        if (result.default_price != null) updateLine(catAddLineIdx, "unit_price", result.default_price);
      }
      toast({ title: `Saved to ${catAddType} catalogue`, description: `"${result.name}" added successfully` });
      setCatAddOpen(false);
    } catch (e) {
      toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCatAddSaving(false);
    }
  }


  // Payment form
  const [paidAmount, setPaidAmount] = useState(String(invoice.total ?? ""));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const updateMut = useUpdateInvoice(id);
  const deleteMut = useDeleteInvoice();
  const sendMut = useSendInvoice(id);
  const markSentMut = useMarkInvoiceSent(id);
  const unsendMut = useUnsendInvoice(id);
  const paidMut = useMarkInvoicePaid(id);
  const acceptMut = useAcceptQuote(id);
  const declineMut = useDeclineQuote(id);
  const convertMut = useConvertToInvoice(id);

  // Live totals
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const vr = Number(invoice.vat_rate) || 0;
  const vatAmount = Math.round(subtotal * vr) / 100;
  const total = subtotal + vatAmount;

  function updateLine(idx: number, field: keyof InvoiceLineItem, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveChanges() {
    try {
      await updateMut.mutateAsync({
        line_items: lines,
        issue_date: issueDate,
        works_order: worksOrder,
        notes,
        customer_notes: customerNotes,
      });
      toast({ title: "Saved" });
      setEditing(false);
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleSend() {
    try {
      const result = await sendMut.mutateAsync({ override_email: sendEmail !== invoice.customer?.email ? sendEmail : undefined });
      toast({ title: `${isInvoice ? "Invoice" : "Quote"} sent`, description: `Sent to ${result.sent_to}` });
      setSendOpen(false);
    } catch (e) {
      toast({ title: "Send failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleMarkPaid() {
    try {
      await paidMut.mutateAsync({
        paid_amount: parseFloat(paidAmount) || Number(invoice.total),
        payment_date: paymentDate,
        payment_method: paymentMethod || undefined,
        payment_reference: paymentReference || undefined,
      });
      toast({ title: "Invoice marked as paid" });
      setPaidOpen(false);
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleAccept() {
    try {
      await acceptMut.mutateAsync();
      toast({ title: "Quote accepted" });
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleDecline() {
    try {
      await declineMut.mutateAsync();
      toast({ title: "Quote declined" });
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleConvert() {
    try {
      const newInv = await convertMut.mutateAsync();
      toast({ title: "Converted to invoice", description: `Invoice ${newInv.invoice_number} created` });
      navigate(`/invoices/${newInv.id}`);
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: "Deleted" });
      navigate("/invoices");
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      const blob = await customFetch<Blob>(`${import.meta.env.BASE_URL}api/invoices/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  }

  const customerName = invoice.customer
    ? `${invoice.customer.first_name} ${invoice.customer.last_name}`
    : "—";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/invoices")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono">{invoice.invoice_number}</h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {isInvoice ? "Invoice" : "Quote"} for {customerName}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isDraft && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit3 className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={saveChanges} disabled={updateMut.isPending}>
                {updateMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Actions bar — above main content */}
      {!editing && (
        <div className="flex flex-wrap gap-2 items-center">
          {["draft", "sent"].includes(invoice.status) && (
            <Button onClick={() => setSendOpen(true)} disabled={sendMut.isPending}>
              <Send className="w-4 h-4 mr-2" />
              {invoice.status === "sent" ? "Re-send" : `Send ${isInvoice ? "Invoice" : "Quote"}`}
            </Button>
          )}
          {isDraft && (
            <Button variant="outline" onClick={async () => {
              try {
                await markSentMut.mutateAsync();
                toast({ title: `${isInvoice ? "Invoice" : "Quote"} marked as sent` });
              } catch (e) {
                toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
              }
            }} disabled={markSentMut.isPending}>
              {markSentMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Mark as Sent
            </Button>
          )}
          {invoice.status === "sent" && (
            <Button variant="ghost" className="text-muted-foreground" onClick={async () => {
              try {
                await unsendMut.mutateAsync();
                toast({ title: `${isInvoice ? "Invoice" : "Quote"} reverted to draft` });
              } catch (e) {
                toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
              }
            }} disabled={unsendMut.isPending}>
              {unsendMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Unsend
            </Button>
          )}
          {isInvoice && ["sent", "overdue"].includes(invoice.status) && (
            <Button variant="outline" onClick={() => setPaidOpen(true)}>
              <CreditCard className="w-4 h-4 mr-2" /> Mark as Paid
            </Button>
          )}
          {!isInvoice && invoice.status === "sent" && (
            <>
              <Button variant="outline" onClick={handleAccept} disabled={acceptMut.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Accepted
              </Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDecline} disabled={declineMut.isPending}>
                <XCircle className="w-4 h-4 mr-2" /> Mark as Declined
              </Button>
            </>
          )}
          {!isInvoice && invoice.status === "accepted" && !invoice.converted_to_invoice_id && (
            <Button onClick={handleConvert} disabled={convertMut.isPending}>
              <RefreshCcw className="w-4 h-4 mr-2" /> Convert to Invoice
            </Button>
          )}
          {!isInvoice && invoice.status === "accepted" && (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDecline} disabled={declineMut.isPending}>
              <XCircle className="w-4 h-4 mr-2" /> Mark as Declined
            </Button>
          )}
          <Button variant="outline" onClick={downloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {downloadingPdf ? "Downloading..." : "Download PDF"}
          </Button>
          {!isInvoice && invoice.converted_to_invoice_id && (
            <Button variant="ghost" onClick={() => navigate(`/invoices/${invoice.converted_to_invoice_id}`)}>
              View Invoice →
            </Button>
          )}
          {!["paid", "converted"].includes(invoice.status) && (
            <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              {invoice.status === "draft" ? "Delete" : "Cancel / Void"}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* Main content */}
        <div className="space-y-4">
          {/* Dates */
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Issue Date</Label>
                {editing ? (
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 h-8 text-sm" />
                ) : (
                  <p className="text-sm mt-1">{formatDate(invoice.issue_date)}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  {isInvoice ? "Due Date" : "Expiry Date"}
                </Label>
                <p className="text-sm mt-1">
                  {isInvoice
                    ? (invoice.due_date
                        ? formatDate(invoice.due_date)
                        : (settings?.default_payment_terms_days != null && settings.default_payment_terms_days > 0)
                          ? `Net ${settings.default_payment_terms_days} days`
                          : "Due on Receipt")
                    : (invoice.expiry_date ? formatDate(invoice.expiry_date) : "—")}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">VAT Rate (%)</Label>
                <p className="text-sm mt-1">
                  {invoice.vat_rate != null && invoice.vat_rate > 0
                    ? `${invoice.vat_rate}%`
                    : settings?.default_vat_rate != null && settings.default_vat_rate > 0
                      ? `${settings.default_vat_rate}%`
                      : "0%"}
                </p>
              </div>
              <div className="col-span-2 md:col-span-3 border-t pt-4 mt-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="text-sm mt-1 font-medium">
                    <a
                      href={`/customers/${invoice.customer_id}`}
                      className="text-primary hover:underline"
                      onClick={(e) => { e.preventDefault(); navigate(`/customers/${invoice.customer_id}`); }}
                    >
                      {customerName}
                    </a>
                  </p>
                </div>
                {(invoice.customer?.phone || invoice.customer?.mobile) && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="text-sm mt-1">{invoice.customer.phone || invoice.customer.mobile}</p>
                  </div>
                )}
                {invoice.customer?.email && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm mt-1 break-all">{invoice.customer.email}</p>
                  </div>
                )}
                {invoice.customer?.address_line1 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <p className="text-sm mt-1">
                      {[invoice.customer.address_line1, invoice.customer.city, invoice.customer.postcode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
              </div>
              {invoice.job && (
                <div className="col-span-2 md:col-span-3">
                  <Label className="text-xs text-muted-foreground">Job</Label>
                  <p className="text-sm mt-1">
                    <a href={`/jobs/${invoice.job_id}`} className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); navigate(`/jobs/${invoice.job_id}`); }}>
                      View Job
                    </a>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Works Order */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" /> Works Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={worksOrder}
                  onChange={(e) => setWorksOrder(e.target.value)}
                  placeholder="Describe the work to be carried out…"
                  className="text-sm resize-none"
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {invoice.works_order || <span className="text-muted-foreground italic">No works order description</span>}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Header row */}
              <div className="hidden md:grid md:grid-cols-[1fr_80px_100px_90px_30px] gap-2 text-xs text-muted-foreground px-1">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit Price</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_80px_100px_90px_30px] gap-2 items-center">
                  {editing ? (
                    <>
                      <div className="relative">
                        <Input
                          value={line.description}
                          onChange={(e) => {
                            updateLine(idx, "description", e.target.value);
                            searchCatalogue(e.target.value, idx);
                          }}
                          onFocus={() => { if (catalogueSuggestions.length > 0) setActiveLineIdx(idx); }}
                          onBlur={() => setTimeout(() => { setCatalogueSuggestions([]); setActiveLineIdx(null); }, 150)}
                          placeholder="Description — type to search catalogue…"
                          className="h-8 text-sm"
                        />
                        {(line.item_type === "product" || line.item_type === "service" || line.item_type === "labour" || line.item_type === "callout") && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                            line.item_type === "product" ? "bg-purple-100 text-purple-700" :
                            line.item_type === "service" ? "bg-blue-100 text-blue-700" :
                            line.item_type === "labour" ? "bg-amber-100 text-amber-700" :
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {line.item_type === "product" ? "Product" :
                             line.item_type === "service" ? "Service" :
                             line.item_type === "labour" ? "Labour" : "Callout"}
                          </span>
                        )}
                        {activeLineIdx === idx && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {catalogueSuggestions.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-muted-foreground">No matches found</p>
                            ) : (
                              catalogueSuggestions.map((item) => (
                                <button
                                  key={`${item.type}-${item.id}`}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center gap-2"
                                  onMouseDown={(e) => { e.preventDefault(); selectCatalogueItem(item, idx); }}
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${item.type === "service" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                      {item.type === "service" ? "Service" : "Product"}
                                    </span>
                                    <span className="truncate">{item.name}</span>
                                  </span>
                                  {item.default_price != null && (
                                    <span className="text-muted-foreground shrink-0">{formatCurrency(item.default_price, currency)}</span>
                                  )}
                                </button>
                              ))
                            )}
                            {line.description.trim() && (
                              <div className="border-t px-3 py-2 flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Save as new:</span>
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                                  onMouseDown={(e) => { e.preventDefault(); openAddToCatalogue("service", idx); }}
                                >
                                  + Service
                                </button>
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
                                  onMouseDown={(e) => { e.preventDefault(); openAddToCatalogue("product", idx); }}
                                >
                                  + Product
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="Qty"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="Unit price"
                      />
                      <p className="text-sm text-right font-medium">
                        {formatCurrency(Number(line.quantity) * Number(line.unit_price), currency)}
                      </p>
                      <button onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-destructive">
                        <Minus className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm">{line.description || "—"}</p>
                        {(line.item_type === "product" || line.item_type === "service" || line.item_type === "labour" || line.item_type === "callout") && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                            line.item_type === "product" ? "bg-purple-100 text-purple-700" :
                            line.item_type === "service" ? "bg-blue-100 text-blue-700" :
                            line.item_type === "labour" ? "bg-amber-100 text-amber-700" :
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {line.item_type === "product" ? "Product" :
                             line.item_type === "service" ? "Service" :
                             line.item_type === "labour" ? "Labour" : "Callout"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground text-right md:text-left">×{line.quantity}</p>
                      <p className="text-sm hidden md:block">{formatCurrency(Number(line.unit_price), currency)}</p>
                      <p className="text-sm font-medium text-right">
                        {formatCurrency(Number(line.quantity) * Number(line.unit_price), currency)}
                      </p>
                      <span />
                    </>
                  )}
                </div>
              ))}

              {editing && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1 border-dashed border" onClick={addLine}>
                    <Plus className="w-4 h-4 mr-1" /> Add line
                  </Button>
                  {calloutRates.length > 0 && (
                    <Button variant="ghost" size="sm" className="flex-1 border-dashed border text-amber-700 hover:text-amber-800 hover:bg-amber-50" onClick={() => setLabourOpen(true)}>
                      <Clock className="w-4 h-4 mr-1" /> Add labour charge
                    </Button>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(editing ? subtotal : Number(invoice.subtotal), currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT ({editing ? vatRate : invoice.vat_rate}%)</span>
                  <span>{formatCurrency(editing ? vatAmount : Number(invoice.vat_amount), currency)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(editing ? total : Number(invoice.total), currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Internal Notes</Label>
                {editing ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes for internal use only"
                    className="mt-1 text-sm resize-none"
                    rows={2}
                  />
                ) : (
                  <p className="text-sm mt-1 whitespace-pre-wrap">{invoice.notes || <span className="text-muted-foreground">—</span>}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Customer-visible Notes</Label>
                {editing ? (
                  <Textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Notes printed on the invoice / quote"
                    className="mt-1 text-sm resize-none"
                    rows={2}
                  />
                ) : (
                  <p className="text-sm mt-1 whitespace-pre-wrap">{invoice.customer_notes || <span className="text-muted-foreground">—</span>}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment details (paid invoices only) */}
          {invoice.status === "paid" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Payment Received
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Amount Paid</p>
                  <p className="font-medium">{formatCurrency(invoice.paid_amount, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment Date</p>
                  <p className="font-medium">{formatDate(invoice.payment_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="font-medium">{invoice.payment_method || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reference</p>
                  <p className="font-medium">{invoice.payment_reference || "—"}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {isInvoice ? "Invoice" : "Quote"}</DialogTitle>
            <DialogDescription>
              A PDF will be generated and emailed to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Recipient email</Label>
              <Input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="customer@example.com"
                className="mt-1"
              />
              {!invoice.customer?.email && (
                <p className="text-xs text-amber-600 mt-1">
                  No email on customer record — enter one above.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={!sendEmail || sendMut.isPending}>
              {sendMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark paid dialog */}
      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record that payment has been received for this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount Paid</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Payment Method (optional)</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. bank transaction ID"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={paidMut.isPending}>
              {paidMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / void confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {invoice.status === "draft" ? "Delete" : "Cancel"} {isInvoice ? "Invoice" : "Quote"}?
            </DialogTitle>
            <DialogDescription>
              {invoice.status === "draft"
                ? "This will permanently delete the draft. This action cannot be undone."
                : "This will cancel the invoice. A cancelled invoice cannot be sent or paid."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Keep it</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {invoice.status === "draft" ? "Delete" : "Cancel Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to catalogue dialog */}
      <Dialog open={catAddOpen} onOpenChange={setCatAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as new {catAddType === "service" ? "Service" : "Product"}</DialogTitle>
            <DialogDescription>
              Add this item to your {catAddType === "service" ? "service" : "product"} catalogue so it can be quickly selected in future.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={catAddName}
                onChange={(e) => setCatAddName(e.target.value)}
                placeholder={catAddType === "service" ? "e.g. Annual Boiler Service" : "e.g. Thermostat"}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Default Price (optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={catAddPrice}
                onChange={(e) => setCatAddPrice(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saved as the catalogue default — you can always override it on the line.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatAddOpen(false)} disabled={catAddSaving}>Cancel</Button>
            <Button onClick={handleConfirmAddToCatalogue} disabled={!catAddName.trim() || catAddSaving}>
              {catAddSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-2" />
              Save to Catalogue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Labour Charge Dialog */}
      <Dialog open={labourOpen} onOpenChange={setLabourOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" /> Add Labour Charge
            </DialogTitle>
            <DialogDescription>Select a callout rate and enter the time on site to calculate the charge.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Rate selector */}
            <div className="space-y-1">
              <Label className="text-xs">Callout Rate</Label>
              <Select value={labourRateId} onValueChange={setLabourRateId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select rate…" />
                </SelectTrigger>
                <SelectContent>
                  {calloutRates.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.hourly_rate != null ? ` — ${formatCurrency(r.hourly_rate, currency)}/hr` : ""}
                      {r.amount > 0 ? ` (callout: ${formatCurrency(r.amount, currency)})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <Label className="text-xs">Time on site</Label>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">Hours</p>
                  <Input type="number" min="0" max="24" value={labourHours} onChange={e => setLabourHours(e.target.value)} className="h-9" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">Minutes</p>
                  <Input type="number" min="0" max="59" step="15" value={labourMins} onChange={e => setLabourMins(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>

            {/* Include callout checkbox */}
            {(() => {
              const rate = calloutRates.find(r => r.id === labourRateId);
              return rate && rate.amount > 0 ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="labourIncludeCallout"
                    checked={labourIncludeCallout}
                    onChange={e => setLabourIncludeCallout(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <label htmlFor="labourIncludeCallout" className="text-sm select-none cursor-pointer">
                    Include callout fee ({formatCurrency(rate.amount, currency)} — covers first hour)
                  </label>
                </div>
              ) : null;
            })()}

            {/* Cost preview */}
            {(() => {
              const rate = calloutRates.find(r => r.id === labourRateId);
              if (!rate) return null;
              const totalHrs = (parseInt(labourHours) || 0) + (parseInt(labourMins) || 0) / 60;
              if (totalHrs <= 0) return null;
              const calloutCost = labourIncludeCallout && rate.amount > 0 ? rate.amount : 0;
              const labourHrsCalc = calloutCost > 0 ? Math.max(0, totalHrs - 1) : totalHrs;
              const labourCost = labourHrsCalc > 0 && rate.hourly_rate != null ? labourHrsCalc * rate.hourly_rate : 0;
              const totalCost = calloutCost + labourCost;
              const hh = Math.floor(totalHrs);
              const mm = Math.round((totalHrs % 1) * 60);
              const durStr = hh > 0 ? `${hh}h${mm > 0 ? ` ${mm}m` : ""}` : `${mm}m`;
              return (
                <div className="rounded-lg bg-slate-50 border p-3 text-sm space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost breakdown — {durStr}</p>
                  {calloutCost > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Call-out (first hour)</span>
                      <span className="font-medium">{formatCurrency(calloutCost, currency)}</span>
                    </div>
                  )}
                  {labourCost > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {labourHrsCalc >= 1
                          ? `${Math.round(labourHrsCalc * 100) / 100}h`
                          : `${Math.round(labourHrsCalc * 60)}m`} @ {formatCurrency(rate.hourly_rate!, currency)}/hr
                      </span>
                      <span className="font-medium">{formatCurrency(labourCost, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1.5">
                    <span>Total</span>
                    <span className="text-emerald-600">{formatCurrency(totalCost, currency)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabourOpen(false)}>Cancel</Button>
            <Button onClick={addLabourCharge} disabled={!labourRateId || ((parseInt(labourHours) || 0) + (parseInt(labourMins) || 0) === 0)}>
              Add to {isInvoice ? "Invoice" : "Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
