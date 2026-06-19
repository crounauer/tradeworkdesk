import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, Target, CheckCircle2, TrendingUp } from "lucide-react";

export default function PlatformMarketingAnalytics() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["platform-marketing-analytics-page"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats/marketing");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to load marketing analytics");
      }
      return res.json() as Promise<Record<string, unknown>>;
    },
    refetchInterval: 60_000,
  });

  const safeSummary = (data?.summary && typeof data.summary === "object")
    ? (data.summary as Record<string, unknown>)
    : {};
  const safeDaily = Array.isArray(data?.daily)
    ? data.daily.filter((d): d is { date: string; signups: number; paid_conversions: number } => {
      return !!d && typeof d.date === "string" && typeof d.signups === "number" && typeof d.paid_conversions === "number";
    })
    : [];
  const safeSources = Array.isArray(data?.source_breakdown_last_30_days)
    ? data.source_breakdown_last_30_days.filter((d): d is { source: string; count: number } => !!d && typeof d.source === "string" && typeof d.count === "number")
    : [];
  const safeRecent = Array.isArray(data?.recent_signups)
    ? data.recent_signups.filter((s): s is { id: string; company_name: string; source: string; status: string; created_at: string; converted: boolean } => {
      return !!s && typeof s.id === "string" && typeof s.source === "string" && typeof s.status === "string" && typeof s.created_at === "string";
    })
    : [];

  const maxDaily = Math.max(1, ...safeDaily.map((d) => Math.max(d.signups, d.paid_conversions)));
  const maxSource = Math.max(1, ...safeSources.map((d) => d.count));
  const hasDailyValues = safeDaily.some((d) => d.signups > 0 || d.paid_conversions > 0);
  const tickStep = safeDaily.length > 0 ? Math.max(1, Math.ceil(safeDaily.length / 8)) : 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-bold">Marketing Analytics</h1>
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {(error as Error)?.message || "Failed to load marketing analytics"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Marketing Analytics</h1>
        <p className="text-muted-foreground">Acquisition, conversion and funnel performance across all tenants.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Sign-ups (30d)</div><p className="text-2xl font-bold">{Number(safeSummary.signups_last_30_days ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><Target className="w-4 h-4" />Paid Conversions (30d)</div><p className="text-2xl font-bold">{Number(safeSummary.paid_conversions_last_30_days ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4" />Signup to Paid</div><p className="text-2xl font-bold">{Number(safeSummary.signup_to_paid_rate_last_30_days_percent ?? 0)}%</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Beta Invite Use</div><p className="text-2xl font-bold">{Number(safeSummary.beta_invite_acceptance_rate_percent ?? 0)}%</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Funnel Trend (30 Days)</CardTitle></CardHeader>
          <CardContent>
            {safeDaily.length === 0 || !hasDailyValues ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="flex items-end gap-1 h-44">
                {safeDaily.map((d, idx) => {
                  const signupsH = Math.max(2, (d.signups / maxDaily) * 128);
                  const convertedH = Math.max(2, (d.paid_conversions / maxDaily) * 128);
                  const showTick = idx % tickStep === 0 || idx === safeDaily.length - 1;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-[132px] flex items-end justify-center gap-[2px]">
                        <div className="w-[45%] bg-blue-500/85 rounded-t-sm" style={{ height: `${signupsH}px` }} />
                        <div className="w-[45%] bg-emerald-500/90 rounded-t-sm" style={{ height: `${convertedH}px` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground h-3 leading-none whitespace-nowrap">
                        {showTick ? d.date.slice(5) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Acquisition Sources (30 Days)</CardTitle></CardHeader>
          <CardContent>
            {safeSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source data available</p>
            ) : (
              <div className="space-y-3">
                {safeSources.map((row) => (
                  <div key={row.source}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize">{row.source.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.max(4, (row.count / maxSource) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Marketing Sign-ups</CardTitle></CardHeader>
        <CardContent>
          {safeRecent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent sign-ups</p>
          ) : (
            <div className="space-y-3">
              {safeRecent.map((signup) => (
                <div key={signup.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{signup.company_name || "Untitled company"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{String(signup.source || "unknown").replace(/_/g, " ")} · {new Date(signup.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${signup.converted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {signup.converted ? "Paid" : String(signup.status || "trial")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
