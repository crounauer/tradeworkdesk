import { useQuery } from "@tanstack/react-query";
import { useGetUpcomingServices, useGetOverdueServices, useGetCompletedByTechnician } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import {
  AlertTriangle, Clock, CheckCircle, Users, Lock,
  TrendingUp, Briefcase, Receipt, PoundSterling, CalendarDays,
} from "lucide-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────

interface OverviewData {
  kpis: {
    jobs_this_month: number;
    revenue_this_month: number;
    outstanding_balance: number;
    active_customers: number;
  };
  jobs_by_type: { type: string; count: number }[];
  jobs_by_status: { status: string; count: number }[];
  monthly_revenue: { label: string; revenue: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

const TYPE_LABELS: Record<string, string> = {
  service: "Service", breakdown: "Breakdown", installation: "Installation",
  inspection: "Inspection", follow_up: "Follow Up",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed",
  cancelled: "Cancelled", requires_follow_up: "Follow Up", awaiting_parts: "Awaiting Parts",
  invoiced: "Invoiced",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6", in_progress: "#f59e0b", completed: "#10b981",
  cancelled: "#94a3b8", requires_follow_up: "#f43f5e", awaiting_parts: "#f97316",
  invoiced: "#8b5cf6",
};

const TYPE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

// ─── KPI Card ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <Card className="p-5 border border-border/50 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}

// ─── Tooltip formatters ───────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-emerald-600 font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p className="font-bold">{payload[0].value} jobs</p>
    </div>
  );
}

function ReportsContent() {
  const { data: overview, isLoading: loadingOverview } = useQuery<OverviewData>({
    queryKey: ["/api/reports/overview"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/reports/overview`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: upcoming, isLoading: loadingUpcoming, isError: errorUpcoming } = useGetUpcomingServices();
  const { data: overdue, isLoading: loadingOverdue, isError: errorOverdue } = useGetOverdueServices();
  const { data: completedByTech, isLoading: loadingCompleted, isError: errorCompleted } = useGetCompletedByTechnician();

  const isLoading = loadingOverview || loadingUpcoming || loadingOverdue || loadingCompleted;
  const isPermissionError = errorUpcoming || errorOverdue || errorCompleted;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (isPermissionError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="p-4 bg-slate-100 rounded-full">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground max-w-sm">
          Reports & Analytics are only available to admin and office staff accounts.
          Contact your administrator if you need access.
        </p>
      </div>
    );
  }

  const kpis = overview?.kpis;
  const currentMonth = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const typeChartData = (overview?.jobs_by_type ?? [])
    .map(d => ({ name: TYPE_LABELS[d.type] ?? d.type, count: d.count }))
    .sort((a, b) => b.count - a.count);

  const statusChartData = (overview?.jobs_by_status ?? [])
    .map(d => ({ name: STATUS_LABELS[d.status] ?? d.status, count: d.count, color: STATUS_COLORS[d.status] ?? "#94a3b8" }))
    .sort((a, b) => b.count - a.count);

  const monthlyRevenue = overview?.monthly_revenue ?? [];

  const techChartData = (completedByTech ?? [])
    .map(t => ({ name: t.technician_name || "Unknown", completed: t.completed_count || 0 }));

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">Business performance overview</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Jobs This Month"
          value={kpis?.jobs_this_month ?? 0}
          sub={currentMonth}
          icon={<Briefcase className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Revenue This Month"
          value={fmt(kpis?.revenue_this_month ?? 0)}
          sub="Paid invoices"
          icon={<PoundSterling className="w-5 h-5" />}
          color="bg-emerald-50 text-emerald-600"
        />
        <Link href="/invoices?unpaid=1" className="block">
          <Card className="p-5 border border-border/50 shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><Receipt className="w-5 h-5" /></div>
              <span className="text-sm font-medium text-muted-foreground">Outstanding Balance</span>
            </div>
            <p className={`text-3xl font-bold ${(kpis?.outstanding_balance ?? 0) > 0 ? "text-amber-600" : ""}`}>
              {fmt(kpis?.outstanding_balance ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Unpaid invoices → view</p>
          </Card>
        </Link>
        <KpiCard
          label="Active Customers"
          value={kpis?.active_customers ?? 0}
          sub="Total on system"
          icon={<Users className="w-5 h-5" />}
          color="bg-violet-50 text-violet-600"
        />
      </div>

      {/* Revenue trend + Jobs by type */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-1 font-display flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> Revenue — Last 6 Months
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Paid invoices only</p>
          {monthlyRevenue.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `£${(v/1000).toFixed(0)}k`} width={44} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet.</div>
          )}
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-1 font-display flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-500" /> Jobs This Month by Type
          </h2>
          <p className="text-xs text-muted-foreground mb-4">{currentMonth}</p>
          {typeChartData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip content={<CountTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {typeChartData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No jobs booked this month.</div>
          )}
        </Card>
      </div>

      {/* Job status breakdown + Technician performance */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-1 font-display flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-slate-500" /> Job Status Breakdown
          </h2>
          <p className="text-xs text-muted-foreground mb-4">{currentMonth}</p>
          {statusChartData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip content={<CountTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {statusChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No jobs this month.</div>
          )}
        </Card>

        {techChartData.length > 0 ? (
          <Card className="p-6 shadow-sm border-border/50">
            <h2 className="font-bold text-lg mb-1 font-display flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" /> Jobs Completed by Technician
            </h2>
            <p className="text-xs text-muted-foreground mb-4">All time</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip content={<CountTooltip />} />
                  <Bar dataKey="completed" radius={[0, 4, 4, 0]}>
                    {techChartData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ) : (
          <Card className="p-6 shadow-sm border-border/50 flex items-center justify-center text-muted-foreground text-sm">
            No completed jobs assigned to technicians yet.
          </Card>
        )}
      </div>

      {/* Service alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-sm border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg font-display text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Overdue Services
            </h2>
            <span className="text-sm font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
              {overdue?.length ?? 0}
            </span>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
            {overdue?.map((svc) => (
              <div key={svc.appliance_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-border/50">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{svc.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{svc.property_address}</p>
                  <p className="text-xs text-muted-foreground">{svc.manufacturer} {svc.model}</p>
                </div>
                <p className="text-sm font-bold text-rose-600 shrink-0 ml-3 whitespace-nowrap">
                  {new Date(svc.next_service_due as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
            {(!overdue || overdue.length === 0) && (
              <p className="text-muted-foreground text-center py-8 text-sm">No overdue services. ✓</p>
            )}
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg font-display text-amber-600 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Upcoming Services
            </h2>
            <span className="text-sm font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
              {upcoming?.length ?? 0} in 30 days
            </span>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
            {upcoming?.map((svc) => (
              <div key={svc.appliance_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-border/50">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{svc.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{svc.property_address}</p>
                  <p className="text-xs text-muted-foreground">{svc.manufacturer} {svc.model}</p>
                </div>
                <p className="text-sm font-bold text-amber-600 shrink-0 ml-3 whitespace-nowrap">
                  {new Date(svc.next_service_due as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
            {(!upcoming || upcoming.length === 0) && (
              <p className="text-muted-foreground text-center py-8 text-sm">No upcoming services in the next 30 days.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Reports() {
  const { hasFeature } = usePlanFeatures();

  if (!hasFeature("reports")) {
    return <UpgradePrompt feature="reports" />;
  }

  return <ReportsContent />;
}

