import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, LineChart, Funnel, MessageSquare, Globe2 } from "lucide-react";

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

type AnalyticsResponse = {
  summary?: {
    total_pages: number;
    published_pages: number;
    active_forms: number;
    total_submissions: number;
    submissions_last_30_days: number;
    website_leads_last_30_days: number;
    conversion_rate_percent: number;
  };
  traffic_summary?: {
    page_views_last_30_days: number;
    unique_visitors_last_30_days: number;
    sessions_last_30_days: number;
    avg_session_duration_seconds: number;
    bounce_rate_percent: number;
    pages_per_session: number;
  };
  funnel?: {
    new: number;
    read: number;
    converted: number;
    spam: number;
  };
  daily?: Array<{ date: string; count: number }>;
  daily_traffic?: Array<{ date: string; count: number }>;
  top_forms?: Array<{
    form_id: string;
    form_name: string;
    submissions: number;
    converted: number;
    conversion_rate: number;
  }>;
  top_pages?: Array<{ path: string; views: number }>;
  traffic_channels?: Array<{ channel: string; count: number }>;
  source_breakdown?: Array<{ source: string; count: number }>;
  recent_submissions?: Array<{
    id: string;
    created_at: string;
    status: string;
    form_name: string;
    name: string;
    email: string;
    phone: string;
  }>;
};

export default function WebsiteAnalytics() {
  const { data, isLoading, isError, error } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/website/analytics"],
    queryFn: () => apiFetch("/api/website/analytics"),
    refetchInterval: 60_000,
  });

  const maxDaily = useMemo(() => {
    const points = data?.daily || [];
    return Math.max(1, ...points.map((p) => p.count));
  }, [data?.daily]);

  const maxDailyTraffic = useMemo(() => {
    const points = data?.daily_traffic || [];
    return Math.max(1, ...points.map((p) => p.count));
  }, [data?.daily_traffic]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins <= 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {(error as Error)?.message || "Failed to load website analytics"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = {
    total_pages: 0,
    published_pages: 0,
    active_forms: 0,
    total_submissions: 0,
    submissions_last_30_days: 0,
    website_leads_last_30_days: 0,
    conversion_rate_percent: 0,
    ...(data.summary || {}),
  };

  const trafficSummary = {
    page_views_last_30_days: 0,
    unique_visitors_last_30_days: 0,
    sessions_last_30_days: 0,
    avg_session_duration_seconds: 0,
    bounce_rate_percent: 0,
    pages_per_session: 0,
    ...(data.traffic_summary || {}),
  };

  const funnel = {
    new: 0,
    read: 0,
    converted: 0,
    spam: 0,
    ...(data.funnel || {}),
  };

  const daily = Array.isArray(data.daily) ? data.daily : [];
  const dailyTraffic = Array.isArray(data.daily_traffic) ? data.daily_traffic : [];
  const topForms = Array.isArray(data.top_forms) ? data.top_forms : [];
  const topPages = Array.isArray(data.top_pages) ? data.top_pages : [];
  const trafficChannels = Array.isArray(data.traffic_channels) ? data.traffic_channels : [];
  const sourceBreakdown = Array.isArray(data.source_breakdown) ? data.source_breakdown : [];
  const recentSubmissions = Array.isArray(data.recent_submissions) ? data.recent_submissions : [];

  const stats = [
    { label: "Submissions (30d)", value: summary.submissions_last_30_days, icon: MessageSquare },
    { label: "Website Leads (30d)", value: summary.website_leads_last_30_days, icon: Globe2 },
    { label: "Total Submissions", value: summary.total_submissions, icon: BarChart3 },
    { label: "Conversion Rate", value: `${summary.conversion_rate_percent}%`, icon: Funnel },
  ];

  const trafficStats = [
    { label: "Hits (30d)", value: trafficSummary.page_views_last_30_days, icon: BarChart3 },
    { label: "Users (30d)", value: trafficSummary.unique_visitors_last_30_days, icon: Globe2 },
    { label: "Sessions (30d)", value: trafficSummary.sessions_last_30_days, icon: LineChart },
    { label: "Avg Time on Site", value: formatDuration(trafficSummary.avg_session_duration_seconds), icon: LineChart },
    { label: "Bounce Rate", value: `${trafficSummary.bounce_rate_percent}%`, icon: Funnel },
    { label: "Pages / Session", value: trafficSummary.pages_per_session, icon: BarChart3 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Website Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Track leads, form performance, and submission trends for your site.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">Pages: {summary.published_pages}/{summary.total_pages} published</Badge>
          <Badge variant="outline">Active Forms: {summary.active_forms}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {trafficStats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><LineChart className="w-4 h-4" /> Daily Submissions (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {daily.map((point) => (
                <div key={point.date} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${Math.max(4, Math.round((point.count / maxDaily) * 160))}px` }}
                    title={`${point.date}: ${point.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Hover bars for exact values.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submission Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["New", funnel.new, "bg-sky-500"],
              ["Read", funnel.read, "bg-indigo-500"],
              ["Converted", funnel.converted, "bg-emerald-500"],
              ["Spam", funnel.spam, "bg-slate-400"],
            ].map(([label, value, color]) => {
              const total = Math.max(1, summary.total_submissions);
              const pct = Math.round((Number(value) / total) * 100);
              return (
                <div key={String(label)}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{label}</span>
                    <span className="font-semibold">{value} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><LineChart className="w-4 h-4" /> Daily Traffic (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {dailyTraffic.map((point) => (
                <div key={point.date} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t bg-emerald-500/80"
                    style={{ height: `${Math.max(4, Math.round((point.count / maxDailyTraffic) * 160))}px` }}
                    title={`${point.date}: ${point.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Tracks real page hits from your website visitors.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Forms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topForms.length === 0 && <p className="text-sm text-muted-foreground">No form submissions yet.</p>}
              {topForms.map((form) => (
                <div key={form.form_id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{form.form_name}</p>
                    <p className="text-xs text-muted-foreground">{form.submissions} submissions</p>
                  </div>
                  <Badge variant="outline">{form.conversion_rate}% converted</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sourceBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No website lead sources captured yet.</p>}
              {sourceBreakdown.map((src) => (
                <div key={src.source} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <span className="capitalize">{src.source.replaceAll("_", " ")}</span>
                  <span className="font-semibold">{src.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traffic Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trafficChannels.length === 0 && <p className="text-sm text-muted-foreground">No traffic source data yet.</p>}
              {trafficChannels.map((src) => (
                <div key={src.channel} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <span className="capitalize">{src.channel}</span>
                  <span className="font-semibold">{src.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Pages by Hits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topPages.length === 0 && <p className="text-sm text-muted-foreground">No page hit data yet.</p>}
              {topPages.map((page) => (
                <div key={page.path} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <span className="truncate pr-3">{page.path}</span>
                  <span className="font-semibold shrink-0">{page.views}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentSubmissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            {recentSubmissions.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{s.form_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.name || "Unnamed"}
                    {s.email ? ` • ${s.email}` : ""}
                    {s.phone ? ` • ${s.phone}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{s.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
