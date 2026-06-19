import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe2, BarChart3, Target, CheckCircle2, TrendingUp } from "lucide-react";

type PlatformWebsiteAnalyticsResponse = {
  summary?: {
    websites_total: number;
    websites_published: number;
    active_forms: number;
    page_views_last_30_days: number;
    unique_visitors_last_30_days: number;
    submissions_last_30_days: number;
    converted_last_30_days: number;
    traffic_to_submission_rate_percent: number;
    submission_to_converted_rate_percent: number;
  };
  channel_breakdown?: Array<{ channel: string; count: number }>;
  daily_traffic?: Array<{ date: string; count: number }>;
  top_websites?: Array<{
    website_id: string;
    website_name: string;
    tenant_id: string;
    tenant_name: string;
    status: string;
    page_views_30d: number;
    unique_visitors_30d: number;
    submissions_30d: number;
    converted_30d: number;
    conversion_rate_percent: number;
    submission_to_converted_rate_percent: number;
  }>;
};

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function PlatformWebsiteAnalytics() {
  const { data, isLoading, isError, error } = useQuery<PlatformWebsiteAnalyticsResponse>({
    queryKey: ["platform-website-analytics"],
    queryFn: () => apiFetch("/api/platform/stats/websites"),
    refetchInterval: 60_000,
  });

  const summary = {
    websites_total: 0,
    websites_published: 0,
    active_forms: 0,
    page_views_last_30_days: 0,
    unique_visitors_last_30_days: 0,
    submissions_last_30_days: 0,
    converted_last_30_days: 0,
    traffic_to_submission_rate_percent: 0,
    submission_to_converted_rate_percent: 0,
    ...(data?.summary || {}),
  };

  const channelBreakdown = Array.isArray(data?.channel_breakdown) ? data.channel_breakdown : [];
  const dailyTraffic = Array.isArray(data?.daily_traffic) ? data.daily_traffic : [];
  const topWebsites = Array.isArray(data?.top_websites) ? data.top_websites : [];
  const maxDailyTraffic = Math.max(1, ...dailyTraffic.map((d) => d.count || 0));
  const maxChannel = Math.max(1, ...channelBreakdown.map((c) => c.count || 0));

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
        <h1 className="text-2xl font-display font-bold">Website Analytics</h1>
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {(error as Error)?.message || "Failed to load website analytics"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Tenant Website Analytics</h1>
        <p className="text-muted-foreground">Platform-wide website traffic, conversion and channel performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><Globe2 className="w-4 h-4" />Websites</div><p className="text-2xl font-bold">{summary.websites_total}</p><p className="text-xs text-muted-foreground mt-1">{summary.websites_published} published</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4" />Page Views (30d)</div><p className="text-2xl font-bold">{Number(summary.page_views_last_30_days).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Visitors (30d)</div><p className="text-2xl font-bold">{Number(summary.unique_visitors_last_30_days).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><Target className="w-4 h-4" />Traffic to Submission</div><p className="text-2xl font-bold">{Number(summary.traffic_to_submission_rate_percent)}%</p><p className="text-xs text-muted-foreground mt-1">{summary.submissions_last_30_days} submissions</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Submission to Converted</div><p className="text-2xl font-bold">{Number(summary.submission_to_converted_rate_percent)}%</p><p className="text-xs text-muted-foreground mt-1">{summary.converted_last_30_days} converted</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Traffic Trend (30 Days)</CardTitle></CardHeader>
          <CardContent>
            {dailyTraffic.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="flex items-end gap-1 h-44">
                {dailyTraffic.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-500/80 rounded-t-sm" style={{ height: `${Math.max(2, (d.count / maxDailyTraffic) * 132)}px` }} />
                    <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Traffic Channels</CardTitle></CardHeader>
          <CardContent>
            {channelBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel data available</p>
            ) : (
              <div className="space-y-3">
                {channelBreakdown.map((row) => (
                  <div key={row.channel}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize">{row.channel}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.max(4, (row.count / maxChannel) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top Websites (By Traffic)</CardTitle></CardHeader>
        <CardContent>
          {topWebsites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No website activity found</p>
          ) : (
            <div className="space-y-3">
              {topWebsites.map((w) => (
                <div key={w.website_id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-sm">{w.website_name}</p>
                      <p className="text-xs text-muted-foreground">{w.tenant_name}</p>
                    </div>
                    <Badge variant={w.status === "published" ? "default" : "secondary"}>{w.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Views</p><p className="font-semibold">{w.page_views_30d}</p></div>
                    <div><p className="text-xs text-muted-foreground">Visitors</p><p className="font-semibold">{w.unique_visitors_30d}</p></div>
                    <div><p className="text-xs text-muted-foreground">Submissions</p><p className="font-semibold">{w.submissions_30d}</p></div>
                    <div><p className="text-xs text-muted-foreground">Traffic→Sub</p><p className="font-semibold">{w.conversion_rate_percent}%</p></div>
                    <div><p className="text-xs text-muted-foreground">Sub→Conv</p><p className="font-semibold">{w.submission_to_converted_rate_percent}%</p></div>
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
