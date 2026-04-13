import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { PortalLayout } from "./portal-layout";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Building2, Briefcase, Calendar, Clock, ChevronRight } from "lucide-react";

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

export default function PortalDashboard() {
  const { session } = usePortalAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["portal-dashboard"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/dashboard`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    enabled: !!session,
    staleTime: 30_000,
  });

  return (
    <PortalLayout>
      <div className="space-y-6 animate-in fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome{data?.customer ? `, ${data.customer.first_name}` : ""}
          </h1>
          <p className="text-slate-500 mt-1">
            {data?.company_name ? `Your service records with ${data.company_name}` : "Your customer portal"}
          </p>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
                <div className="h-8 bg-slate-200 rounded w-16" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/portal/properties">
                <Card className="p-6 border border-slate-200 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Properties</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{data?.properties_count || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </Card>
              </Link>
              <Card className="p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Upcoming Appointments</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{data?.upcoming_jobs?.length || 0}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <Calendar className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </Card>
              <Link href="/portal/jobs">
                <Card className="p-6 border border-slate-200 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Recent Completed</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{data?.recent_jobs?.length || 0}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                      <Briefcase className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </Card>
              </Link>
            </div>

            {data?.upcoming_jobs?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Upcoming Appointments</h2>
                <div className="space-y-2">
                  {data.upcoming_jobs.map((job: any) => (
                    <Link key={job.id} href={`/portal/jobs/${job.id}`}>
                      <Card className="p-4 border border-slate-200 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[job.status] || "bg-slate-100 text-slate-600"}`}>
                              {statusLabels[job.status] || job.status}
                            </span>
                            <div>
                              <p className="font-medium text-sm text-slate-900">
                                {job.job_ref ? `#${job.job_ref}` : "Service"} — {job.job_type?.replace(/_/g, " ") || "Service"}
                              </p>
                              {job.property_address && (
                                <p className="text-xs text-slate-500">{job.property_address}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {job.scheduled_date && new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            {job.scheduled_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {job.scheduled_time.slice(0, 5)}
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {data?.properties?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-900">Your Properties</h2>
                  <Link href="/portal/properties" className="text-sm text-primary hover:underline">
                    View all
                  </Link>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.properties.slice(0, 4).map((prop: any) => (
                    <Link key={prop.id} href={`/portal/properties/${prop.id}`}>
                      <Card className="p-4 border border-slate-200 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Building2 className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900">{prop.address_line1}</p>
                            <p className="text-xs text-slate-500">{prop.postcode}</p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {data?.recent_jobs?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-900">Recent Completed Jobs</h2>
                  <Link href="/portal/jobs" className="text-sm text-primary hover:underline">
                    View all
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.recent_jobs.map((job: any) => (
                    <Link key={job.id} href={`/portal/jobs/${job.id}`}>
                      <Card className="p-4 border border-slate-200 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Completed
                            </span>
                            <p className="font-medium text-sm text-slate-900">
                              {job.job_ref ? `#${job.job_ref}` : "Service"} — {job.job_type?.replace(/_/g, " ") || "Service"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {job.scheduled_date && new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
