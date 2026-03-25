import { useGetUpcomingServices, useGetOverdueServices, useGetCompletedByTechnician } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, Clock, CheckCircle, Users, Lock } from "lucide-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";

function ReportsContent() {
  const { data: upcoming, isLoading: loadingUpcoming, isError: errorUpcoming } = useGetUpcomingServices();
  const { data: overdue, isLoading: loadingOverdue, isError: errorOverdue } = useGetOverdueServices();
  const { data: completedByTech, isLoading: loadingCompleted, isError: errorCompleted } = useGetCompletedByTechnician();

  const isLoading = loadingUpcoming || loadingOverdue || loadingCompleted;
  const isPermissionError = errorUpcoming || errorOverdue || errorCompleted;

  if (isLoading) return <div className="p-8">Loading reports...</div>;

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

  const techChartData = completedByTech?.map(t => ({
    name: t.technician_name || "Unknown",
    completed: t.completed_count || 0,
  })) || [];

  const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">Business performance overview</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5 border border-border/50 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Upcoming Services</span>
          </div>
          <p className="text-3xl font-bold">{upcoming?.length || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Due within 30 days</p>
        </Card>
        <Card className="p-5 border border-border/50 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Overdue Services</span>
          </div>
          <p className="text-3xl font-bold text-rose-600">{overdue?.length || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Past due date</p>
        </Card>
        <Card className="p-5 border border-border/50 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Active Technicians</span>
          </div>
          <p className="text-3xl font-bold">{techChartData.length}</p>
          <p className="text-xs text-muted-foreground mt-1">With completed jobs</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {techChartData.length > 0 && (
          <Card className="p-6 shadow-sm border-border/50">
            <h2 className="font-bold text-lg mb-6 font-display flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" /> Jobs Completed by Technician
            </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techChartData} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="completed" radius={[0, 4, 4, 0]}>
                    {techChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-6 font-display text-rose-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Overdue Services
          </h2>
          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2">
            {overdue?.map((svc) => (
              <div key={svc.appliance_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-border/50">
                <div>
                  <p className="font-bold text-sm">{svc.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{svc.property_address}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{svc.manufacturer} {svc.model}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-rose-600">Due: {new Date(svc.next_service_due).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {(!overdue || overdue.length === 0) && (
              <p className="text-muted-foreground text-center py-8">No overdue services.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6 shadow-sm border-border/50">
        <h2 className="font-bold text-lg mb-6 font-display text-amber-600 flex items-center gap-2">
          <Clock className="w-5 h-5" /> Upcoming Services (Next 30 Days)
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcoming?.map((svc) => (
            <div key={svc.appliance_id} className="p-4 bg-slate-50 rounded-xl border border-border/50">
              <p className="font-bold text-sm">{svc.customer_name}</p>
              <p className="text-xs text-muted-foreground">{svc.property_address}</p>
              <p className="text-xs text-muted-foreground">{svc.manufacturer} {svc.model}</p>
              <p className="text-sm font-medium text-amber-600 mt-2">Due: {new Date(svc.next_service_due).toLocaleDateString()}</p>
            </div>
          ))}
          {(!upcoming || upcoming.length === 0) && (
            <p className="text-muted-foreground text-center py-8 col-span-full">No upcoming services in the next 30 days.</p>
          )}
        </div>
      </Card>
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
