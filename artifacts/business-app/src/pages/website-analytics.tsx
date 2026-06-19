import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, BarChart3, LineChart, Funnel, MessageSquare, Globe2, Target, TrendingUp, CheckCircle2, Info } from "lucide-react";

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
  health?: {
    score: number;
    label: "Strong" | "Needs Attention" | "At Risk";
  };
  health_history?: Array<{
    week_start: string;
    score: number;
    label: "Strong" | "Needs Attention" | "At Risk";
  }>;
};

type BenchmarkStatus = "green" | "amber" | "red";

function SectionInfo({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Section information"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

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
  const healthHistory = Array.isArray(data.health_history) ? data.health_history : [];

  const pct = (numerator: number, denominator: number, precision = 1) => {
    if (denominator <= 0) return 0;
    const raw = (numerator / denominator) * 100;
    const factor = Math.pow(10, precision);
    return Math.round(raw * factor) / factor;
  };

  const safeNum = (n: number) => Number.isFinite(Number(n)) ? Number(n) : 0;

  const trafficToSubmissionRate = pct(summary.submissions_last_30_days, trafficSummary.page_views_last_30_days);
  const visitorToLeadRate = pct(summary.website_leads_last_30_days, trafficSummary.unique_visitors_last_30_days);
  const readOrConverted = safeNum(funnel.read) + safeNum(funnel.converted);
  const followUpProgressRate = pct(readOrConverted, safeNum(summary.total_submissions));
  const publishedCoverageRate = pct(summary.published_pages, Math.max(1, summary.total_pages));

  const last7 = daily.slice(-7).reduce((sum, d) => sum + safeNum(d.count), 0);
  const prev7 = daily.slice(-14, -7).reduce((sum, d) => sum + safeNum(d.count), 0);
  const trafficLast7 = dailyTraffic.slice(-7).reduce((sum, d) => sum + safeNum(d.count), 0);
  const trafficPrev7 = dailyTraffic.slice(-14, -7).reduce((sum, d) => sum + safeNum(d.count), 0);
  const submissionTrend7d = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : (last7 > 0 ? 100 : 0);
  const trafficTrend7d = trafficPrev7 > 0 ? Math.round(((trafficLast7 - trafficPrev7) / trafficPrev7) * 100) : (trafficLast7 > 0 ? 100 : 0);

  const benchmarkStatus = (value: number, good: number, ok: number, inverse = false): BenchmarkStatus => {
    if (!inverse) {
      if (value >= good) return "green";
      if (value >= ok) return "amber";
      return "red";
    }
    if (value <= good) return "green";
    if (value <= ok) return "amber";
    return "red";
  };

  const statusPoints = (status: BenchmarkStatus) => {
    if (status === "green") return 100;
    if (status === "amber") return 65;
    return 30;
  };

  const benchmarkRows = [
    {
      key: "visitors",
      label: "Unique Visitors (30d)",
      description: "Distinct people who visited your website in the last 30 days. This is your top-of-funnel audience size.",
      valueLabel: `${trafficSummary.unique_visitors_last_30_days}`,
      status: benchmarkStatus(trafficSummary.unique_visitors_last_30_days, 300, 120),
      weight: 15,
      targetLabel: "Target: 300+",
    },
    {
      key: "traffic_to_submission",
      label: "Traffic to Submission",
      description: "Percentage of page views that turned into a form submission. This reflects how well traffic converts into enquiries.",
      valueLabel: `${trafficToSubmissionRate}%`,
      status: benchmarkStatus(trafficToSubmissionRate, 1.5, 0.8),
      weight: 20,
      targetLabel: "Target: 1.5%+",
    },
    {
      key: "visitor_to_lead",
      label: "Visitor to Lead",
      description: "Percentage of unique visitors that became website leads. This helps judge visitor quality as well as conversion strength.",
      valueLabel: `${visitorToLeadRate}%`,
      status: benchmarkStatus(visitorToLeadRate, 2.0, 1.0),
      weight: 15,
      targetLabel: "Target: 2.0%+",
    },
    {
      key: "bounce",
      label: "Bounce Rate",
      description: "Share of sessions where visitors left without meaningful further interaction. Lower is generally better.",
      valueLabel: `${trafficSummary.bounce_rate_percent}%`,
      status: benchmarkStatus(trafficSummary.bounce_rate_percent, 50, 65, true),
      weight: 15,
      targetLabel: "Target: <= 50%",
    },
    {
      key: "pages_per_session",
      label: "Pages / Session",
      description: "Average number of pages viewed in each session. Higher values suggest stronger exploration and engagement.",
      valueLabel: `${trafficSummary.pages_per_session}`,
      status: benchmarkStatus(trafficSummary.pages_per_session, 1.8, 1.4),
      weight: 10,
      targetLabel: "Target: 1.8+",
    },
    {
      key: "follow_up",
      label: "Follow-up Progress",
      description: "Percentage of submissions that moved beyond new into read or converted. This measures lead handling discipline.",
      valueLabel: `${followUpProgressRate}%`,
      status: benchmarkStatus(followUpProgressRate, 75, 50),
      weight: 15,
      targetLabel: "Target: 75%+",
    },
    {
      key: "published_coverage",
      label: "Published Page Coverage",
      description: "Percentage of your total website pages that are live. Unpublished pages cannot attract traffic or leads.",
      valueLabel: `${publishedCoverageRate}%`,
      status: benchmarkStatus(publishedCoverageRate, 80, 50),
      weight: 10,
      targetLabel: "Target: 80%+",
    },
  ];

  const healthScore = Math.round(
    benchmarkRows.reduce((sum, row) => sum + (statusPoints(row.status) * row.weight) / 100, 0)
  );

  const effectiveHealthScore = Number(data.health?.score ?? healthScore);
  const healthLabel = (data.health?.label || (effectiveHealthScore >= 80 ? "Strong" : effectiveHealthScore >= 60 ? "Needs Attention" : "At Risk")) as "Strong" | "Needs Attention" | "At Risk";
  const historyDelta = healthHistory.length >= 2
    ? effectiveHealthScore - Number(healthHistory[0]?.score || effectiveHealthScore)
    : 0;

  const benchmarkBadge = (status: BenchmarkStatus) => {
    if (status === "green") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">On Track</Badge>;
    if (status === "amber") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Watch</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200">Critical</Badge>;
  };

  type FocusArea = {
    level: "high" | "medium" | "low";
    title: string;
    why: string;
    action: string;
    metric: string;
  };

  const focusAreas: FocusArea[] = [];

  if (summary.published_pages === 0) {
    focusAreas.push({
      level: "high",
      title: "Publish your core pages",
      why: "No pages are currently published, so search traffic and conversions are blocked.",
      action: "Publish Home, Services, About, and Contact pages first.",
      metric: `Published pages: ${summary.published_pages}/${summary.total_pages}`,
    });
  }

  if (summary.active_forms === 0) {
    focusAreas.push({
      level: "high",
      title: "No active lead capture forms",
      why: "Visitors cannot reliably convert without active forms.",
      action: "Enable at least one contact/quote form on high-traffic pages.",
      metric: `Active forms: ${summary.active_forms}`,
    });
  }

  if (trafficSummary.page_views_last_30_days >= 200 && trafficToSubmissionRate < 1.2) {
    focusAreas.push({
      level: "high",
      title: "Traffic is not converting",
      why: "You have meaningful visits but low submission volume.",
      action: "Improve CTA placement above the fold and shorten form fields.",
      metric: `Traffic→Submission: ${trafficToSubmissionRate}%`,
    });
  }

  if (trafficSummary.bounce_rate_percent >= 70) {
    focusAreas.push({
      level: "high",
      title: "High bounce rate",
      why: "Most visitors are leaving after minimal interaction.",
      action: "Tighten above-the-fold messaging and improve page load speed on top pages.",
      metric: `Bounce rate: ${trafficSummary.bounce_rate_percent}%`,
    });
  }

  if (trafficSummary.unique_visitors_last_30_days < 100) {
    focusAreas.push({
      level: "medium",
      title: "Top-of-funnel traffic is low",
      why: "Limited unique visitors caps lead volume regardless of conversion quality.",
      action: "Invest in local SEO pages, Google Business posts, and referral links.",
      metric: `Unique visitors (30d): ${trafficSummary.unique_visitors_last_30_days}`,
    });
  }

  if (safeNum(funnel.new) > 0 && safeNum(funnel.converted) === 0) {
    focusAreas.push({
      level: "medium",
      title: "Leads are not moving to converted",
      why: "New enquiries exist but none are marked converted.",
      action: "Set a same-day follow-up SLA and track read/converted status daily.",
      metric: `New: ${funnel.new} · Converted: ${funnel.converted}`,
    });
  }

  if (trafficSummary.pages_per_session < 1.4 && trafficSummary.sessions_last_30_days > 0) {
    focusAreas.push({
      level: "low",
      title: "Low page depth",
      why: "Visitors are not navigating deeper into service or trust pages.",
      action: "Add stronger internal links from top landing pages to service pages.",
      metric: `Pages/session: ${trafficSummary.pages_per_session}`,
    });
  }

  const topFocusAreas = focusAreas
    .sort((a, b) => {
      const score = { high: 3, medium: 2, low: 1 } as const;
      return score[b.level] - score[a.level];
    })
    .slice(0, 4);

  const positiveSignals = [
    summary.conversion_rate_percent >= 8 ? `Strong submission conversion (${summary.conversion_rate_percent}%)` : null,
    trafficTrend7d > 0 ? `Traffic up ${trafficTrend7d}% in the last 7 days` : null,
    submissionTrend7d > 0 ? `Submissions up ${submissionTrend7d}% in the last 7 days` : null,
    trafficSummary.bounce_rate_percent > 0 && trafficSummary.bounce_rate_percent < 50
      ? `Healthy bounce rate (${trafficSummary.bounce_rate_percent}%)`
      : null,
  ].filter((x): x is string => Boolean(x));

  const levelBadge = (level: FocusArea["level"]) => {
    if (level === "high") return <Badge className="bg-red-100 text-red-700 border-red-200">High Priority</Badge>;
    if (level === "medium") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Medium Priority</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Low Priority</Badge>;
  };

  const stats = [
    { label: "Submissions (30d)", value: summary.submissions_last_30_days, icon: MessageSquare, description: "All form submissions received from your website in the last 30 days." },
    { label: "Website Leads (30d)", value: summary.website_leads_last_30_days, icon: Globe2, description: "Leads attributed specifically to your website over the last 30 days." },
    { label: "Total Submissions", value: summary.total_submissions, icon: BarChart3, description: "Lifetime submission volume recorded across your website forms." },
    { label: "Conversion Rate", value: `${summary.conversion_rate_percent}%`, icon: Funnel, description: "Percentage of submissions that have been marked converted." },
  ];

  const trafficStats = [
    { label: "Hits (30d)", value: trafficSummary.page_views_last_30_days, icon: BarChart3, description: "Total page-view events across the last 30 days." },
    { label: "Users (30d)", value: trafficSummary.unique_visitors_last_30_days, icon: Globe2, description: "Distinct visitors who reached your site in the last 30 days." },
    { label: "Sessions (30d)", value: trafficSummary.sessions_last_30_days, icon: LineChart, description: "Visits grouped into browsing sessions rather than individual page hits." },
    { label: "Avg Time on Site", value: formatDuration(trafficSummary.avg_session_duration_seconds), icon: LineChart, description: "Average time visitors spend on your site before leaving." },
    { label: "Bounce Rate", value: `${trafficSummary.bounce_rate_percent}%`, icon: Funnel, description: "Share of sessions where visitors leave quickly without deeper engagement." },
    { label: "Pages / Session", value: trafficSummary.pages_per_session, icon: BarChart3, description: "Average number of pages viewed per visit." },
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
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">{s.label} <SectionInfo text={s.description} /></p>
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Website Health Score <SectionInfo text="A blended score based on traffic, conversion, engagement and lead handling benchmarks so you can gauge overall website effectiveness quickly." /></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-4xl font-bold">{effectiveHealthScore}<span className="text-base text-muted-foreground">/100</span></p>
              <p className="text-sm text-muted-foreground mt-1">Weighted score across traffic, conversion, engagement and lead handling.</p>
              <p className="text-xs text-muted-foreground mt-1">
                {historyDelta >= 0 ? "+" : ""}{historyDelta} vs first point in history
              </p>
            </div>
            <Badge className={effectiveHealthScore >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : effectiveHealthScore >= 60 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200"}>
              {healthLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {healthHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">Website Health Trend (Weekly) <SectionInfo text="Weekly snapshots of your website health score so you can see whether performance is improving or slipping over time." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-end gap-1">
              {healthHistory.map((point) => (
                <div key={point.week_start} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                  <div
                    className={`w-full rounded-t ${point.score >= 80 ? "bg-emerald-500/80" : point.score >= 60 ? "bg-amber-500/80" : "bg-red-500/80"}`}
                    style={{ height: `${Math.max(4, Math.round((Math.max(0, Math.min(100, point.score)) / 100) * 128))}px` }}
                    title={`${point.week_start}: ${point.score}/100`}
                  />
                  <span className="text-[10px] text-muted-foreground">{point.week_start.slice(5)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Stored weekly snapshots. Colors reflect benchmark status bands.</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">Traffic to Submission <SectionInfo text="Percentage of page views that became form submissions. This shows how well your site turns visits into enquiries." /></p>
            <p className="text-2xl font-bold">{trafficToSubmissionRate}%</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Target: 1.5%+</p>
              {benchmarkBadge(benchmarkStatus(trafficToSubmissionRate, 1.5, 0.8))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">Visitor to Lead <SectionInfo text="Percentage of unique visitors who became leads. This is a stricter conversion measure than raw page views." /></p>
            <p className="text-2xl font-bold">{visitorToLeadRate}%</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Target: 2.0%+</p>
              {benchmarkBadge(benchmarkStatus(visitorToLeadRate, 2.0, 1.0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">Submission Trend (7d) <SectionInfo text="Change in submission volume over the last 7 days compared with the previous 7-day period." /></p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <TrendingUp className={`w-4 h-4 ${submissionTrend7d >= 0 ? "text-emerald-600" : "text-red-600"}`} />
              {submissionTrend7d >= 0 ? "+" : ""}{submissionTrend7d}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs previous 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">Follow-up Progress <SectionInfo text="Share of total submissions that have moved beyond new into read or converted status." /></p>
            <p className="text-2xl font-bold">{followUpProgressRate}%</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Read or converted submissions</p>
              {benchmarkBadge(benchmarkStatus(followUpProgressRate, 75, 50))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">Benchmark Overview <SectionInfo text="Benchmark status for the main drivers of website performance, using target ranges to flag what is on track and what needs attention." /></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {benchmarkRows.map((row) => (
              <div key={row.key} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium flex items-center gap-2">{row.label} <SectionInfo text={row.description} /></p>
                  {benchmarkBadge(row.status)}
                </div>
                <p className="text-lg font-bold mt-2">{row.valueLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">{row.targetLabel}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" /> Focus Areas (What to Improve Next) <SectionInfo text="The highest-priority improvement opportunities detected from your traffic, conversion, engagement and follow-up data." /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topFocusAreas.length === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5" />
              <div>
                Core indicators look healthy right now. Keep iterating on top pages and forms to maintain momentum.
              </div>
            </div>
          )}
          {topFocusAreas.map((item) => (
            <div key={item.title} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold text-sm">{item.title}</p>
                {levelBadge(item.level)}
              </div>
              <p className="text-sm text-muted-foreground">{item.why}</p>
              <p className="text-sm"><span className="font-medium">Recommended action:</span> {item.action}</p>
              <p className="text-xs text-muted-foreground">{item.metric}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {positiveSignals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Positive Signals <SectionInfo text="Areas where your website is already performing well, so you know what to preserve and build on." /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {positiveSignals.map((signal) => (
                <div key={signal} className="text-sm rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2">
                  {signal}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {trafficStats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">{s.label} <SectionInfo text={s.description} /></p>
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
            <CardTitle className="text-base flex items-center gap-2"><LineChart className="w-4 h-4" /> Daily Submissions (Last 30 Days) <SectionInfo text="Day-by-day submission volume for the last 30 days so you can spot spikes, dips and patterns." /></CardTitle>
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
            <CardTitle className="text-base flex items-center gap-2">Submission Funnel <SectionInfo text="How submissions are distributed across statuses such as new, read, converted and spam." /></CardTitle>
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
            <CardTitle className="text-base flex items-center gap-2"><LineChart className="w-4 h-4" /> Daily Traffic (Last 30 Days) <SectionInfo text="Day-by-day website traffic over the last 30 days, based on recorded page hits." /></CardTitle>
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
            <CardTitle className="text-base flex items-center gap-2">Top Forms <SectionInfo text="Forms ranked by submission activity so you can see which lead capture points are performing best." /></CardTitle>
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
            <CardTitle className="text-base flex items-center gap-2">Lead Sources <SectionInfo text="Where website leads are coming from, based on the captured source attribution on submissions." /></CardTitle>
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
            <CardTitle className="text-base flex items-center gap-2">Traffic Channels <SectionInfo text="How visitors are finding your website, such as direct, search, social or referrals." /></CardTitle>
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
            <CardTitle className="text-base flex items-center gap-2">Top Pages by Hits <SectionInfo text="Your most-visited pages, helping identify which content attracts the most traffic." /></CardTitle>
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
          <CardTitle className="text-base flex items-center gap-2">Recent Submissions <SectionInfo text="Most recent website enquiries, including their status and contact details when captured." /></CardTitle>
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
