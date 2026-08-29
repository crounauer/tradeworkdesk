import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import {
  ArrowLeft, Send, CheckCircle2, XCircle, RefreshCcw, Download, Trash2,
  Loader2, Receipt, AlertTriangle, FileText, CreditCard,
  Edit3, Save, X, Mail, ChevronDown, ChevronUp, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useAuth } from "@/hooks/use-auth";
import { BookJobDialog } from "@/components/book-job-dialog";
import { CreateJobFromQuoteDialog } from "@/components/create-job-from-quote-dialog";
import { PartsSection } from "@/components/line-items/parts-section";
import { ServicesSection } from "@/components/line-items/services-section";
import { TimeSection } from "@/components/line-items/time-section";
import type { CalloutRateOption, PartLine, ServiceLine, TimeLine } from "@/components/line-items/types";
import { computeLabourBreakdown, calcDuration } from "@/lib/line-items";
import {
  invoiceKeys,
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

function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";
  const normalized = String(method).toLowerCase();
  if (normalized === "cash") return "Cash";
  if (normalized === "bacs") return "BACS";
  if (normalized === "bank_transfer") return "Bank Transfer";
  if (normalized === "cc" || normalized === "card") return "CC";
  if (normalized === "direct_debit" || normalized === "gocardless") return "Direct Debit";
  return method;
}

// ─── Empty line item ──────────────────────────────────────────────────────

function emptyLine(): InvoiceLineItem {
  return { description: "", quantity: 1, unit_price: 0, item_type: "other" };
}

