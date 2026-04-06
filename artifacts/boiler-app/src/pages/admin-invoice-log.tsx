import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, ExternalLink, Search, ArrowUpDown } from "lucide-react";

interface InvoiceLogEntry {
  job_id: string;
  job_date: string;
  job_status: string;
  customer_name: string;
  external_invoice_id: string;
  provider: string;
  provider_name: string;
  sent_at: string | null;
}

const PROVIDER_COLORS: Record<string, string> = {
  zoho_invoice: "bg-red-100 text-red-700 border-red-200",
  xero: "bg-blue-100 text-blue-700 border-blue-200",
  quickbooks: "bg-green-100 text-green-700 border-green-200",
  sage: "bg-emerald-100 text-emerald-700 border-emerald-200",
  freeagent: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function AdminInvoiceLog() {
  const [entries, setEntries] = useState<InvoiceLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const data = await customFetch(`${import.meta.env.BASE_URL}api/admin/accounting-integrations/invoice-log`) as { entries: InvoiceLogEntry[]; total: number };
        setEntries(data.entries);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = entries
    .filter((e) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        e.customer_name.toLowerCase().includes(term) ||
        e.external_invoice_id.toLowerCase().includes(term) ||
        e.provider_name.toLowerCase().includes(term) ||
        e.job_id.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const dateA = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const dateB = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      return sortAsc ? dateA - dateB : dateB - dateA;
    });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatJobDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoice Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All invoices sent to your accounting software
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Sent Invoices
              </CardTitle>
              <CardDescription>
                {loading ? "Loading..." : `${filtered.length} invoice${filtered.length !== 1 ? "s" : ""} sent`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No invoices sent yet</p>
              <p className="text-sm mt-1">
                Invoices sent from completed jobs will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, invoice ID, or provider..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {sortAsc ? "Oldest first" : "Newest first"}
                </Button>
              </div>

              <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                <span>Customer</span>
                <span>Job Date</span>
                <span>Provider / Invoice ID</span>
                <span>Sent</span>
                <span></span>
              </div>

              {filtered.map((entry) => (
                <div
                  key={entry.job_id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 md:gap-3 items-center p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/jobs/${entry.job_id}`)}
                >
                  <div>
                    <p className="font-medium text-sm">{entry.customer_name}</p>
                    <p className="text-xs text-muted-foreground md:hidden">
                      {formatJobDate(entry.job_date)}
                    </p>
                  </div>

                  <div className="hidden md:block text-sm">
                    {formatJobDate(entry.job_date)}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${PROVIDER_COLORS[entry.provider] || "bg-gray-100 text-gray-700 border-gray-200"}`}
                    >
                      {entry.provider_name}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                      {entry.external_invoice_id.substring(0, 16)}
                    </span>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {formatDate(entry.sent_at)}
                  </div>

                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${entry.job_id}`);
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Job
                    </Button>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && entries.length > 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No invoices match your search
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
