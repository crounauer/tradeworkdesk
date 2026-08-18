import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, UserPlus, UserX, Clock, AlertTriangle, FileText, EyeOff, Info, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

type PortalReportData = {
  kpis: {
    total_customers: number;
    with_portal_access: number;
    registered: number;
    registered_and_enabled: number;
    enabled: number;
    disabled: number;
    invite_pending: number;
    invite_expired: number;
    pending_access_requests: number;
    active_portal_users_today: number;
    active_portal_users_7d: number;
    active_portal_users_30d: number;
    active_customers_today: number;
    active_customers_7d: number;
    active_customers_30d: number;
    visible_invoices_total: number;
    hidden_invoices_total: number;
    customers_with_visible_invoices: number;
    customers_with_hidden_invoices: number;
  };
  rates: {
    portal_coverage_pct: number;
    registration_pct: number;
    registered_and_enabled_pct: number;
    invite_pending_pct: number;
    invite_expired_pct: number;
    active_30d_of_registered_enabled_pct: number;
    active_7d_of_registered_enabled_pct: number;
  };
  invoice_status_breakdown: Array<{
    status: string;
    count: number;
    visible_in_portal: boolean;
  }>;
  portal_visible_invoice_statuses: string[];
};

function MetricCard({
  label,
  value,
  sub,
  icon,
  colorClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <Card className="p-5 border border-border/50 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-xl ${colorClass}`}>{icon}</div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
    </Card>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p className="font-bold">{payload[0].value}</p>
    </div>
  );
}

