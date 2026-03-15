import { useGetDashboard } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Reports() {
  const { data, isLoading } = useGetDashboard();

  if (isLoading) return <div className="p-8">Loading reports...</div>;

  const chartData = [
    { name: 'Mon', jobs: 4 },
    { name: 'Tue', jobs: 6 },
    { name: 'Wed', jobs: 8 },
    { name: 'Thu', jobs: 5 },
    { name: 'Fri', jobs: 7 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">Business performance overview</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-6 font-display">Jobs Completed This Week</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border-border/50">
          <h2 className="font-bold text-lg mb-6 font-display text-rose-600">Overdue Services Action List</h2>
          <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2">
            {data?.overdue_services?.map((svc, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-border/50">
                <div>
                  <p className="font-bold text-sm">{svc.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{svc.property_address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-rose-600">Due: {new Date(svc.next_service_due).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {(!data?.overdue_services || data.overdue_services.length === 0) && (
              <p className="text-muted-foreground text-center py-8">No overdue services.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
