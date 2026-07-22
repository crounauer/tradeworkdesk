import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MessageSquare, Loader2, Building2 } from "lucide-react";

type ModerationStatus = "open" | "reviewed" | "dismissed" | "actioned" | "all";

type PlatformCommunityReport = {
  id: string;
  tenant_id: string;
  post_id: string;
  reason: string;
  status: Exclude<ModerationStatus, "all">;
  created_at: string;
  tenant?: { id: string; company_name: string | null } | null;
  thread?: { id: string; title: string; category_id: string } | null;
  post?: { id: string; body: string; thread_id: string; author_id: string } | null;
  author?: { id: string; full_name: string | null; role: string | null } | null;
};

type TenantOption = {
  id: string;
  company_name: string | null;
};

const FILTERS: Array<{ value: ModerationStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Reviewed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "actioned", label: "Actioned" },
  { value: "all", label: "All" },
];

export default function PlatformCommunityPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ModerationStatus>("open");
  const [selectedTenantId, setSelectedTenantId] = useState("");

  const openTenantCommunity = (tenantId: string) => {
    if (!tenantId) return;
    localStorage.removeItem("superadmin_readonly_tenant_id");
    localStorage.setItem("superadmin_community_tenant_id", tenantId);
    window.location.href = "/community";
  };

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<TenantOption[]>({
    queryKey: ["platform-community-tenants"],
    queryFn: async () => {
      const res = await fetch("/api/platform/tenants");
      if (!res.ok) throw new Error("Failed to load tenants");
      const rows = await res.json() as Array<{ id?: unknown; company_name?: unknown }>;
      return rows
        .map((row) => ({
          id: String(row.id || ""),
          company_name: row.company_name == null ? null : String(row.company_name),
        }))
        .filter((row) => row.id.length > 0);
    },
  });

  const { data: reports = [], isLoading } = useQuery<PlatformCommunityReport[]>({
    queryKey: ["platform-community-reports", filter],
    queryFn: async () => {
      const res = await fetch(`/api/platform/community/reports?status=${filter}`);
      if (!res.ok) throw new Error("Failed to load community reports");
      return res.json();
    },
  });

  const { data: allReports = [] } = useQuery<PlatformCommunityReport[]>({
    queryKey: ["platform-community-reports", "all"],
    queryFn: async () => {
      const res = await fetch("/api/platform/community/reports?status=all");
      if (!res.ok) throw new Error("Failed to load report counts");
      return res.json();
    },
  });

  const counts = useMemo(() => {
    const out: Record<ModerationStatus, number> = {
      open: 0,
      reviewed: 0,
      dismissed: 0,
      actioned: 0,
      all: allReports.length,
    };
    for (const report of allReports) {
      out[report.status] += 1;
    }
    return out;
  }, [allReports]);

  const tenantOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const tenant of tenants) {
      byId.set(tenant.id, tenant.company_name?.trim() || tenant.id);
    }
    for (const report of allReports) {
      if (!byId.has(report.tenant_id)) {
        byId.set(report.tenant_id, report.tenant?.company_name?.trim() || report.tenant_id);
      }
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tenants, allReports]);

  const updateMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: Exclude<ModerationStatus, "all"> }) => {
      const res = await fetch(`/api/platform/community/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to update report");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-community-reports"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />Platform Community
        </h1>
        <p className="text-muted-foreground mt-1">Review and moderate all tenant community reports from superadmin.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant Community Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose a tenant to use Community with the same functionality as a tenant user.
          </p>
          <div className="space-y-1.5">
            <Label>Tenant</Label>
            <select
              className="h-9 w-full rounded border px-2 text-sm"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              disabled={tenantsLoading}
            >
              <option value="">Select tenant</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </div>
          <Button type="button" disabled={!selectedTenantId} onClick={() => openTenantCommunity(selectedTenantId)}>
            Open Tenant Community
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Moderation Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                onClick={() => setFilter(item.value)}
              >
                {item.label} ({counts[item.value] ?? 0})
              </Button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports for this filter.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-100 text-amber-700">{report.reason}</Badge>
                      <Badge variant="outline">{report.status}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {report.tenant?.company_name || report.tenant_id}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</span>
                  </div>

                  <p className="text-sm font-medium">{report.thread?.title || "Thread unavailable"}</p>
                  <p className="text-sm text-muted-foreground line-clamp-3">{report.post?.body || "Post unavailable"}</p>
                  <p className="text-xs text-muted-foreground">
                    Author: {report.author?.full_name?.trim() || "Community Member"}
                    {report.author?.role ? ` (${report.author.role})` : ""}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ reportId: report.id, status: "reviewed" })}
                    >
                      Mark Reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ reportId: report.id, status: "dismissed" })}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ reportId: report.id, status: "actioned" })}
                    >
                      Mark Actioned
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openTenantCommunity(report.tenant_id)}
                    >
                      Open Tenant Community
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
