import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EmailAuditRow = {
  id: string;
  status: string;
  email_type: string;
  to_email: string | null;
  subject: string;
  provider: string | null;
  provider_message_id: string | null;
  from_email: string | null;
  reply_to: string | null;
  error_message: string | null;
  failure_category: string | null;
  needs_action: boolean;
  created_at: string;
};

type EmailAuditResponse = {
  items: EmailAuditRow[];
  count: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "accepted", label: "Accepted" },
  { value: "delivered", label: "Delivered" },
  { value: "deferred", label: "Deferred" },
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Complained" },
  { value: "suppressed", label: "Suppressed" },
  { value: "failed", label: "Failed" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All email types" },
  { value: "invoice", label: "Invoice" },
  { value: "quote", label: "Quote" },
  { value: "invoice_receipt", label: "Invoice Receipt" },
  { value: "portal_invite", label: "Portal Invite" },
  { value: "job_forms", label: "Job Forms" },
  { value: "job_confirmation", label: "Job Confirmation" },
  { value: "service_due_reminder", label: "Service Reminder" },
  { value: "review_request", label: "Review Request" },
  { value: "support_ticket_notification", label: "Support Ticket" },
  { value: "simple_notification", label: "Simple Notification" },
];

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "accepted" || s === "queued") return "bg-emerald-100 text-emerald-700";
  if (s === "deferred") return "bg-amber-100 text-amber-800";
  if (s === "bounced" || s === "failed" || s === "complained" || s === "suppressed") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function EmailAuditReport() {
  const [status, setStatus] = useState("");
  const [emailType, setEmailType] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (status) params.set("status", status);
    if (emailType) params.set("email_type", emailType);
    if (search.trim()) params.set("q", search.trim());
    return params.toString();
  }, [status, emailType, search]);

  const { data, isLoading, isFetching } = useQuery<EmailAuditResponse>({
    queryKey: ["email-audit", queryParams],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/email-audit?${queryParams}`);
      if (!res.ok) {
        throw new Error("Failed to load email audit log");
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  const rows = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold">Tenant Email Log</h2>
          <p className="text-sm text-muted-foreground">Master tenant email delivery log (latest 200 records with filters).</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={emailType}
          onChange={(e) => setEmailType(e.target.value)}
        >
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <input
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Search subject or recipient"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSearch(searchDraft);
          }}
        />

        <button
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-accent"
          onClick={() => setSearch(searchDraft)}
          type="button"
        >
          Apply Search
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, idx) => (
            <Card key={idx}>
              <CardContent className="p-3">
                <div className="h-8 bg-slate-100 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No email log entries found for the current filters.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">When</TableHead>
                    <TableHead className="min-w-[110px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Type</TableHead>
                    <TableHead className="min-w-[150px]">To</TableHead>
                    <TableHead className="min-w-[200px]">Subject</TableHead>
                    <TableHead className="min-w-[220px]">Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground align-top">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="secondary" className={statusBadgeClass(row.status)}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm align-top">{row.email_type || "general"}</TableCell>
                      <TableCell className="text-sm align-top break-all">{row.to_email || "-"}</TableCell>
                      <TableCell className="text-sm align-top max-w-[220px] break-words" title={row.subject}>{row.subject}</TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top max-w-[220px] break-words">
                        {row.error_message
                          ? `${row.failure_category ? `${row.failure_category}: ` : ""}${row.error_message}`
                          : row.needs_action
                            ? "Needs action"
                            : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="px-4 py-3 text-xs text-muted-foreground border-t">
              Showing {rows.length} entries{isFetching ? " (refreshing...)" : ""}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
