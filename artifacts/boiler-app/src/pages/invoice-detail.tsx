import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useParams, useLocation, useSearch } from "wouter";
import {
  ArrowLeft, Send, CheckCircle2, XCircle, RefreshCcw, Download, Trash2,
  Loader2, Plus, Minus, Receipt, AlertTriangle, FileText, CreditCard,
  Edit3, Save, X,
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
  return { description: "", quantity: 1, unit_price: 0, item_type: "labour" };
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
}

function InvoiceDetailContent({ invoice, currency, navigate, toast }: DetailProps) {
  const id = invoice.id;
  const isDraft = invoice.status === "draft";
  const isInvoice = invoice.type === "invoice";

  const [editing, setEditing] = useState(isDraft);
  const [lines, setLines] = useState<InvoiceLineItem[]>(
    invoice.line_items && invoice.line_items.length > 0
      ? invoice.line_items.map((l) => ({ ...l }))
      : [emptyLine()]
  );
  const [vatRate, setVatRate] = useState(String(invoice.vat_rate ?? 20));
  const [issueDate, setIssueDate] = useState(invoice.issue_date || "");
  const [dueDate, setDueDate] = useState(invoice.due_date || "");
  const [expiryDate, setExpiryDate] = useState(invoice.expiry_date || "");
  const [notes, setNotes] = useState(invoice.notes || "");
  const [customerNotes, setCustomerNotes] = useState(invoice.customer_notes || "");

  // Dialogs
  const [sendOpen, setSendOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(invoice.customer?.email || "");

  // Payment form
  const [paidAmount, setPaidAmount] = useState(String(invoice.total ?? ""));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const updateMut = useUpdateInvoice(id);
  const deleteMut = useDeleteInvoice();
  const sendMut = useSendInvoice(id);
  const paidMut = useMarkInvoicePaid(id);
  const acceptMut = useAcceptQuote(id);
  const declineMut = useDeclineQuote(id);
  const convertMut = useConvertToInvoice(id);

  // Live totals
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const vr = parseFloat(vatRate) || 0;
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
        vat_rate: parseFloat(vatRate) || 0,
        issue_date: issueDate,
        due_date: dueDate || undefined,
        expiry_date: expiryDate || undefined,
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
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
          <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />} PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main form */}
        <div className="lg:col-span-2 space-y-4">
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
                {editing ? (
                  <Input
                    type="date"
                    value={isInvoice ? dueDate : expiryDate}
                    onChange={(e) => isInvoice ? setDueDate(e.target.value) : setExpiryDate(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {isInvoice ? formatDate(invoice.due_date) : formatDate(invoice.expiry_date)}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">VAT Rate (%)</Label>
                {editing ? (
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm mt-1">{invoice.vat_rate}%</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <p className="text-sm mt-1">{customerName}</p>
              </div>
              {invoice.job && (
                <div>
                  <Label className="text-xs text-muted-foreground">Job</Label>
                  <p className="text-sm mt-1 truncate">
                    <a href={`/jobs/${invoice.job_id}`} className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); navigate(`/jobs/${invoice.job_id}`); }}>
                      View Job
                    </a>
                  </p>
                </div>
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
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(idx, "description", e.target.value)}
                        placeholder="Description"
                        className="h-8 text-sm"
                      />
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
                      <p className="text-sm">{line.description || "—"}</p>
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
                <Button variant="ghost" size="sm" className="w-full border-dashed border" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-1" /> Add line
                </Button>
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

        {/* Right: actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Send */}
              {["draft", "sent"].includes(invoice.status) && (
                <Button
                  className="w-full"
                  onClick={() => setSendOpen(true)}
                  disabled={sendMut.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {invoice.status === "sent" ? "Re-send" : `Send ${isInvoice ? "Invoice" : "Quote"}`}
                </Button>
              )}

              {/* Mark paid (invoices) */}
              {isInvoice && ["sent", "overdue"].includes(invoice.status) && (
                <Button variant="outline" className="w-full" onClick={() => setPaidOpen(true)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Mark as Paid
                </Button>
              )}

              {/* Quote actions */}
              {!isInvoice && invoice.status === "sent" && (
                <>
                  <Button variant="outline" className="w-full" onClick={handleAccept} disabled={acceptMut.isPending}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Accepted
                  </Button>
                  <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={handleDecline} disabled={declineMut.isPending}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Mark as Declined
                  </Button>
                </>
              )}
              {!isInvoice && invoice.status === "accepted" && !invoice.converted_to_invoice_id && (
                <Button className="w-full" onClick={handleConvert} disabled={convertMut.isPending}>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Convert to Invoice
                </Button>
              )}
              {!isInvoice && invoice.status === "accepted" && (
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={handleDecline} disabled={declineMut.isPending}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark as Declined
                </Button>
              )}

              {/* Download PDF */}
              <Button variant="ghost" className="w-full" onClick={downloadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {downloadingPdf ? "Downloading..." : "Download PDF"}
              </Button>

              {/* Delete / void */}
              {!["paid", "converted"].includes(invoice.status) && (
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {invoice.status === "draft" ? "Delete" : "Cancel / Void"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Conversion info */}
          {invoice.converted_to_invoice_id && (
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Converted to invoice:</p>
                <button
                  className="text-sm text-primary hover:underline font-medium"
                  onClick={() => navigate(`/invoices/${invoice.converted_to_invoice_id}`)}
                >
                  View Invoice →
                </button>
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
    </div>
  );
}
