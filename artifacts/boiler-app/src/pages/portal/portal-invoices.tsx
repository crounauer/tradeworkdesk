import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { PortalLayout } from "./portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, Download, Loader2, FileText, CheckCircle, XCircle, ExternalLink, Eye } from "lucide-react";
import { useState } from "react";

type PortalInvoice = {
  id: string;
  type: "invoice" | "quote";
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  expiry_date: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency: string;
  customer_notes: string | null;
  stripe_payment_link_url?: string | null;
  gocardless_payment_link_url?: string | null;
};

type PortalMeta = {
  payment_link_url?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  sent:      { label: "Sent",      className: "bg-blue-100 text-blue-700" },
  paid:      { label: "Paid",      className: "bg-green-100 text-green-700" },
  overdue:   { label: "Overdue",   className: "bg-red-100 text-red-700" },
  accepted:  { label: "Accepted",  className: "bg-teal-100 text-teal-700" },
  declined:  { label: "Declined",  className: "bg-red-50 text-red-500" },
  converted: { label: "Converted", className: "bg-purple-100 text-purple-700" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default function PortalInvoices() {
  const { session } = usePortalAuth();
  const qc = useQueryClient();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery<PortalInvoice[]>({
    queryKey: ["portal-invoices"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/invoices`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json();
    },
    enabled: !!session,
    staleTime: 30_000,
  });

  const { data: meta } = useQuery<PortalMeta>({
    queryKey: ["portal-dashboard-meta"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/dashboard`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) return {};
      const d = await res.json();
      return { payment_link_url: d.payment_link_url ?? null };
    },
    enabled: !!session,
    staleTime: 300_000,
  });

  const quoteActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "decline" }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/invoices/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "Action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-invoices"] });
    },
  });

  async function downloadPdf(inv: PortalInvoice) {
    setDownloading(inv.id);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/invoices/${inv.id}/pdf`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.type === "quote" ? "quote" : "invoice"}-${inv.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — could add a toast here
    } finally {
      setDownloading(null);
    }
  }

  async function viewPdf(inv: PortalInvoice) {
    setPreviewing(inv.id);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/invoices/${inv.id}/pdf`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // silently fail
    } finally {
      setPreviewing(null);
    }
  }

  const invoiceList = (invoices || []).filter((i) => i.type === "invoice");
  const quoteList = (invoices || []).filter((i) => i.type === "quote");

  return (
    <PortalLayout>
      <div className="space-y-6 animate-in fade-in">
        <h1 className="text-2xl font-bold text-slate-900">Invoices &amp; Quotes</h1>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-40 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-64" />
              </Card>
            ))}
          </div>
        ) : (invoices || []).length === 0 ? (
          <Card className="p-8 text-center">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No invoices or quotes yet.</p>
          </Card>
        ) : (
          <>
            {invoiceList.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Receipt className="w-5 h-5" /> Invoices
                </h2>
                <div className="space-y-2">
                  {invoiceList.map((inv) => (
                    <InvoiceRow key={inv.id} inv={inv} downloading={downloading} onDownload={downloadPdf} paymentLinkUrl={meta?.payment_link_url} onPreview={viewPdf} previewing={previewing} />
                  ))}
                </div>
              </section>
            )}
            {quoteList.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Quotes
                </h2>
                <div className="space-y-2">
                  {quoteList.map((inv) => (
                    <InvoiceRow key={inv.id} inv={inv} downloading={downloading} onDownload={downloadPdf} onQuoteAction={(id, action) => quoteActionMutation.mutate({ id, action })} quoteActioning={quoteActionMutation.isPending ? quoteActionMutation.variables?.id : null} onPreview={viewPdf} previewing={previewing} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}

function InvoiceRow({
  inv,
  downloading,
  onDownload,
  paymentLinkUrl,
  onQuoteAction,
  quoteActioning,
  onPreview,
  previewing,
}: {
  inv: PortalInvoice;
  downloading: string | null;
  onDownload: (inv: PortalInvoice) => void;
  paymentLinkUrl?: string | null;
  onQuoteAction?: (id: string, action: "accept" | "decline") => void;
  quoteActioning?: string | null;
  onPreview: (inv: PortalInvoice) => void;
  previewing: string | null;
}) {
  const statusCfg = STATUS_CONFIG[inv.status] || { label: inv.status, className: "bg-slate-100 text-slate-600" };
  const dateLabel = inv.type === "invoice"
    ? inv.due_date ? `Due ${formatDate(inv.due_date)}` : `Issued ${formatDate(inv.issue_date)}`
    : inv.expiry_date ? `Valid until ${formatDate(inv.expiry_date)}` : `Issued ${formatDate(inv.issue_date)}`;

  const isPayable = inv.type === "invoice" && (inv.status === "sent" || inv.status === "overdue");
  // Collect non-PayPal payment links
  const otherOptions: Array<{ label: string; url: string; className: string }> = [];
  if (isPayable) {
    if (inv.stripe_payment_link_url) otherOptions.push({ label: "Pay by Card", url: inv.stripe_payment_link_url, className: "bg-violet-600 hover:bg-violet-700 text-white" });
    if (inv.gocardless_payment_link_url) otherOptions.push({ label: "Pay by Bank", url: inv.gocardless_payment_link_url, className: "bg-teal-600 hover:bg-teal-700 text-white" });
    if (otherOptions.length === 0 && paymentLinkUrl) {
      otherOptions.push({ label: "Pay Now", url: paymentLinkUrl, className: "bg-green-600 hover:bg-green-700 text-white" });
    }
  }
  const showQuoteActions = inv.type === "quote" && inv.status === "sent" && onQuoteAction;
  const isActioning = quoteActioning === inv.id;

  return (
    <Card className="p-4 border border-slate-200">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
          <div className="min-w-0">
            <p className="font-mono font-semibold text-sm text-slate-900">{inv.invoice_number}</p>
            <p className="text-xs text-slate-500">{dateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <p className="font-semibold text-slate-900">{formatCurrency(Number(inv.total), inv.currency)}</p>
          {otherOptions.map((opt) => (
            <Button
              key={opt.url}
              size="sm"
              className={`h-8 text-xs ${opt.className}`}
              onClick={() => window.open(opt.url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              {opt.label}
            </Button>
          ))}
          {showQuoteActions && (
            <>
              <Button
                size="sm"
                className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                disabled={isActioning}
                onClick={() => onQuoteAction!(inv.id, "accept")}
              >
                {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                disabled={isActioning}
                onClick={() => onQuoteAction!(inv.id, "decline")}
              >
                {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                Decline
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onPreview(inv)}
            disabled={previewing === inv.id}
          >
            {previewing === inv.id
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Eye className="w-3.5 h-3.5" />
            }
            <span className="ml-1 hidden sm:inline">View</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onDownload(inv)}
            disabled={downloading === inv.id}
          >
            {downloading === inv.id
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />
            }
            <span className="ml-1 hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>
      {inv.customer_notes && (
        <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 line-clamp-2">
          {inv.customer_notes}
        </p>
      )}
    </Card>
  );
}