function toTitle(input: string): string {
  return input
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export default function CustomerPortalReport() {
  const { data, isLoading, isError } = useQuery<PortalReportData>({
    queryKey: ["/api/reports/customer-portal"],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}api/reports/customer-portal`);
      if (!response.ok) throw new Error("Failed to load customer portal report");
      return response.json();
    },
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-72 bg-muted rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6 border border-rose-200 bg-rose-50/60">
        <p className="text-sm font-medium text-rose-700">Unable to load customer portal report data.</p>
      </Card>
    );
  }

  const invoiceStatusChart = data.invoice_status_breakdown
    .map((row) => ({
      status: toTitle(row.status),
      count: row.count,
      color: row.visible_in_portal ? "#10b981" : "#f59e0b",
    }))
    .slice(0, 10);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-3xl font-display font-bold">Customer Portal Adoption</h2>
        <p className="text-muted-foreground mt-1">Registration and usage-readiness stats for customer portal access.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Registered Customers"
          value={data.kpis.registered}
          sub={`${data.rates.registration_pct}% of all active customers`}
          icon={<UserCheck className="w-5 h-5" />}
          colorClass="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Portal Coverage"
          value={data.kpis.with_portal_access}
          sub={`${data.rates.portal_coverage_pct}% have portal records`}
          icon={<Users className="w-5 h-5" />}
          colorClass="bg-blue-50 text-blue-600"
        />
        <MetricCard
          label="Invite Pending"
          value={data.kpis.invite_pending}
          sub={`${data.rates.invite_pending_pct}% awaiting registration`}
          icon={<Clock className="w-5 h-5" />}
          colorClass="bg-amber-50 text-amber-600"
        />
        <MetricCard
          label="Invite Expired"
          value={data.kpis.invite_expired}
          sub={`${data.rates.invite_expired_pct}% need re-invite`}
          icon={<AlertTriangle className="w-5 h-5" />}
          colorClass="bg-rose-50 text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Active Today"
          value={data.kpis.active_customers_today}
          sub={`${data.kpis.active_portal_users_today} portal users`}
          icon={<Activity className="w-5 h-5" />}
          colorClass="bg-cyan-50 text-cyan-700"
        />
        <MetricCard
          label="Active Last 7 Days"
          value={data.kpis.active_customers_7d}
          sub={`${data.rates.active_7d_of_registered_enabled_pct}% of ready accounts`}
          icon={<Activity className="w-5 h-5" />}
          colorClass="bg-sky-50 text-sky-700"
        />
        <MetricCard
          label="Active Last 30 Days"
          value={data.kpis.active_customers_30d}
          sub={`${data.rates.active_30d_of_registered_enabled_pct}% of ready accounts`}
          icon={<Activity className="w-5 h-5" />}
          colorClass="bg-indigo-50 text-indigo-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border border-border/50 shadow-sm">
          <h3 className="text-lg font-bold font-display mb-1">Account State</h3>
          <p className="text-xs text-muted-foreground mb-4">How many customer accounts are ready vs blocked.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Registered & enabled</p>
              <p className="text-xl font-bold mt-1">{data.kpis.registered_and_enabled}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Disabled access</p>
              <p className="text-xl font-bold mt-1">{data.kpis.disabled}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Pending access requests</p>
              <p className="text-xl font-bold mt-1">{data.kpis.pending_access_requests}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Total active customers</p>
              <p className="text-xl font-bold mt-1">{data.kpis.total_customers}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Active customers (7d)</p>
              <p className="text-xl font-bold mt-1">{data.kpis.active_customers_7d}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Active customers (30d)</p>
              <p className="text-xl font-bold mt-1">{data.kpis.active_customers_30d}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-border/50 shadow-sm">
          <h3 className="text-lg font-bold font-display mb-1">Invoice Visibility</h3>
          <p className="text-xs text-muted-foreground mb-4">Portal can only show allowed invoice statuses.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground flex items-center gap-1"><FileText className="w-4 h-4" /> Visible invoices</p>
              <p className="text-xl font-bold mt-1">{data.kpis.visible_invoices_total}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground flex items-center gap-1"><EyeOff className="w-4 h-4" /> Hidden invoices</p>
              <p className="text-xl font-bold mt-1">{data.kpis.hidden_invoices_total}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Customers with visible invoices</p>
              <p className="text-xl font-bold mt-1">{data.kpis.customers_with_visible_invoices}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground">Customers with hidden invoices</p>
              <p className="text-xl font-bold mt-1">{data.kpis.customers_with_hidden_invoices}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 border border-border/50 shadow-sm">
        <h3 className="text-lg font-bold font-display mb-1">Invoice Status Breakdown</h3>
        <p className="text-xs text-muted-foreground mb-4">Green statuses are visible in the portal. Amber statuses are hidden.</p>
        {invoiceStatusChart.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invoiceStatusChart} margin={{ top: 8, left: 0, right: 8, bottom: 0 }}>
                <XAxis dataKey="status" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {invoiceStatusChart.map((row, index) => (
                    <Cell key={`${row.status}-${index}`} fill={row.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No invoice data available.</p>
        )}
      </Card>

      <Card className="p-4 border border-blue-200 bg-blue-50/50">
        <p className="text-sm text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5" />
          Portal-visible invoice statuses: {data.portal_visible_invoice_statuses.map(toTitle).join(", ")}.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border border-border/50">
          <p className="text-xs text-muted-foreground">Customers who can likely use portal today</p>
          <p className="text-2xl font-bold mt-1">{data.kpis.registered_and_enabled}</p>
          <p className="text-xs text-muted-foreground mt-1">Registered + enabled account.</p>
        </Card>
        <Card className="p-4 border border-border/50">
          <p className="text-xs text-muted-foreground">Customers likely needing admin action</p>
          <p className="text-2xl font-bold mt-1">{data.kpis.invite_expired + data.kpis.pending_access_requests + data.kpis.disabled}</p>
          <p className="text-xs text-muted-foreground mt-1">Expired invites, pending requests, or disabled access.</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Enabled Accounts"
          value={data.kpis.enabled}
          icon={<UserPlus className="w-5 h-5" />}
          colorClass="bg-cyan-50 text-cyan-600"
        />
        <MetricCard
          label="Disabled Accounts"
          value={data.kpis.disabled}
          icon={<UserX className="w-5 h-5" />}
          colorClass="bg-slate-100 text-slate-600"
        />
        <MetricCard
          label="Ready-to-use Rate"
          value={`${data.rates.registered_and_enabled_pct}%`}
          icon={<UserCheck className="w-5 h-5" />}
          colorClass="bg-lime-50 text-lime-700"
        />
      </div>
    </div>
  );
}
