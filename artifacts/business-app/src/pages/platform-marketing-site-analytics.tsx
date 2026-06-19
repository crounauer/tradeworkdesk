import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe2, TrendingUp, BarChart3 } from "lucide-react";

type MarketingSiteResponse = {
  summary?: {
    page_views_last_30_days: number;
    unique_visitors_last_30_days: number;
    traffic_last_7_days: number;
    traffic_prev_7_days: number;
    growth_7d_percent: number;
  };
  daily?: Array<{ date: string; count: number }>;
  channel_breakdown?: Array<{ channel: string; count: number }>;
  top_pages?: Array<{ path: string; views: number }>;
};

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function PlatformMarketingSiteAnalytics() {
  const { data, isLoading, isError, error } = useQuery<MarketingSiteResponse>({
    queryKey: ["platform-marketing-site-analytics"],
    queryFn: () => apiFetch("/api/platform/stats/marketing-site"),
    refetchInterval: 60_000,
  });

  const summary = {
    page_views_last_30_days: 0,
    unique_visitors_last_30_days: 0,
    traffic_last_7_days: 0,
    traffic_prev_7_days: 0,
    growth_7d_percent: 0,
    ...(data?.summary || {}),
  };

  const daily = Array.isArray(data?.daily) ? data.daily : [];
  const channels = Array.isArray(data?.channel_breakdown) ? data.channel_breakdown : [];
  const topPages = Array.isArray(data?.top_pages) ? data.top_pages : [];
  const maxDaily = Math.max(1, ...daily.map((d) => d.count || 0));
  const maxChannel = Math.max(1, ...channels.map((c) => c.count || 0));
  const hasDailyTraffic = daily.some((d) => d.count > 0);
  const tickStep = daily.length > 0 ? Math.max(1, Math.ceil(daily.length / 8)) : 1;

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
          {(error as Error)?.message || "Failed to load marketing site analytics"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4" />Views (30d)</div><p className="text-2xl font-bold">{Number(summary.page_views_last_30_days).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><Globe2 className="w-4 h-4" />Unique Visitors (30d)</div><p className="text-2xl font-bold">{Number(summary.unique_visitors_last_30_days).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" />7d Growth</div><p className="text-2xl font-bold">{summary.growth_7d_percent >= 0 ? "+" : ""}{summary.growth_7d_percent}%</p><p className="text-xs text-muted-foreground mt-1">{summary.traffic_last_7_days} vs {summary.traffic_prev_7_days}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Traffic Trend (30 Days)</CardTitle></CardHeader>
          <CardContent>
            {daily.length === 0 || !hasDailyTraffic ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="flex items-end gap-1 h-44">
                {daily.map((d, idx) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-500/80 rounded-t-sm" style={{ height: `${Math.max(2, (d.count / maxDaily) * 132)}px` }} />
                    <span className="text-[10px] text-muted-foreground h-3 leading-none whitespace-nowrap">
                      {idx % tickStep === 0 || idx === daily.length - 1 ? d.date.slice(5) : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Traffic Channels</CardTitle></CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel data available</p>
            ) : (
              <div className="space-y-3">
                {channels.map((row) => (
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
        <CardHeader><CardTitle className="text-base">Top Marketing Pages</CardTitle></CardHeader>
        <CardContent>
          {topPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No page data yet</p>
          ) : (
            <div className="space-y-2">
              {topPages.map((row) => (
                <div key={row.path} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <span className="truncate pr-3">{row.path}</span>
                  <span className="font-semibold shrink-0">{row.views}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
