import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type AuditEntry = {
  id: string;
  event_type: string;
  actor_email: string | null;
  actor_role: string | null;
  entity_type: string | null;
  entity_id: string | null;
  detail?: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminAuditLog() {
  const [eventFilter, setEventFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const queryKey = useMemo(() => ["admin-audit-log", eventFilter, page], [eventFilter, page]);

  const { data, isLoading, isError, error } = useQuery<AuditEntry[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));
      if (eventFilter.trim()) params.set("event_type", eventFilter.trim());
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to load audit log");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          {(error as Error)?.message || "Failed to load audit log"}
        </CardContent>
      </Card>
    );
  }

  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Audit Trail</h1>
        <p className="text-muted-foreground">Tenant-level activity history for admins, office staff and technicians.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Filter by event type (e.g. user_updated)"
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries found</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-medium text-sm">{row.event_type.replace(/_/g, " ")}</p>
                    <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <p>Actor: {row.actor_email || "Unknown"} {row.actor_role ? `(${row.actor_role})` : ""}</p>
                    <p>Entity: {row.entity_type || "-"} {row.entity_id ? `#${row.entity_id}` : ""}</p>
                    {row.detail && Object.keys(row.detail).length > 0 && (
                      <pre className="mt-2 p-2 bg-slate-50 rounded border overflow-auto text-[11px]">{JSON.stringify(row.detail, null, 2)}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <button
              className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <button
              className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
              disabled={rows.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
