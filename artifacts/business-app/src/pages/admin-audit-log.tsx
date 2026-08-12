import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Clock3, Loader2, UserRound } from "lucide-react";

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

type AuditActor = {
  id: string;
  full_name: string;
  email: string | null;
};

function toTitleCaseFromSnakeCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toReadableDetail(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)))
      .join(", ");
  }
  return JSON.stringify(value);
}

export default function AdminAuditLog() {
  const [eventFilter, setEventFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const queryKey = useMemo(() => ["admin-audit-log", eventFilter, actorFilter, page], [eventFilter, actorFilter, page]);

  const { data: actors = [] } = useQuery<AuditActor[]>({
    queryKey: ["admin-audit-actors"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return [];
      const users = (await res.json()) as Array<{ id: string; full_name?: string | null; email?: string | null }>;
      return users
        .map((u) => ({
          id: u.id,
          full_name: (u.full_name || "").trim(),
          email: u.email || null,
        }))
        .sort((a, b) => {
          const aLabel = a.full_name || a.email || "";
          const bLabel = b.full_name || b.email || "";
          return aLabel.localeCompare(bLabel);
        });
    },
  });

  const { data, isLoading, isError, error } = useQuery<AuditEntry[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));
      if (eventFilter.trim()) params.set("event_type", eventFilter.trim());
      if (actorFilter !== "all") params.set("actor_id", actorFilter);
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
      <div className="space-y-1">
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Audit Trail</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Tenant-level activity history for admins, office staff and technicians.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs
            value={actorFilter}
            onValueChange={(value) => {
              setActorFilter(value);
              setPage(0);
            }}
          >
            <TabsList className="flex w-full flex-wrap justify-start gap-2 p-1 overflow-x-auto">
              <TabsTrigger value="all" className="min-w-[110px] flex-1 sm:flex-none">All Users</TabsTrigger>
              {actors.map((actor) => (
                <TabsTrigger key={actor.id} value={actor.id} className="min-w-[110px] flex-1 sm:flex-none">
                  {actor.full_name || actor.email || "Unknown"}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Input
            className="w-full"
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
                <div key={row.id} className="border rounded-xl p-4 bg-card/60">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                        {toTitleCaseFromSnakeCase(row.event_type)}
                      </Badge>
                      {row.actor_role && (
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {row.actor_role.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5" />
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 break-words">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Actor</p>
                      <p className="mt-1 text-foreground inline-flex items-center gap-1.5 break-all">
                        <UserRound className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="break-all">{row.actor_email || "System"}</span>
                      </p>
                    </div>

                    <div className="rounded-lg border bg-muted/30 px-3 py-2 break-words">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Entity</p>
                      <p className="mt-1 text-foreground break-all">
                        {row.entity_type ? toTitleCaseFromSnakeCase(row.entity_type) : "-"}
                        {row.entity_id ? ` #${row.entity_id}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Details</p>
                    {row.detail && Object.keys(row.detail).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(row.detail).map(([key, value]) => (
                          <div key={key} className="rounded-md border bg-background px-2.5 py-1.5 text-[11px] text-foreground break-words max-w-full">
                            <span className="font-medium text-muted-foreground">{toTitleCaseFromSnakeCase(key)}:</span>{" "}
                            <span className="break-all">{toReadableDetail(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No additional detail on this event.</p>
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
