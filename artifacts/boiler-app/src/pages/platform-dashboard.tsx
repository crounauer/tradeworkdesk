import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, Clock } from "lucide-react";
import { Link } from "wouter";

export default function PlatformDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: recentAudit } = useQuery({
    queryKey: ["platform-audit-recent"],
    queryFn: async () => {
      const res = await fetch("/api/platform/audit-log?limit=10");
      if (!res.ok) throw new Error("Failed to load audit log");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overview of all tenants and platform health</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_tenants || 0}</p>
                <p className="text-sm text-muted-foreground">Total Companies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.active_tenants || 0}</p>
                <p className="text-sm text-muted-foreground">Active Subscriptions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.trial_tenants || 0}</p>
                <p className="text-sm text-muted-foreground">On Trial</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/platform/tenants" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm">Manage Companies</p>
              <p className="text-xs text-muted-foreground">View, edit, and manage all tenant companies</p>
            </Link>
            <Link href="/platform/plans" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm">Pricing Plans</p>
              <p className="text-xs text-muted-foreground">Configure subscription tiers and features</p>
            </Link>
            <Link href="/platform/announcements" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm">Announcements</p>
              <p className="text-xs text-muted-foreground">Send platform-wide notifications</p>
            </Link>
            <Link href="/platform/plans" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" /> Plans ({stats?.plans?.length || 0})</p>
              <p className="text-xs text-muted-foreground">Manage pricing tiers</p>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentAudit || recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentAudit.slice(0, 8).map((entry: { id: string; event_type: string; actor_email: string; created_at: string; detail?: Record<string, unknown> }) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.event_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actor_email} &middot; {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
