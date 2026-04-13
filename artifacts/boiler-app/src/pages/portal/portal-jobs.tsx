import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { PortalLayout } from "./portal-layout";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Briefcase, Calendar, Clock, ChevronRight, MapPin } from "lucide-react";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  requires_follow_up: "bg-rose-100 text-rose-700",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  requires_follow_up: "Follow Up",
};

export default function PortalJobs() {
  const { session } = usePortalAuth();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["portal-jobs"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/jobs`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
    enabled: !!session,
    staleTime: 30_000,
  });

  return (
    <PortalLayout>
      <div className="space-y-6 animate-in fade-in">
        <h1 className="text-2xl font-bold text-slate-900">Service History</h1>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-40 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-64" />
              </Card>
            ))}
          </div>
        ) : !jobs?.length ? (
          <Card className="p-8 text-center border-dashed">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No service records found.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {jobs.map((job: any) => (
              <Link key={job.id} href={`/portal/jobs/${job.id}`}>
                <Card className="p-4 border border-slate-200 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[job.status] || "bg-slate-100 text-slate-600"}`}>
                        {statusLabels[job.status] || job.status}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">
                          {job.job_ref ? `#${job.job_ref}` : "Service"} — {job.job_type?.replace(/_/g, " ") || "Service"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          {job.property_address && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {job.property_address}
                            </span>
                          )}
                          {job.description && (
                            <span className="truncate hidden sm:inline">{job.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 whitespace-nowrap shrink-0">
                      {job.scheduled_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