function normalizeLineItem(line: InvoiceLineItem): InvoiceLineItem {
  return {
    ...line,
    quantity: Number(line.quantity) || 0,
    unit_price: Number(line.unit_price) || 0,
  };
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
  const qc = useQueryClient();

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
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      navigate(`/invoices/${inv.id}?edit=1`, { replace: true });
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
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isInvoice = invoice.type === "invoice";
  const totalPaid = Number(invoice.amount_paid ?? invoice.paid_amount ?? 0);
  const balanceDue = Math.max(0, Number(invoice.balance_due ?? Number(invoice.total) - totalPaid));
  const paymentHistory = invoice.payments ?? [];
  const hasExistingPayments = paymentHistory.length > 0;

  const [editing, setEditing] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return isDraft && sp.get("edit") === "1";
  });
  const [lines, setLines] = useState<InvoiceLineItem[]>(
    invoice.line_items ? invoice.line_items.map(normalizeLineItem) : []
  );
  const [worksOrder, setWorksOrder] = useState(invoice.works_order || "");
  const [emailLogRefresh, setEmailLogRefresh] = useState(0);
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
  const [selectedPropertyId, setSelectedPropertyId] = useState(invoice.property_id || "");
  const { data: customerProperties = [] } = useQuery<Array<{
    id: string;
    address_line1?: string | null;
    city?: string | null;
    county?: string | null;
    postcode?: string | null;
  }>>({
    queryKey: ["invoice-customer-properties", invoice.customer_id],
    queryFn: () => customFetch(`${import.meta.env.BASE_URL}api/properties?customer_id=${invoice.customer_id}`),
    enabled: !invoice.job_id,
  });

  // Dialogs
  const [sendOpen, setSendOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sendReceiptOnPayment, setSendReceiptOnPayment] = useState(false);
  const [sendEmail, setSendEmail] = useState(invoice.customer?.email || "");
  const [sendNote, setSendNote] = useState("");
  const [showBookJob, setShowBookJob] = useState(false);
  const [showCreateJob, setShowCreateJob] = useState(false);

  // Callout rates (for the shared time section)
  const [calloutRates, setCalloutRates] = useState<CalloutRateOption[]>([]);
  useEffect(() => {
    customFetch(`${import.meta.env.BASE_URL}api/admin/callout-rates`)
      .then(d => { if (Array.isArray(d)) setCalloutRates(d as CalloutRateOption[]); })
      .catch(() => {});
  }, []);

  // Add-to-catalogue dialog state


  // Payment form
  const [paidAmount, setPaidAmount] = useState(String(invoice.total ?? ""));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    if (!paidOpen) return;
    setPaidAmount(String(balanceDue > 0 ? balanceDue : Number(invoice.total ?? 0)));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
    setPaymentReference("");
  }, [paidOpen, balanceDue, invoice.total]);

  const updateMut = useUpdateInvoice(id);
  const deleteMut = useDeleteInvoice();
  const sendMut = useSendInvoice(id);
  const markSentMut = useMarkInvoiceSent(id);
  const unsendMut = useUnsendInvoice(id);
  const paidMut = useMarkInvoicePaid(id);
  const acceptMut = useAcceptQuote(id);
  const declineMut = useDeclineQuote(id);
  const convertMut = useConvertToInvoice(id);

  // Live totals — parts flagged "to order" are listed but not charged, matching the job page.
  const subtotal = lines.reduce(
    (s, l) => (l.status === "to_order" ? s : s + Number(l.quantity) * Number(l.unit_price)),
    0,
  );
  const vr = Number(invoice.vat_rate) || 0;
  const vatAmount = Math.round(subtotal * vr) / 100;
  const total = subtotal + vatAmount;

  const money = (amount: number) => formatCurrency(amount, currency);
  const canEditCatalogue = ["admin", "office_staff", "super_admin"].includes(profile?.role ?? "");
  const defaultHourlyRate = Number(settings?.default_hourly_rate) || 0;
  const defaultCalloutFee = Number(settings?.call_out_fee) || 0;

  function patchLine(key: string, patch: Partial<InvoiceLineItem>) {
    const idx = Number(key);
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    const idx = Number(key);
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  // The catalogue flag is request-only, so drop it once it has been sent or abandoned.
  function clearCatalogueFlags() {
    setLines((prev) => prev.map(({ update_catalogue_price: _drop, ...rest }) => rest));
  }

  const indexed = lines.map((line, index) => ({ line, index }));

  const partLines: PartLine[] = indexed
    .filter(({ line }) => line.item_type === "product")
    .map(({ line, index }) => ({
      key: String(index),
      name: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unit_price),
      serialNumber: line.serial_number ?? null,
      status: line.status === "to_order" ? "to_order" : "fitted",
      catalogueItemId: line.catalogue_item_id ?? null,
    }));

  const serviceLines: ServiceLine[] = indexed
    .filter(({ line }) => line.item_type === "service")
    .map(({ line, index }) => ({
      key: String(index),
      name: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unit_price),
      catalogueItemId: line.catalogue_item_id ?? null,
    }));

  const timeLines: TimeLine[] = indexed
    .filter(({ line }) => !["product", "service"].includes(line.item_type || ""))
    .map(({ line, index }) => ({
      key: String(index),
      arrival: line.arrival_time ?? null,
      departure: line.departure_time ?? null,
      notes: line.notes ?? null,
      // Rows without an arrival time (estimates and pre-parity rows) carry their cost in qty × price.
      hourlyRate: line.arrival_time ? (line.hourly_rate != null ? Number(line.hourly_rate) : null) : Number(line.unit_price),
      calloutFee: line.arrival_time ? (line.callout_fee != null ? Number(line.callout_fee) : null) : 0,
      calloutRateId: line.callout_rate_id ?? null,
      estimatedHours: line.arrival_time ? null : Number(line.quantity),
      label: line.description,
    }));

  function timeLineFrom(entry: Omit<TimeLine, "key">): InvoiceLineItem {
    if (entry.estimatedHours != null) {
      const hours = entry.estimatedHours;
      const noteSuffix = entry.notes ? ` — ${entry.notes}` : "";
      return {
        description: `Estimated labour (${hours} hour${hours === 1 ? "" : "s"})${noteSuffix}`,
        quantity: hours,
        unit_price: Number(entry.hourlyRate) || 0,
        item_type: "labour",
        notes: entry.notes ?? null,
      };
    }
    const bd = computeLabourBreakdown({
      arrival: entry.arrival,
      departure: entry.departure,
      hourlyRate: entry.hourlyRate,
      calloutFee: entry.calloutFee,
    });
    const rateName = calloutRates.find(r => r.id === entry.calloutRateId)?.name || "Labour";
    const day = entry.arrival ? new Date(entry.arrival).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
    const duration = calcDuration(entry.arrival, entry.departure);
    return {
      description: `${rateName} – ${day}${duration !== "—" ? ` (${duration})` : ""}`,
      quantity: 1,
      unit_price: Math.round(bd.entryCost * 100) / 100,
      item_type: Number(entry.calloutFee) > 0 ? "callout" : "labour",
      arrival_time: entry.arrival,
      departure_time: entry.departure,
      hourly_rate: entry.hourlyRate,
      callout_fee: entry.calloutFee,
      callout_rate_id: entry.calloutRateId ?? null,
      notes: entry.notes ?? null,
    };
  }

  async function saveChanges() {
    try {
      await updateMut.mutateAsync({
        line_items: lines,
        issue_date: issueDate,
        works_order: worksOrder,
        notes,
        customer_notes: customerNotes,
        property_id: selectedPropertyId || null,
      });
      toast({ title: "Saved" });
      clearCatalogueFlags();
      setEditing(false);
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleSend() {
    try {
      const result = await sendMut.mutateAsync({
        override_email: sendEmail !== invoice.customer?.email ? sendEmail : undefined,
        send_note: sendNote.trim() ? sendNote.trim() : undefined,
      });
      toast({ title: `${isInvoice ? "Invoice" : "Quote"} sent`, description: `Sent to ${result.sent_to}` });
      setSendOpen(false);
      setEmailLogRefresh(n => n + 1);
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
        send_receipt: sendReceiptOnPayment,
      });
      toast({ title: "Payment recorded" });
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
      navigate(`/invoices/${newInv.id}?edit=1`);
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    const hardDelete = ["draft", "cancelled", "converted"].includes(invoice.status as string);
    try {
      await deleteMut.mutateAsync(id);
      if (hardDelete) {
        toast({ title: "Deleted" });
        qc.removeQueries({ queryKey: invoiceKeys.all });
        navigate(isInvoice ? "/invoices" : "/invoices?type=quote");
      } else {
        setDeleteOpen(false);
        toast({ title: `${isInvoice ? "Invoice" : "Quote"} cancelled` });
        qc.invalidateQueries({ queryKey: invoiceKeys.all });
      }
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
      a.download = `${invoice?.type === "quote" ? "quote" : "invoice"}-${invoice?.invoice_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  }

  const customerName = invoice.customer
    ? (invoice.customer.business_name || `${invoice.customer.first_name} ${invoice.customer.last_name}`)
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
              {isInvoice ? "Invoice" : "Quote"} for{" "}
              {invoice.customer_id ? (
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => navigate(`/customers/${invoice.customer_id}`)}
                >
                  {customerName}
                </button>
              ) : customerName}
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
              <Button variant="outline" size="sm" onClick={() => { clearCatalogueFlags(); setEditing(false); }}>
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
          {isInvoice && !["paid", "cancelled", "declined", "converted"].includes(invoice.status) && balanceDue > 0 && (
            <Button variant="outline" onClick={() => setPaidOpen(true)}>
              <CreditCard className="w-4 h-4 mr-2" /> Record Payment
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
          {/* Accepted quote: primary action is Create Job (if no job yet), or View Job (if created) */}
          {!isInvoice && invoice.status === "accepted" && !invoice.job_id && (
            <Button onClick={() => setShowCreateJob(true)}>
              <Briefcase className="w-4 h-4 mr-2" /> Create Job from Quote
            </Button>
          )}
          {!isInvoice && invoice.status === "accepted" && invoice.job_id && (
            <Button variant="outline" onClick={() => navigate(`/jobs/${invoice.job_id}`)}>
              <Briefcase className="w-4 h-4 mr-2" /> View Job →
            </Button>
          )}
          {/* Convert to Invoice is a secondary path (supply-only / no site visit needed) */}
          {!isInvoice && invoice.status === "accepted" && !invoice.converted_to_invoice_id && (
            <Button variant="outline" onClick={handleConvert} disabled={convertMut.isPending}>
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
          {/* Book Job button only shown for invoices, not quotes (quotes use Create Job from Quote) */}
          {isInvoice && invoice.customer_id && (
            <Button variant="outline" onClick={() => setShowBookJob(true)}>
              <Briefcase className="w-4 h-4 mr-2" /> Book Job
            </Button>
          )}
          {!["paid"].includes(invoice.status) && (
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
          {/* Dates */}
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
                {!invoice.job_id && customerProperties.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Service Address</Label>
                    {editing ? (
                      <select
                        className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                      >
                        <option value="">Select property...</option>
                        {customerProperties.map((property) => (
                          <option key={property.id} value={property.id}>
                            {[property.address_line1, property.city, property.postcode].filter(Boolean).join(", ") || "Unnamed property"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm mt-1">
                        {invoice.property?.address_line1
                          ? [invoice.property.address_line1, invoice.property.city, invoice.property.postcode].filter(Boolean).join(", ")
                          : "No property selected"}
                      </p>
                    )}
                  </div>
                )}
                {invoice.customer?.address_line1 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Billing Address</Label>
                    <p className="text-sm mt-1">
                      {[invoice.customer.address_line1, invoice.customer.city, invoice.customer.postcode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
                {invoice.job_id && invoice.job?.property_address?.address_line1 &&
                  (invoice.property?.postcode || invoice.job?.property_address?.postcode)?.replace(/\s/g, "").toUpperCase() !==
                  invoice.customer?.postcode?.replace(/\s/g, "").toUpperCase() && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Service Address</Label>
                    <p className="text-sm mt-1">
                      {[
                        invoice.property?.address_line1 || invoice.job?.property_address?.address_line1,
                        invoice.property?.city || invoice.job?.property_address?.city,
                        invoice.property?.postcode || invoice.job?.property_address?.postcode,
                      ].filter(Boolean).join(", ")}
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
          <div className="space-y-4">
            <PartsSection
              parts={partLines}
              readOnly={!editing}
              canEditCatalogue={canEditCatalogue}
              formatMoney={money}
              onAdd={(p) => setLines(prev => [...prev, {
                description: p.name,
                quantity: p.quantity,
                unit_price: p.unitPrice ?? 0,
                item_type: "product",
                serial_number: p.serialNumber ?? null,
                status: p.status,
                catalogue_item_id: p.catalogueItemId ?? null,
              }])}
              onUpdate={(key, patch, options) => {
                const wantsCatalogueUpdate = Boolean(
                  options?.updateCataloguePrice
                  && patch.unitPrice !== undefined
                  && partLines.find(p => p.key === key)?.catalogueItemId,
                );
                patchLine(key, {
                  ...(patch.name !== undefined ? { description: patch.name } : {}),
                  ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
                  ...(patch.unitPrice !== undefined ? { unit_price: patch.unitPrice ?? 0 } : {}),
                  ...(patch.serialNumber !== undefined ? { serial_number: patch.serialNumber } : {}),
                  ...(patch.status !== undefined ? { status: patch.status } : {}),
                  ...(wantsCatalogueUpdate ? { update_catalogue_price: true } : {}),
                });
              }}
              onDelete={removeLine}
            />

            <ServicesSection
              services={serviceLines}
              readOnly={!editing}
              canEditCatalogue={canEditCatalogue}
              formatMoney={money}
              onAdd={(s) => setLines(prev => [...prev, {
                description: s.name,
                quantity: s.quantity,
                unit_price: s.unitPrice ?? 0,
                item_type: "service",
                catalogue_item_id: s.catalogueItemId ?? null,
              }])}
              onUpdate={(key, patch, options) => {
                const wantsCatalogueUpdate = Boolean(
                  options?.updateCataloguePrice
                  && patch.unitPrice !== undefined
                  && serviceLines.find(s => s.key === key)?.catalogueItemId,
                );
                patchLine(key, {
                  ...(patch.name !== undefined ? { description: patch.name } : {}),
                  ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
                  ...(patch.unitPrice !== undefined ? { unit_price: patch.unitPrice ?? 0 } : {}),
                  ...(wantsCatalogueUpdate ? { update_catalogue_price: true } : {}),
                });
              }}
              onDelete={removeLine}
            />

            <TimeSection
              entries={timeLines}
              calloutRates={calloutRates}
              defaultHourlyRate={defaultHourlyRate}
              defaultCalloutFee={defaultCalloutFee}
              allowEstimate
              readOnly={!editing}
              formatMoney={money}
              onAdd={(entry) => setLines(prev => [...prev, timeLineFrom(entry)])}
              onUpdate={(key, patch) => {
                const current = timeLines.find(t => t.key === key);
                if (!current) return;
                patchLine(key, timeLineFrom({ ...current, ...patch }));
              }}
              onDelete={removeLine}
            />

            <Card>
              <CardContent className="pt-4 space-y-1 text-sm">
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
              </CardContent>
            </Card>
          </div>

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

          {/* Payment details */}
          {isInvoice && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount Paid</p>
                    <p className="font-medium">{formatCurrency(totalPaid, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                    <p className="font-medium">{formatCurrency(balanceDue, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Latest Payment</p>
                    <p className="font-medium">{formatDate(invoice.payment_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Method</p>
                    <p className="font-medium">{formatPaymentMethod(invoice.payment_method)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Payment History</p>
                  <div className="space-y-2">
                    {paymentHistory.map((payment) => (
                      <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                        <div>
                          <div className="font-medium">{formatCurrency(payment.amount, currency)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(payment.payment_date)} · {formatPaymentMethod(payment.payment_method)}{payment.payment_reference ? ` · ${payment.payment_reference}` : ""}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleString("en-GB")}</div>
                      </div>
                    ))}
                    {paymentHistory.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No payment history recorded yet.</p>
                    )}
                  </div>
                </div>
                {balanceDue > 0 ? (
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setPaidOpen(true)}>
                      <CreditCard className="w-4 h-4 mr-2" /> {hasExistingPayments ? "Add Another Payment" : "Record Payment"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">This invoice is fully paid.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Email log ── */}
      <InvoiceEmailLogSection invoiceId={id} refreshKey={emailLogRefresh} />

      {/* ── Book Job dialog (invoices only) ── */}
      <BookJobDialog
        open={showBookJob}
        onOpenChange={setShowBookJob}
        initialCustomerId={invoice.customer_id}
        initialPropertyId={invoice.job?.property_id ?? undefined}
        invoiceId={id}
      />

      {/* ── Create Job from Quote dialog ── */}
      {!isInvoice && invoice.customer_id && (
        <CreateJobFromQuoteDialog
          open={showCreateJob}
          onOpenChange={setShowCreateJob}
          quoteId={id}
          quoteNumber={invoice.invoice_number}
          customerId={invoice.customer_id}
          customerName={
            invoice.customer
              ? `${invoice.customer.first_name} ${invoice.customer.last_name}`
              : "Customer"
          }
          customerNotes={invoice.customer_notes}
          notes={invoice.notes}
          lineItems={lines}
          initialPropertyId={invoice.job?.property_id ?? undefined}
        />
      )}

      {/* ── Dialogs ── */}

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {isInvoice ? "Invoice" : "Quote"}</DialogTitle>
            <DialogDescription>
              A PDF will be generated and emailed to the customer. You can add a short note to include in the email.
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
              <div>
                <Label>Note to customer (optional)</Label>
                <Textarea
                  value={sendNote}
                  onChange={(e) => setSendNote(e.target.value)}
                  placeholder="Add a short note to the email..."
                  className="mt-1 min-h-[90px]"
                />
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
      <Dialog
        open={paidOpen}
        onOpenChange={(open) => {
          setPaidOpen(open);
          if (!open) setSendReceiptOnPayment(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasExistingPayments ? "Add Another Payment" : "Record Payment"}</DialogTitle>
            <DialogDescription>
              Record a full payment, deposit, or part payment against this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
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
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bacs">BACS</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cc">CC</SelectItem>
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
            <div className="rounded-md border p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="send-payment-receipt"
                  checked={sendReceiptOnPayment}
                  onCheckedChange={(checked) => setSendReceiptOnPayment(checked === true)}
                  disabled={!invoice.customer?.email}
                />
                <div className="space-y-1">
                  <Label htmlFor="send-payment-receipt" className="cursor-pointer">Send customer receipt</Label>
                  <p className="text-xs text-muted-foreground">
                    {invoice.customer?.email
                      ? `Email a payment receipt to ${invoice.customer.email}.`
                      : "Customer has no email address on record."}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={paidMut.isPending}>
              {paidMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Save Payment
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
              {invoice.status === "draft" || invoice.status === "converted"
                ? "This will permanently delete this. This action cannot be undone."
                : `This will cancel the ${isInvoice ? "invoice" : "quote"}. It cannot be sent or paid once cancelled.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Keep it</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {invoice.status === "draft" || invoice.status === "converted" ? "Delete" : `Cancel ${isInvoice ? "Invoice" : "Quote"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ─── Invoice Email Log Section ─────────────────────────────────────────────
interface InvoiceEmailLogEntry {
  id: string;
  sent_by_name: string | null;
  sent_to: string;
  created_at: string;
}

function InvoiceEmailLogSection({ invoiceId, refreshKey }: { invoiceId: string; refreshKey: number }) {
  const [logs, setLogs] = useState<InvoiceEmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/invoices/${invoiceId}/email-log`);
        if (!cancelled) { setLogs(data as InvoiceEmailLogEntry[]); setExpanded(true); }
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceId, refreshKey]);

  if (loading || logs.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4">
      <Card className="p-4 sm:p-6 border border-border/50 shadow-sm">
        <button className="w-full flex items-center justify-between" onClick={() => setExpanded(!expanded)}>
          <h3 className="font-bold text-base flex items-center gap-2 text-blue-600">
            <Mail className="w-4 h-4" /> Email History ({logs.length})
          </h3>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {expanded && (
          <div className="mt-4 space-y-2">
            {logs.map(entry => (
              <div key={entry.id} className="flex items-center justify-between border border-border/40 rounded-lg px-3 py-2.5 bg-muted/20 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate text-foreground">{entry.sent_to}</span>
                  {entry.sent_by_name && (
                    <span className="text-xs text-muted-foreground shrink-0">by {entry.sent_by_name}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">
                  {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
