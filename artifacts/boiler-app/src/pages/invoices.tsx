import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Receipt, CheckCircle2, Clock, XCircle, DollarSign, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { QuickInvoiceDialog } from "@/components/quick-invoice-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useListInvoices, type InvoiceType, type InvoiceStatus, type Invoice } from "@/hooks/use-invoices";

// ─── Status badge ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  draft:     { label: "Draft",     variant: "secondary", className: "bg-gray-100 text-gray-700" },
  sent:      { label: "Sent",      variant: "default",   className: "bg-blue-100 text-blue-700" },
  paid:      { label: "Paid",      variant: "default",   className: "bg-green-100 text-green-700" },
  overdue:   { label: "Overdue",   variant: "destructive", className: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", variant: "outline",   className: "bg-gray-50 text-gray-400 line-through" },
  accepted:  { label: "Accepted",  variant: "default",   className: "bg-teal-100 text-teal-700" },
  declined:  { label: "Declined",  variant: "secondary", className: "bg-red-50 text-red-500" },
  converted: { label: "Converted", variant: "default",   className: "bg-purple-100 text-purple-700" },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Feature-gated wrapper ─────────────────────────────────────────────────

export default function Invoices() {
  const { hasFeature } = usePlanFeatures();

  if (!hasFeature("invoicing")) {
    return (
      <UpgradePrompt
        feature="invoicing"
        title="Invoicing & Quotes"
        description="Create professional invoices and quotes, send them to customers by email, and track payments. Upgrade to Professional or higher to unlock this feature."
      />
    );
  }

  return <InvoicesContent />;
}

// ─── Main content ─────────────────────────────────────────────────────────

type Tab = "invoice" | "quote";

function InvoicesContent() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const initialTab = (new URLSearchParams(searchString).get("type") === "quote" ? "quote" : "invoice") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [quickDialog, setQuickDialog] = useState<"invoice" | "quote" | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const qc = useQueryClient();
  const { data: settings } = useCompanySettings();

  // Poll company settings every 3 s while invoicing is disabled so the page
  // automatically transitions to the invoice list the moment an admin enables it
  useEffect(() => {
    if (settings?.invoices_enabled !== false) return;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["/api/company-settings"] });
    }, 3000);
    return () => clearInterval(id);
  }, [settings?.invoices_enabled, qc]);

  const { data, isLoading } = useListInvoices({
    type: tab,
    status: statusFilter ? (statusFilter as InvoiceStatus) : undefined,
    page,
    limit: 50,
  });

  const invoices = data?.invoices ?? [];
  const pagination = data?.pagination;

  const statusOptions: Array<{ value: InvoiceStatus; label: string }> = tab === "invoice"
    ? [
        { value: "draft", label: "Draft" },
        { value: "sent", label: "Sent" },
        { value: "paid", label: "Paid" },
        { value: "overdue", label: "Overdue" },
        { value: "cancelled", label: "Cancelled" },
      ]
    : [
        { value: "draft", label: "Draft" },
        { value: "sent", label: "Sent" },
        { value: "accepted", label: "Accepted" },
        { value: "declined", label: "Declined" },
        { value: "converted", label: "Converted" },
        { value: "cancelled", label: "Cancelled" },
      ];

  // If invoices_enabled is explicitly false, show an info panel
  if (settings && settings.invoices_enabled === false) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <Receipt className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Invoices & Quotes</h1>
        </div>
        <Card className="p-8 text-center max-w-lg mx-auto space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-semibold">Invoicing is disabled</h2>
          <p className="text-muted-foreground text-sm">
            Invoicing has not been enabled for your company yet. An admin can turn it on in
            Company Settings.
          </p>
          <Link href="/admin/company-settings">
            <Button variant="outline" className="mt-2">
              Go to Company Settings
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Invoices & Quotes</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickDialog("quote")}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Quote
          </Button>
          <Button
            size="sm"
            onClick={() => setQuickDialog("invoice")}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["invoice", "quote"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); setStatusFilter(""); }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "invoice" ? "Invoices" : "Quotes"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">
            {pagination.total} {tab === "invoice" ? "invoice" : "quote"}{pagination.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table / List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {tab === "invoice" ? "invoices" : "quotes"} found</p>
          <p className="text-sm mt-1">
            {statusFilter
              ? "Try clearing the status filter."
              : `Create your first ${tab} to get started.`}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Number</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    {tab === "invoice" ? "Issue Date" : "Issue Date"}
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    {tab === "invoice" ? "Due Date" : "Expiry Date"}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-primary">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3">
                      {inv.customers
                        ? `${inv.customers.first_name} ${inv.customers.last_name}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tab === "invoice"
                        ? (inv.due_date
                            ? formatDate(inv.due_date)
                            : (settings?.default_payment_terms_days != null && settings.default_payment_terms_days > 0)
                              ? `Net ${settings.default_payment_terms_days} days`
                              : "Due on Receipt")
                        : formatDate(inv.expiry_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(Number(inv.total), inv.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {invoices.map((inv) => (
              <Card
                key={inv.id}
                className="p-4 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-medium text-primary text-sm">{inv.invoice_number}</p>
                    <p className="text-sm">
                      {inv.customers
                        ? `${inv.customers.first_name} ${inv.customers.last_name}`
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tab === "invoice"
                        ? (inv.due_date
                            ? `Due: ${formatDate(inv.due_date)}`
                            : (settings?.default_payment_terms_days != null && settings.default_payment_terms_days > 0)
                              ? `Net ${settings.default_payment_terms_days} days`
                              : "Due on Receipt")
                        : `Expires: ${formatDate(inv.expiry_date)}`}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="font-semibold text-sm">
                      {formatCurrency(Number(inv.total), inv.currency)}
                    </p>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      {quickDialog && (
        <QuickInvoiceDialog type={quickDialog} onOpenChange={(v) => { if (!v) setQuickDialog(null); }} />
      )}
    </div>
  );
}
