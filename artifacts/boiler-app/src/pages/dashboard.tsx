import { useGetDashboard } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Users, Briefcase, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { formatDateTime } from "@/lib/utils";

export default function Dashboard() {
  const { data, isLoading } = useGetDashboard();

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;
  if (!data) return null;

  const stats = [
    { label: "Total Customers", value: data.stats?.total_customers || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Jobs Today", value: data.stats?.total_jobs_today || 0, icon: Briefcase, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Overdue Services", value: data.stats?.overdue_count || 0, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
    { label: "Completed This Week", value: data.stats?.completed_this_week || 0, icon: CheckCircle2, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-6 border-0 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="p-6 border-0 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <h2 className="text-xl font-display font-bold mb-4">Today's Jobs</h2>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3">
            {data.todays_jobs?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No jobs scheduled for today.</p>
            ) : (
              data.todays_jobs?.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block p-4 rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all bg-card">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-primary">{job.customer_name}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">{job.job_type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{job.property_address}</p>
                  <p className="text-sm font-medium">{formatDateTime(job.scheduled_date + (job.scheduled_time ? `T${job.scheduled_time}` : 'T00:00:00'))}</p>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <h2 className="text-xl font-display font-bold mb-4">Requires Follow-up</h2>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3">
            {data.follow_up_required?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No jobs require follow-up.</p>
            ) : (
              data.follow_up_required?.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block p-4 rounded-xl border border-rose-200 bg-rose-50/50 hover:border-rose-400 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-rose-700">{job.customer_name}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-700">Action Needed</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{job.property_address}</p>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
