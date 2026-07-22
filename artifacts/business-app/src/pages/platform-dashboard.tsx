import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, CreditCard, Clock, DollarSign, TrendingUp, Mail, Loader2, CheckCircle2, Globe, BarChart3, Target, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";

type HealthStatus = "healthy" | "degraded" | "down";

type TimedCheck = {
  ok: boolean;
  latency_ms: number;
  status_code?: number;
  error?: string;
};

type PlatformServiceHealth = {
  provider: "fly" | "vercel" | "supabase";
  status: HealthStatus;
  checks: Record<string, TimedCheck>;
  details?: Record<string, unknown>;
};

type PlatformHealthResponse = {
  checked_at: string;
  overall_status: HealthStatus;
  services: Record<string, PlatformServiceHealth>;
  issues: Array<{ service: string; check: string; error: string; status_code?: number }>;
};

function statusPillClass(status: HealthStatus): string {
  if (status === "healthy") return "bg-emerald-100 text-emerald-700";
  if (status === "degraded") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

const EMAIL_TEMPLATES = [
  { value: "welcome", label: "Welcome (new account)" },
  { value: "invoice", label: "Invoice / payment received" },
  { value: "trial_expiry", label: "Trial expiry reminder" },
  { value: "renewal_reminder", label: "Renewal reminder" },
  { value: "payment_failed", label: "Payment failed" },
];

export default function PlatformDashboard() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [emailTemplate, setEmailTemplate] = useState("welcome");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [indexNowSubmitted, setIndexNowSubmitted] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: mrrData } = useQuery({
    queryKey: ["platform-mrr"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats/mrr");
      if (!res.ok) return { mrr: 0 };
      return res.json();
    },
  });

  const { data: signupData } = useQuery({
    queryKey: ["platform-signups"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats/signups");
      if (!res.ok) return [];
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

  const { data: marketingData } = useQuery({
    queryKey: ["platform-marketing-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats/marketing");
      if (!res.ok) throw new Error("Failed to load marketing analytics");
      return res.json();
    },
  });

  const { data: platformHealth, isLoading: healthLoading } = useQuery<PlatformHealthResponse>({
    queryKey: ["platform-health"],
    queryFn: async () => {
      const res = await fetch("/api/platform/health");
      if (!res.ok) throw new Error("Failed to load platform health");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const indexNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/indexnow/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; upstreamStatus?: number; upstreamBody?: string | null; submitted?: number };
      if (!res.ok) {
        const statusPart = data.upstreamStatus ? ` (upstream ${data.upstreamStatus})` : "";
        const bodyPart = data.upstreamBody ? `: ${String(data.upstreamBody).slice(0, 160)}` : "";
        throw new Error(`${data.error || "Failed to submit"}${statusPart}${bodyPart}`);
      }
      return data;
    },
    onSuccess: (data) => {
      setIndexNowSubmitted(true);
      toast({ title: "IndexNow submitted", description: `${data.submitted} URLs submitted for indexing` });
      setTimeout(() => setIndexNowSubmitted(false), 5000);
    },
    onError: (e) => toast({ title: "IndexNow failed", description: e.message, variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!emailRecipient) throw new Error("Recipient email is required");
      const res = await fetch("/api/platform/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: emailTemplate, to: emailRecipient }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({ title: "Test email sent", description: `Sent "${emailTemplate}" template to ${emailRecipient}` });
      setTimeout(() => setEmailSent(false), 3000);
    },
    onError: (e) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const safeSignupData = Array.isArray(signupData)
    ? signupData.filter((d): d is { month: string; count: number } => !!d && typeof d.month === "string" && typeof d.count === "number")
    : [];

  const safeRecentAudit = Array.isArray(recentAudit)
    ? recentAudit.filter((entry): entry is { id: string; event_type: string; actor_email: string; created_at: string; detail?: Record<string, unknown> } => {
      return !!entry && typeof entry.id === "string" && typeof entry.event_type === "string" && typeof entry.actor_email === "string" && typeof entry.created_at === "string";
    })
    : [];

  const safeMarketingData = marketingData && typeof marketingData === "object" ? marketingData as Record<string, unknown> : {};
  const safeMarketingSummary = (safeMarketingData.summary && typeof safeMarketingData.summary === "object")
    ? safeMarketingData.summary as Record<string, unknown>
    : {};
  const safeMarketingDaily = Array.isArray(safeMarketingData.daily)
    ? safeMarketingData.daily.filter((d): d is { date: string; signups: number; paid_conversions: number } => {
      return !!d && typeof d.date === "string" && typeof d.signups === "number" && typeof d.paid_conversions === "number";
    })
    : [];
  const safeMarketingSource = Array.isArray(safeMarketingData.source_breakdown_last_30_days)
    ? safeMarketingData.source_breakdown_last_30_days.filter((d): d is { source: string; count: number } => !!d && typeof d.source === "string" && typeof d.count === "number")
    : [];
  const safeMarketingRecentSignups = Array.isArray(safeMarketingData.recent_signups)
    ? safeMarketingData.recent_signups.filter((s): s is { id: string; company_name: string; source: string; status: string; created_at: string; converted: boolean } => {
      return !!s && typeof s.id === "string" && typeof s.source === "string" && typeof s.status === "string" && typeof s.created_at === "string";
    })
    : [];
  const safeMarketingBetaInvites = (safeMarketingData.beta_invites && typeof safeMarketingData.beta_invites === "object")
    ? safeMarketingData.beta_invites as Record<string, unknown>
    : {};

  const maxSignups = Math.max(1, ...safeSignupData.map((d) => d.count));
  const marketingDaily = safeMarketingDaily;
  const marketingSource = safeMarketingSource;
  const maxMarketingDaily = Math.max(1, ...marketingDaily.map((d) => Math.max(d.signups || 0, d.paid_conversions || 0)));
  const maxMarketingSource = Math.max(1, ...marketingSource.map((d) => d.count || 0));

  const superuserMenuItems = [
    { href: "/platform/support-tickets", label: "Support Tickets" },
    { href: "/superadmin/db-housekeeping", label: "DB Housekeeping" },
    { href: "/superadmin/templates/conversions/pending", label: "Template Conversions" },
    { href: "/platform/audit-log", label: "Audit Log" },
    { href: "/platform/analytics", label: "Analytics" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overview of all tenants and platform health</p>
      </div>

      <Card className="sticky top-4 z-20 border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <CardHeader>
          <CardTitle className="text-base">Superuser Menu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {superuserMenuItems.map((item) => {
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant={isActive ? "default" : "outline"} size="sm">{item.label}</Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <p className="text-sm text-muted-foreground">Active</p>
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
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mrrData?.mrr != null ? `$${Number(mrrData.mrr).toLocaleString()}` : "$0"}</p>
                <p className="text-sm text-muted-foreground">MRR</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Platform Health (Fly / Vercel / Supabase)
          </CardTitle>
          <div className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusPillClass(platformHealth?.overall_status || "down")}`}>
            {healthLoading ? "Checking..." : (platformHealth?.overall_status || "unknown")}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { key: "twd_job_management", label: "TWD Job Management" },
              { key: "tenant_websites", label: "Tenant Websites" },
              { key: "marketing_site", label: "Marketing Site" },
              { key: "supabase", label: "Supabase" },
            ].map((service) => {
              const data = platformHealth?.services?.[service.key];
              const checks = Object.values(data?.checks || {});
              const avgLatency = checks.length > 0
                ? Math.round(checks.reduce((sum, c) => sum + (c.latency_ms || 0), 0) / checks.length)
                : null;
              return (
                <div key={service.key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-medium">{service.label}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusPillClass(data?.status || "down")}`}>
                      {data?.status || "unknown"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Provider: {data?.provider || "n/a"}</p>
                  <p className="text-xs text-muted-foreground">Avg latency: {avgLatency != null ? `${avgLatency}ms` : "n/a"}</p>
                </div>
              );
            })}
          </div>

          {platformHealth?.issues?.length ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-red-700">Open Health Issues</p>
              {platformHealth.issues.slice(0, 6).map((issue, idx) => (
                <p key={`${issue.service}-${issue.check}-${idx}`} className="text-xs text-red-700">
                  {issue.service} / {issue.check}: {issue.error}{issue.status_code ? ` (HTTP ${issue.status_code})` : ""}
                </p>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-700">No active issues detected.</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Last checked: {platformHealth?.checked_at ? new Date(platformHealth.checked_at).toLocaleString() : "—"}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Sign-ups (Last 12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {safeSignupData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {safeSignupData.map((d) => (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{d.count > 0 ? d.count : ""}</span>
                    <div
                      className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(2, (d.count / maxSignups) * 120)}px` }}
                    />
                    <span className="text-[10px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap">
                      {d.month.substring(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/platform/tenants" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm">Manage Companies</p>
              <p className="text-xs text-muted-foreground">View, edit, and manage all tenant companies</p>
            </Link>
            <Link href="/platform/addons" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pricing & Add-ons</p>
              <p className="text-xs text-muted-foreground">Manage base plan and add-on packages</p>
            </Link>
            <Link href="/platform/announcements" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm">Announcements</p>
              <p className="text-xs text-muted-foreground">Send platform-wide notifications</p>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {safeRecentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {safeRecentAudit.slice(0, 8).map((entry) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Send Test Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Template</Label>
              <select
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EMAIL_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Recipient email</Label>
              <Input
                type="email"
                placeholder="test@example.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending || !emailRecipient || emailSent}
            >
              {sendEmailMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
              ) : emailSent ? (
                <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />Sent!</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />Send Test Email</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Sends a sample email using the selected template. Uses placeholder data.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <UserPlus className="w-4 h-4" />
              Sign-ups (30d)
            </div>
            <p className="text-2xl font-bold">{Number(safeMarketingSummary.signups_last_30_days ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{Number(safeMarketingSummary.signups_last_7_days ?? 0)} in last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              Paid Conversions (30d)
            </div>
            <p className="text-2xl font-bold">{Number(safeMarketingSummary.paid_conversions_last_30_days ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{Number(safeMarketingSummary.paid_conversions_last_7_days ?? 0)} in last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <BarChart3 className="w-4 h-4" />
              Signup to Paid Rate
            </div>
            <p className="text-2xl font-bold">{Number(safeMarketingSummary.signup_to_paid_rate_last_30_days_percent ?? 0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Trailing 30 day conversion rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <CheckCircle2 className="w-4 h-4" />
              Beta Invite Use Rate
            </div>
            <p className="text-2xl font-bold">{Number(safeMarketingSummary.beta_invite_acceptance_rate_percent ?? 0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{Number(safeMarketingSummary.active_codes ?? 0)} active of {Number(safeMarketingSummary.total_codes ?? 0)} codes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marketing Funnel Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {marketingDaily.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="flex items-end gap-1 h-44">
                {marketingDaily.map((d) => {
                  const signupsH = Math.max(2, (d.signups / maxMarketingDaily) * 128);
                  const convertedH = Math.max(0, (d.paid_conversions / maxMarketingDaily) * 128);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end rounded-t-sm overflow-hidden border border-slate-100 bg-slate-50" style={{ height: "132px" }}>
                        <div className="w-full bg-blue-500/85" style={{ height: `${signupsH}px` }} />
                        <div className="w-full bg-emerald-500/90" style={{ height: `${convertedH}px` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Sign-ups</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Paid conversions</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acquisition Sources (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {marketingSource.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source data available</p>
            ) : (
              <div className="space-y-3">
                {marketingSource.map((row) => (
                  <div key={row.source}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize">{row.source.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.max(4, (row.count / maxMarketingSource) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Marketing Sign-ups</CardTitle>
          </CardHeader>
          <CardContent>
            {safeMarketingRecentSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent sign-ups</p>
            ) : (
              <div className="space-y-3">
                {safeMarketingRecentSignups.map((signup) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beta Invite Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Created (30 days)</span>
              <span className="font-semibold">{Number(safeMarketingBetaInvites.created_last_30_days ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-semibold">{Number(safeMarketingBetaInvites.total_uses ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Capacity</span>
              <span className="font-semibold">{Number(safeMarketingBetaInvites.total_capacity ?? 0)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, Math.max(0, Number(safeMarketingSummary.beta_invite_acceptance_rate_percent || 0)))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Utilization of issued beta capacity</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            IndexNow — Search Engine Indexing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Auto-submit runs on production startup/deploy for marketing updates. Use this button to manually re-submit all marketing and blog URLs to search engines via IndexNow.
          </p>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => indexNowMutation.mutate()}
              disabled={indexNowMutation.isPending || indexNowSubmitted}
            >
              {indexNowMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : indexNowSubmitted ? (
                <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />Submitted!</>
              ) : (
                <><Globe className="w-4 h-4 mr-2" />Manual Re-submit All Pages</>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">All marketing and blog URLs will be submitted</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
